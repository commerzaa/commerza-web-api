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
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (email)
    );

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

  // Backfill Unique Partner ID (referalcode) for any existing partners missing one
  await db.query(
    'shopping',
    "UPDATE dbo.portal_login SET referalcode = 'CMZ-P' || pmid::text WHERE COALESCE(TRIM(referalcode), '') = '' AND pmid IS NOT NULL"
  ).catch(() => { });

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
