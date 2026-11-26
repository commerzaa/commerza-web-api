'use strict';
const db = require('../db');

let initialized = false;

/**
 * Ensures extension tables for Commerzaa delivery settings, shipments,
 * unified marketplace orders, and disputes exist in `dbo` (shopping DB).
 * Does not modify any legacy table definitions.
 */
async function ensureCommerzaSchema() {
  if (initialized) return;
  const sql = `
    CREATE SCHEMA IF NOT EXISTS dbo;

    CREATE TABLE IF NOT EXISTS dbo.commerza_shop_delivery_settings (
      pmid BIGINT PRIMARY KEY,
      local_delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      local_pincodes TEXT NOT NULL DEFAULT '',
      local_radius_km NUMERIC(8,2) NOT NULL DEFAULT 5,
      local_fee NUMERIC(10,2) NOT NULL DEFAULT 30,
      local_eta_text VARCHAR(100) NOT NULL DEFAULT '45-60 mins',
      local_rider_type VARCHAR(30) NOT NULL DEFAULT 'self',
      shiprocket_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      shiprocket_pickup_location VARCHAR(120) NOT NULL DEFAULT '',
      default_weight_kg NUMERIC(8,3) NOT NULL DEFAULT 0.5,
      default_length_cm NUMERIC(8,2) NOT NULL DEFAULT 15,
      default_breadth_cm NUMERIC(8,2) NOT NULL DEFAULT 15,
      default_height_cm NUMERIC(8,2) NOT NULL DEFAULT 10,
      delivery_verified BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dbo.commerza_orders (
      id SERIAL PRIMARY KEY,
      order_number VARCHAR(60) UNIQUE NOT NULL,
      pmid BIGINT NOT NULL,
      customer_name VARCHAR(150) NOT NULL DEFAULT '',
      customer_phone VARCHAR(40) NOT NULL DEFAULT '',
      customer_email VARCHAR(150) NOT NULL DEFAULT '',
      delivery_address TEXT NOT NULL DEFAULT '',
      delivery_pincode VARCHAR(20) NOT NULL DEFAULT '',
      customer_latitude DOUBLE PRECISION,
      customer_longitude DOUBLE PRECISION,
      delivery_method VARCHAR(30) NOT NULL DEFAULT 'local',
      delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
      subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      payment_status VARCHAR(30) NOT NULL DEFAULT 'pending',
      fulfillment_status VARCHAR(40) NOT NULL DEFAULT 'pending',
      items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dbo.commerza_shipments (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES dbo.commerza_orders(id) ON DELETE CASCADE,
      pmid BIGINT NOT NULL,
      provider VARCHAR(30) NOT NULL DEFAULT 'local',
      shiprocket_order_id VARCHAR(80),
      shiprocket_shipment_id VARCHAR(80),
      awb_code VARCHAR(80),
      courier_name VARCHAR(120),
      tracking_url TEXT,
      status VARCHAR(60) NOT NULL DEFAULT 'pending',
      raw_payload JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dbo.commerza_product_meta (
      sprid BIGINT PRIMARY KEY,
      pmid BIGINT NOT NULL,
      weight_kg NUMERIC(8,3) NOT NULL DEFAULT 0.5,
      length_cm NUMERIC(8,2) NOT NULL DEFAULT 15,
      breadth_cm NUMERIC(8,2) NOT NULL DEFAULT 15,
      height_cm NUMERIC(8,2) NOT NULL DEFAULT 10,
      hsn_code VARCHAR(40) NOT NULL DEFAULT '',
      discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
      discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
      reject_remark TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE dbo.commerza_product_meta
      ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage';
    ALTER TABLE dbo.commerza_product_meta
      ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE dbo.commerza_orders
      ADD COLUMN IF NOT EXISTS customer_latitude DOUBLE PRECISION;
    ALTER TABLE dbo.commerza_orders
      ADD COLUMN IF NOT EXISTS customer_longitude DOUBLE PRECISION;
    ALTER TABLE dbo.commerza_orders
      ADD COLUMN IF NOT EXISTS assigned_delivery_user_id INTEGER;
    ALTER TABLE dbo.commerza_orders
      ADD COLUMN IF NOT EXISTS assigned_delivery_name VARCHAR(150) NOT NULL DEFAULT '';
    ALTER TABLE dbo.commerza_orders
      ADD COLUMN IF NOT EXISTS assigned_delivery_phone VARCHAR(40) NOT NULL DEFAULT '';
    ALTER TABLE dbo.commerza_orders
      ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP;
    ALTER TABLE dbo.commerza_orders
      ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'normal';
    ALTER TABLE dbo.product_category
      ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';
    ALTER TABLE dbo.product_subcategory
      ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';
    ALTER TABLE dbo.portal_login
      ADD COLUMN IF NOT EXISTS parent_plid BIGINT;
    ALTER TABLE dbo.ims_subproduct
      ADD COLUMN IF NOT EXISTS color_hex VARCHAR(20) NOT NULL DEFAULT '';
    ALTER TABLE dbo.tbl_categorygroupmaster
      ADD COLUMN IF NOT EXISTS show_in_nav BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE dbo.tbl_categorygroupmaster
      ADD COLUMN IF NOT EXISTS nav_order INTEGER NOT NULL DEFAULT 0;

    UPDATE dbo.tbl_categorygroupmaster gm
    SET nav_order = ranked.rn
    FROM (
      SELECT g.gmid,
             ROW_NUMBER() OVER (
               ORDER BY COALESCE(cnt.item_cnt, 0) DESC, g.gmid ASC
             ) AS rn
      FROM dbo.tbl_categorygroupmaster g
      LEFT JOIN (
        SELECT pc.gmid, COUNT(sp.sprid)::int AS item_cnt
        FROM dbo.product_category pc
        JOIN dbo.ims_masterproduct mp ON mp.catid = pc.catid
        JOIN dbo.ims_subproduct sp ON sp.mprid = mp.mprid
        WHERE COALESCE(sp.isactive, true) = true AND COALESCE(sp.isverified, 0) = 1
        GROUP BY pc.gmid
      ) cnt ON cnt.gmid = g.gmid
    ) ranked
    WHERE gm.gmid = ranked.gmid
      AND NOT EXISTS (SELECT 1 FROM dbo.tbl_categorygroupmaster WHERE COALESCE(nav_order, 0) > 0);

    CREATE TABLE IF NOT EXISTS dbo.commerza_coupons (
      id SERIAL PRIMARY KEY,
      pmid BIGINT NOT NULL DEFAULT 0,
      mprid BIGINT,
      code VARCHAR(50) NOT NULL,
      title VARCHAR(150) NOT NULL DEFAULT '',
      discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
      discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
      min_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      max_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
      usage_limit INTEGER NOT NULL DEFAULT 100,
      used_count INTEGER NOT NULL DEFAULT 0,
      valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
      valid_until TIMESTAMP,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (pmid, code)
    );

    CREATE TABLE IF NOT EXISTS dbo.commerza_portal_users (
      id SERIAL PRIMARY KEY,
      pmid BIGINT NOT NULL,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL,
      phone VARCHAR(40) NOT NULL DEFAULT '',
      password VARCHAR(255) NOT NULL,
      role VARCHAR(40) NOT NULL DEFAULT 'catalog_manager',
      user_type VARCHAR(20) NOT NULL DEFAULT 'staff',
      vehicle_type VARCHAR(40) NOT NULL DEFAULT '',
      vehicle_number VARCHAR(40) NOT NULL DEFAULT '',
      license_number VARCHAR(60) NOT NULL DEFAULT '',
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (email)
    );
    ALTER TABLE dbo.commerza_portal_users ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) NOT NULL DEFAULT 'staff';
    ALTER TABLE dbo.commerza_portal_users ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(40) NOT NULL DEFAULT '';
    ALTER TABLE dbo.commerza_portal_users ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(40) NOT NULL DEFAULT '';
    ALTER TABLE dbo.commerza_portal_users ADD COLUMN IF NOT EXISTS license_number VARCHAR(60) NOT NULL DEFAULT '';
    ALTER TABLE dbo.commerza_portal_users ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE;

    CREATE TABLE IF NOT EXISTS dbo.commerza_admin_users (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      phone VARCHAR(40) NOT NULL DEFAULT '',
      password VARCHAR(255) NOT NULL,
      role VARCHAR(40) NOT NULL DEFAULT 'moderator',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dbo.commerza_disputes (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES dbo.commerza_orders(id) ON DELETE SET NULL,
      pmid BIGINT,
      raised_by VARCHAR(30) NOT NULL DEFAULT 'customer',
      subject VARCHAR(200) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status VARCHAR(30) NOT NULL DEFAULT 'open',
      resolution_note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dbo.commerza_packages (
      id SERIAL PRIMARY KEY,
      code VARCHAR(40) UNIQUE NOT NULL,
      name VARCHAR(120) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      min_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      max_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      package_type VARCHAR(40) NOT NULL DEFAULT 'Seller',
      duration_days INTEGER NOT NULL DEFAULT 365,
      max_products INTEGER NOT NULL DEFAULT 25,
      local_delivery_allowed BOOLEAN NOT NULL DEFAULT TRUE,
      shiprocket_allowed BOOLEAN NOT NULL DEFAULT TRUE,
      features_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE dbo.commerza_packages ADD COLUMN IF NOT EXISTS min_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE dbo.commerza_packages ADD COLUMN IF NOT EXISTS max_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE dbo.commerza_packages ADD COLUMN IF NOT EXISTS package_type VARCHAR(40) NOT NULL DEFAULT 'Seller';

    CREATE TABLE IF NOT EXISTS dbo.commerza_master_settings (
      setting_key VARCHAR(80) PRIMARY KEY,
      value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dbo.commerza_units (
      id SERIAL PRIMARY KEY,
      code VARCHAR(30) UNIQUE NOT NULL,
      name VARCHAR(80) NOT NULL,
      symbol VARCHAR(20) NOT NULL,
      unit_group VARCHAR(40) NOT NULL DEFAULT 'count',
      base_unit_code VARCHAR(30) NOT NULL DEFAULT '',
      conversion_factor NUMERIC(12,4) NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dbo.commerza_category_units (
      id SERIAL PRIMARY KEY,
      catid BIGINT NOT NULL,
      unit_id INTEGER NOT NULL REFERENCES dbo.commerza_units(id) ON DELETE CASCADE,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE (catid, unit_id)
    );

    CREATE TABLE IF NOT EXISTS dbo.commerza_sizes (
      id SERIAL PRIMARY KEY,
      code VARCHAR(40) UNIQUE NOT NULL,
      name VARCHAR(80) NOT NULL,
      size_group VARCHAR(40) NOT NULL DEFAULT 'general',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dbo.commerza_category_sizes (
      id SERIAL PRIMARY KEY,
      catid BIGINT NOT NULL,
      size_id INTEGER NOT NULL REFERENCES dbo.commerza_sizes(id) ON DELETE CASCADE,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE (catid, size_id)
    );

    CREATE TABLE IF NOT EXISTS dbo.commerza_category_attributes (
      id SERIAL PRIMARY KEY,
      catid BIGINT NOT NULL DEFAULT 0,
      attr_name VARCHAR(120) NOT NULL,
      input_type VARCHAR(30) NOT NULL DEFAULT 'text',
      options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_required BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dbo.commerza_partner_wallet_tx (
      id SERIAL PRIMARY KEY,
      pmid BIGINT NOT NULL,
      wallet_type VARCHAR(20) NOT NULL DEFAULT 'income',
      tx_type VARCHAR(20) NOT NULL DEFAULT 'credit',
      category VARCHAR(40) NOT NULL DEFAULT 'referral_bonus',
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      source_pmid BIGINT,
      description TEXT NOT NULL DEFAULT '',
      status VARCHAR(30) NOT NULL DEFAULT 'completed',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE dbo.commerza_partner_wallet_tx
      ADD COLUMN IF NOT EXISTS wallet_type VARCHAR(20) NOT NULL DEFAULT 'income';

    CREATE TABLE IF NOT EXISTS dbo.commerza_partner_topup_requests (
      id SERIAL PRIMARY KEY,
      pmid BIGINT NOT NULL,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      payment_method VARCHAR(40) NOT NULL DEFAULT 'upi',
      transaction_ref VARCHAR(120) NOT NULL DEFAULT '',
      payment_proof_url TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      admin_remark TEXT NOT NULL DEFAULT '',
      verified_by VARCHAR(120) NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dbo.commerza_partner_withdrawals (
      id SERIAL PRIMARY KEY,
      pmid BIGINT NOT NULL,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      payout_method VARCHAR(30) NOT NULL DEFAULT 'upi',
      account_details TEXT NOT NULL DEFAULT '',
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      admin_remark TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dbo.commerza_partner_subscriptions (
      id SERIAL PRIMARY KEY,
      pmid BIGINT NOT NULL,
      package_id INTEGER REFERENCES dbo.commerza_packages(id) ON DELETE SET NULL,
      package_name VARCHAR(120) NOT NULL,
      amount_expected NUMERIC(10,2) NOT NULL DEFAULT 0,
      amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
      payment_method VARCHAR(40) NOT NULL DEFAULT 'upi',
      transaction_ref VARCHAR(120) NOT NULL DEFAULT '',
      payment_proof_url TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      admin_remark TEXT NOT NULL DEFAULT '',
      verified_by VARCHAR(120) NOT NULL DEFAULT '',
      starts_at TIMESTAMP,
      expires_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dbo.commerza_shop_details (
      pmid BIGINT PRIMARY KEY,
      shop_category VARCHAR(120) NOT NULL DEFAULT '',
      gst_number VARCHAR(40) NOT NULL DEFAULT '',
      pan_number VARCHAR(30) NOT NULL DEFAULT '',
      fssai_or_license VARCHAR(80) NOT NULL DEFAULT '',
      bank_account_name VARCHAR(150) NOT NULL DEFAULT '',
      bank_account_number VARCHAR(60) NOT NULL DEFAULT '',
      bank_ifsc VARCHAR(30) NOT NULL DEFAULT '',
      upi_id VARCHAR(100) NOT NULL DEFAULT '',
      opening_time VARCHAR(20) NOT NULL DEFAULT '09:00',
      closing_time VARCHAR(20) NOT NULL DEFAULT '21:00',
      working_days VARCHAR(100) NOT NULL DEFAULT 'Mon - Sun',
      city VARCHAR(100) NOT NULL DEFAULT '',
      state VARCHAR(100) NOT NULL DEFAULT '',
      landmark VARCHAR(200) NOT NULL DEFAULT '',
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      map_address TEXT NOT NULL DEFAULT '',
      shop_logo_url TEXT NOT NULL DEFAULT '',
      shop_banner_url TEXT NOT NULL DEFAULT '',
      is_profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
      block_remark TEXT NOT NULL DEFAULT '',
      kyc_mode VARCHAR(30) NOT NULL DEFAULT 'ONLINE',
      kyc_photo_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      kyc_id_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      kyc_tax_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      kyc_bank_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      kyc_profile_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      kyc_all_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      kyc_approved_at TIMESTAMP,
      kyc_remark TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    ALTER TABLE dbo.commerza_shop_details ADD COLUMN IF NOT EXISTS block_remark TEXT NOT NULL DEFAULT '';
    ALTER TABLE dbo.commerza_shop_details ADD COLUMN IF NOT EXISTS kyc_mode VARCHAR(30) NOT NULL DEFAULT 'ONLINE';
    ALTER TABLE dbo.commerza_shop_details ADD COLUMN IF NOT EXISTS kyc_photo_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
    ALTER TABLE dbo.commerza_shop_details ADD COLUMN IF NOT EXISTS kyc_id_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
    ALTER TABLE dbo.commerza_shop_details ADD COLUMN IF NOT EXISTS kyc_tax_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
    ALTER TABLE dbo.commerza_shop_details ADD COLUMN IF NOT EXISTS kyc_bank_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
    ALTER TABLE dbo.commerza_shop_details ADD COLUMN IF NOT EXISTS kyc_profile_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
    ALTER TABLE dbo.commerza_shop_details ADD COLUMN IF NOT EXISTS kyc_all_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
    ALTER TABLE dbo.commerza_shop_details ADD COLUMN IF NOT EXISTS kyc_approved_at TIMESTAMP;
    ALTER TABLE dbo.commerza_shop_details ADD COLUMN IF NOT EXISTS kyc_remark TEXT NOT NULL DEFAULT '';
  `;
  await db.query('shopping', sql);

  // Backfill Unique Partner ID (referalcode) and Binary Tree parent_plid / communityside
  await db.query(
    'shopping',
    "UPDATE dbo.portal_login SET referalcode = 'CMZ-P' || pmid::text WHERE COALESCE(TRIM(referalcode), '') = '' AND pmid IS NOT NULL"
  ).catch(() => { });
  await db.query(
    'shopping',
    'UPDATE dbo.portal_login SET parent_plid = intro_plid WHERE parent_plid IS NULL AND intro_plid IS NOT NULL'
  ).catch(() => { });
  await db.query(
    'shopping',
    `WITH ranked AS (
       SELECT plid, parent_plid, ROW_NUMBER() OVER (PARTITION BY parent_plid ORDER BY plid ASC) AS rn
       FROM dbo.portal_login
       WHERE parent_plid IS NOT NULL AND COALESCE(communityside, 0) = 0
     )
     UPDATE dbo.portal_login l
     SET communityside = CASE WHEN r.rn % 2 = 1 THEN 1 ELSE 2 END
     FROM ranked r
     WHERE l.plid = r.plid`
  ).catch(() => { });

  // Seed default backend Units if empty
  const unitCount = await db.scalar('shopping', 'SELECT COUNT(*)::int FROM commerza_units');
  if (!unitCount || unitCount === 0) {
    const defaultUnits = [
      ['pcs', 'Pieces (pcs)', 'pcs', 'count', '', 1, 1],
      ['pack', 'Pack', 'pack', 'pack', 'pcs', 1, 2],
      ['box', 'Box', 'box', 'pack', 'pcs', 1, 3],
      ['pair', 'Pair', 'pair', 'count', 'pcs', 2, 4],
      ['set', 'Set', 'set', 'pack', 'pcs', 1, 5],
      ['dozen', 'Dozen (12 pcs)', 'dz', 'count', 'pcs', 12, 6],
      ['kg', 'Kilogram (kg)', 'kg', 'weight', 'g', 1000, 7],
      ['g', 'Gram (g)', 'g', 'weight', 'g', 1, 8],
      ['l', 'Litre (L)', 'L', 'volume', 'ml', 1000, 9],
      ['ml', 'Millilitre (ml)', 'ml', 'volume', 'ml', 1, 10],
      ['m', 'Metre (m)', 'm', 'length', 'cm', 100, 11],
    ];
    for (const [code, name, symbol, group, base, factor, order] of defaultUnits) {
      await db.query(
        'shopping',
        `INSERT INTO commerza_units (code, name, symbol, unit_group, base_unit_code, conversion_factor, sort_order)
         VALUES (@code, @name, @symbol, @group, @base, @factor, @order)
         ON CONFLICT (code) DO NOTHING`,
        { code, name, symbol, group, base, factor, order }
      ).catch(() => { });
    }
  }

  // Seed default backend Sizes if empty
  const sizeCount = await db.scalar('shopping', 'SELECT COUNT(*)::int FROM commerza_sizes');
  if (!sizeCount || sizeCount === 0) {
    const defaultSizes = [
      ['Standard', 'Standard', 'general', 1],
      ['Free Size', 'Free Size', 'general', 2],
      ['Small', 'Small', 'general', 3],
      ['Medium', 'Medium', 'general', 4],
      ['Large', 'Large', 'general', 5],
      ['XS', 'XS (Extra Small)', 'apparel', 6],
      ['S', 'S (Small)', 'apparel', 7],
      ['M', 'M (Medium)', 'apparel', 8],
      ['L', 'L (Large)', 'apparel', 9],
      ['XL', 'XL (Extra Large)', 'apparel', 10],
      ['XXL', 'XXL (2XL)', 'apparel', 11],
      ['XXXL', 'XXXL (3XL)', 'apparel', 12],
      ['28', '28', 'numeric', 13],
      ['30', '30', 'numeric', 14],
      ['32', '32', 'numeric', 15],
      ['34', '34', 'numeric', 16],
      ['36', '36', 'numeric', 17],
      ['38', '38', 'numeric', 18],
      ['40', '40', 'numeric', 19],
      ['42', '42', 'numeric', 20],
      ['UK 6', 'UK 6', 'footwear', 21],
      ['UK 7', 'UK 7', 'footwear', 22],
      ['UK 8', 'UK 8', 'footwear', 23],
      ['UK 9', 'UK 9', 'footwear', 24],
      ['UK 10', 'UK 10', 'footwear', 25],
      ['UK 11', 'UK 11', 'footwear', 26],
      ['100g', '100g', 'weight', 27],
      ['250g', '250g', 'weight', 28],
      ['500g', '500g', 'weight', 29],
      ['1kg', '1kg', 'weight', 30],
      ['2kg', '2kg', 'weight', 31],
      ['250ml', '250ml', 'volume', 32],
      ['500ml', '500ml', 'volume', 33],
      ['1L', '1L', 'volume', 34],
      ['2L', '2L', 'volume', 35],
      ['Family Pack', 'Family Pack', 'pack', 36],
      ['Combo', 'Combo', 'pack', 37],
      ['Pro', 'Pro', 'pack', 38],
      ['Deluxe', 'Deluxe', 'pack', 39],
    ];
    for (const [code, name, group, order] of defaultSizes) {
      await db.query(
        'shopping',
        `INSERT INTO commerza_sizes (code, name, size_group, sort_order)
         VALUES (@code, @name, @group, @order)
         ON CONFLICT (code) DO NOTHING`,
        { code, name, group, order }
      ).catch(() => { });
    }
  }

  // Seed starter global & category attributes if empty
  const attrCount = await db.scalar('shopping', 'SELECT COUNT(*)::int FROM commerza_category_attributes');
  if (!attrCount || attrCount === 0) {
    const starterAttrs = [
      [0, 'Brand', 'text', [], true, 1],
      [0, 'Country of Origin', 'select', ['India', 'China', 'USA', 'Germany', 'Japan', 'Other'], false, 2],
      [1, 'Shelf Life / Expiry', 'text', [], false, 3],
      [1, 'Dietary Type', 'select', ['Veg', 'Non-Veg', 'Vegan'], false, 4],
      [2, 'Warranty', 'select', ['No Warranty', '6 Months', '1 Year', '2 Years'], false, 3],
      [3, 'Material / Fabric', 'select', ['Cotton', 'Polyester', 'Silk', 'Denim', 'Leather', 'Blend'], false, 3],
      [3, 'Wash Care', 'select', ['Machine Wash', 'Hand Wash', 'Dry Clean Only'], false, 4],
    ];
    for (const [catid, name, inputType, opts, req, order] of starterAttrs) {
      await db.query(
        'shopping',
        `INSERT INTO commerza_category_attributes (catid, attr_name, input_type, options_json, is_required, sort_order)
         VALUES (@catid, @name, @inputType, @opts::jsonb, @req, @order)`,
        { catid, name, inputType, opts: JSON.stringify(opts), req, order }
      ).catch(() => { });
    }
  }

  // Seed default partner packages if empty
  const pkgCount = await db.scalar('shopping', 'SELECT COUNT(*)::int FROM commerza_packages');
  if (!pkgCount || pkgCount === 0) {
    const starterPackages = [
      {
        code: 'STARTER',
        name: 'Starter Shop Plan',
        description: 'Ideal for local neighbourhood shops starting online on Commerzaa.',
        price: 999,
        duration_days: 365,
        max_products: 25,
        local_delivery_allowed: true,
        shiprocket_allowed: false,
        features: ['Up to 25 products', 'Local pincode & radius delivery', 'Shop verification badge', '1 year validity'],
        sort_order: 1,
      },
      {
        code: 'GROWTH',
        name: 'Growth Partner Plan',
        description: 'Best for growing sellers using both local riders and Shiprocket courier.',
        price: 2499,
        duration_days: 365,
        max_products: 200,
        local_delivery_allowed: true,
        shiprocket_allowed: true,
        features: ['Up to 200 products', 'Local delivery + Shiprocket AWB', 'Priority product approval', '1 year validity'],
        sort_order: 2,
      },
      {
        code: 'ENTERPRISE',
        name: 'Enterprise Brand Plan',
        description: 'Unlimited catalog & full pan-India logistics for established brands.',
        price: 4999,
        duration_days: 365,
        max_products: 9999,
        local_delivery_allowed: true,
        shiprocket_allowed: true,
        features: ['Unlimited products (9999)', 'Local + Shiprocket + Bulk support', 'Dedicated account support', '1 year validity'],
        sort_order: 3,
      },
    ];
    for (const p of starterPackages) {
      await db.query(
        'shopping',
        `INSERT INTO commerza_packages (code, name, description, price, duration_days, max_products, local_delivery_allowed, shiprocket_allowed, features_json, sort_order)
         VALUES (@code, @name, @description, @price, @duration_days, @max_products, @local, @sr, @features::jsonb, @sort)
         ON CONFLICT (code) DO NOTHING`,
        {
          code: p.code,
          name: p.name,
          description: p.description,
          price: p.price,
          duration_days: p.duration_days,
          max_products: p.max_products,
          local: p.local_delivery_allowed,
          sr: p.shiprocket_allowed,
          features: JSON.stringify(p.features),
          sort: p.sort_order,
        }
      );
    }
  }

  // Seed starter group categories, categories, and subcategories if empty
  const grpCount = await db.scalar('shopping', 'SELECT COUNT(*)::int FROM tbl_categorygroupmaster');
  if (!grpCount || grpCount === 0) {
    const starterGroups = [
      [1, 'Food & Daily Essentials'],
      [2, 'Electronics & Appliances'],
      [3, 'Fashion & Lifestyle'],
      [4, 'Home & Personal Care'],
    ];
    for (const [gmid, groupname] of starterGroups) {
      await db.query(
        'shopping',
        'INSERT INTO tbl_categorygroupmaster (gmid, groupname, status) VALUES (@gmid, @groupname, 1) ON CONFLICT DO NOTHING',
        { gmid, groupname }
      ).catch(() => { });
    }
  }

  const catCount = await db.scalar('shopping', 'SELECT COUNT(*)::int FROM product_category');
  if (!catCount || catCount === 0) {
    const starterCats = [
      [1, 'Groceries & Essentials', 1],
      [2, 'Electronics & Accessories', 2],
      [3, 'Fashion & Apparel', 3],
      [4, 'Home & Kitchen', 4],
      [5, 'Beauty & Personal Care', 4],
      [6, 'Health & Wellness', 1],
    ];
    for (const [catid, catname, gmid] of starterCats) {
      await db.query(
        'shopping',
        'INSERT INTO product_category (catid, catname, catactive, gmid) VALUES (@catid, @catname, true, @gmid) ON CONFLICT DO NOTHING',
        { catid, catname, gmid }
      ).catch(() => { });
    }
  } else {
    // Link existing starter categories to a group if gmid is null
    await db.query('shopping', 'UPDATE product_category SET gmid = 1 WHERE gmid IS NULL AND catid IN (1, 6)').catch(() => { });
    await db.query('shopping', 'UPDATE product_category SET gmid = 2 WHERE gmid IS NULL AND catid = 2').catch(() => { });
    await db.query('shopping', 'UPDATE product_category SET gmid = 3 WHERE gmid IS NULL AND catid = 3').catch(() => { });
    await db.query('shopping', 'UPDATE product_category SET gmid = 4 WHERE gmid IS NULL AND catid IN (4, 5)').catch(() => { });
  }

  const subCount = await db.scalar('shopping', 'SELECT COUNT(*)::int FROM product_subcategory');
  if (!subCount || subCount === 0) {
    const starterSubs = [
      [1, 'Fresh Produce & Dairy', 1],
      [2, 'Beverages & Snacks', 1],
      [3, 'Smartphones & Tablets', 2],
      [4, 'Audio & Accessories', 2],
      [5, "Men's Clothing", 3],
      [6, "Women's Clothing", 3],
      [7, 'Kitchen Appliances', 4],
      [8, 'Skincare & Grooming', 5],
      [9, 'Vitamins & Supplements', 6],
    ];
    for (const [scatid, scatname, catid] of starterSubs) {
      await db.query(
        'shopping',
        'INSERT INTO product_subcategory (scatid, scatname, scatactive, catid) VALUES (@scatid, @scatname, true, @catid) ON CONFLICT DO NOTHING',
        { scatid, scatname, catid }
      ).catch(() => { });
    }
  }
  initialized = true;
}

module.exports = { ensureCommerzaSchema };
