'use strict';
const express = require('express');
const db = require('../db');
const { signToken, auth, requireType } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { Encryptword } = require('../utils/crypto');
const { ensureCommerzaSchema } = require('../lib/commerzaSchema');

const router = express.Router();
const DB = 'shopping';
const guard = [auth, requireType('admin')];

// ---- Admin Login ---------------------------------------------------------------------------
router.post('/api/admin/login', asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const { email, password } = req.body || {};
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@commerzaa.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

  if (!email || !password) {
    return res.status(400).json({ status: 'false', message: 'Email and password are required' });
  }

  let valid = String(email).trim().toLowerCase() === adminEmail.toLowerCase() && password === adminPass;
  let adminRole = 'super_admin';
  let adminName = 'Super Admin';
  if (!valid) {
    const staff = await db.queryOne(
      DB,
      'SELECT * FROM commerza_admin_users WHERE lower(email) = lower(@email) AND is_active = true LIMIT 1',
      { email }
    );
    if (staff && staff.password === password) {
      valid = true;
      adminRole = staff.role || 'moderator';
      adminName = staff.full_name || email;
    }
  }
  if (!valid) {
    // Also check admin_profile / admin_security_key if populated
    const prof = await db.queryOne(DB, 'SELECT * FROM admin_profile WHERE lower(emailid) = lower(@email) LIMIT 1', { email });
    if (prof) {
      const sec = await db.queryOne(DB, 'SELECT * FROM admin_security_key WHERE adid = @adid LIMIT 1', { adid: prof.adid }).catch(() => null);
      if (sec && (sec.securitykey === password || sec.password === password)) valid = true;
    }
  }

  if (!valid) {
    return res.status(401).json({ status: 'false', message: 'Invalid admin credentials' });
  }

  const token = signToken({
    plid: 0,
    userName: email,
    role: adminRole,
    userType: 'admin',
  });

  res.json({
    status: 'true',
    token,
    admin: { email, name: adminName, role: adminRole },
  });
}));

// ---- Dashboard Stats -----------------------------------------------------------------------
router.get('/api/admin/stats', ...guard, asyncHandler(async (_req, res) => {
  await ensureCommerzaSchema();
  const [
    totalShops, pendingShops, totalProducts, pendingProducts,
    totalOrders, deliveredOrders, orderRevenue, subscriptionRevenue,
    openDisputes, pendingSubPayments, pendingTopups, totalCoupons, totalAdminUsers,
    paidMembers, blockedMembers, topupWalletTotal, incomeWalletTotal, pendingWithdrawals, kycApproved,
    latestOrders, salesTrend, orderStatusBreakdown, deliveryBreakdown,
  ] = await Promise.all([
    db.scalar(DB, 'SELECT COUNT(*)::int FROM portal_master'),
    db.scalar(DB, 'SELECT COUNT(*)::int FROM portal_master WHERE COALESCE(isverified, 0) = 0'),
    db.scalar(DB, 'SELECT COUNT(*)::int FROM ims_subproduct'),
    db.scalar(DB, 'SELECT COUNT(*)::int FROM ims_subproduct WHERE COALESCE(isverified, 0) = 0'),
    db.scalar(DB, 'SELECT COUNT(*)::int FROM commerza_orders'),
    db.scalar(DB, "SELECT COUNT(*)::int FROM commerza_orders WHERE fulfillment_status = 'delivered'"),
    db.scalar(DB, 'SELECT COALESCE(SUM(total_amount), 0)::numeric(12,2) FROM commerza_orders'),
    db.scalar(DB, "SELECT COALESCE(SUM(amount_paid), 0)::numeric(12,2) FROM commerza_partner_subscriptions WHERE status = 'approved'"),
    db.scalar(DB, "SELECT COUNT(*)::int FROM commerza_disputes WHERE status = 'open'"),
    db.scalar(DB, "SELECT COUNT(*)::int FROM commerza_partner_subscriptions WHERE status = 'pending'"),
    db.scalar(DB, "SELECT COUNT(*)::int FROM commerza_partner_topup_requests WHERE status = 'pending'"),
    db.scalar(DB, 'SELECT COUNT(*)::int FROM commerza_coupons WHERE is_active = true'),
    db.scalar(DB, 'SELECT COUNT(*)::int FROM commerza_admin_users WHERE is_active = true'),
    db.scalar(DB, "SELECT COUNT(DISTINCT pm.pmid)::int FROM portal_master pm JOIN commerza_partner_subscriptions s ON s.pmid = pm.pmid AND s.status = 'approved' WHERE COALESCE(pm.active, true) = true"),
    db.scalar(DB, 'SELECT COUNT(*)::int FROM portal_master WHERE COALESCE(active, true) = false'),
    db.scalar(DB, "SELECT COALESCE(SUM(CASE WHEN tx_type = 'credit' THEN amount ELSE -amount END), 0)::numeric(12,2) FROM commerza_partner_wallet_tx WHERE wallet_type = 'topup' AND status != 'rejected'"),
    db.scalar(DB, "SELECT COALESCE(SUM(CASE WHEN tx_type = 'credit' THEN amount ELSE -amount END), 0)::numeric(12,2) FROM commerza_partner_wallet_tx WHERE wallet_type = 'income' AND status != 'rejected'"),
    db.scalar(DB, "SELECT COUNT(*)::int FROM commerza_partner_withdrawals WHERE status = 'pending'"),
    db.scalar(DB, "SELECT COUNT(*)::int FROM commerza_shop_details WHERE kyc_all_status = 'APPROVED'"),
    db.query(
      DB,
      `SELECT o.id, o.order_number, o.customer_name, o.total_amount, o.delivery_method, o.fulfillment_status, o.created_at, pm.companyname
       FROM commerza_orders o
       LEFT JOIN portal_master pm ON pm.pmid = o.pmid
       ORDER BY o.id DESC LIMIT 6`
    ),
    db.query(
      DB,
      `SELECT to_char(d::date, 'Mon DD') AS label,
              COALESCE(COUNT(o.id), 0)::int AS orders,
              COALESCE(SUM(o.total_amount), 0)::numeric(12,2) AS revenue
       FROM generate_series(CURRENT_DATE - interval '6 days', CURRENT_DATE, interval '1 day') AS d
       LEFT JOIN commerza_orders o ON o.created_at::date = d::date
       GROUP BY d::date
       ORDER BY d::date ASC`
    ),
    db.query(DB, 'SELECT fulfillment_status AS label, COUNT(*)::int AS value FROM commerza_orders GROUP BY fulfillment_status'),
    db.query(DB, 'SELECT delivery_method AS label, COUNT(*)::int AS value FROM commerza_orders GROUP BY delivery_method'),
  ]);
  res.json({
    status: 'true',
    stats: {
      totalShops,
      pendingShops,
      totalProducts,
      pendingProducts,
      totalOrders,
      deliveredOrders,
      orderRevenue: Number(orderRevenue || 0),
      subscriptionRevenue: Number(subscriptionRevenue || 0),
      openDisputes,
      pendingPayments: Number(pendingSubPayments || 0) + Number(pendingTopups || 0),
      pendingTopups: Number(pendingTopups || 0),
      totalCoupons,
      totalAdminUsers,
      memberSummary: {
        paid: Number(paidMembers || 0),
        free: Math.max(0, Number(totalShops || 0) - Number(paidMembers || 0) - Number(blockedMembers || 0)),
        blocked: Number(blockedMembers || 0),
      },
      walletSummary: {
        topupWalletTotal: Number(topupWalletTotal || 0),
        incomeWalletTotal: Number(incomeWalletTotal || 0),
        pendingWithdrawals: Number(pendingWithdrawals || 0),
      },
      kycSummary: {
        approved: Number(kycApproved || 0),
        pending: Math.max(0, Number(totalShops || 0) - Number(kycApproved || 0)),
      },
      latestOrders: latestOrders || [],
      salesTrend: salesTrend || [],
      orderStatusBreakdown: orderStatusBreakdown || [],
      deliveryBreakdown: deliveryBreakdown || [],
    },
  });
}));

// ---- Package Plans & Payment Verification --------------------------------------------------
router.get('/api/admin/packages', ...guard, asyncHandler(async (_req, res) => {
  await ensureCommerzaSchema();
  const packages = await db.query(DB, 'SELECT * FROM commerza_packages ORDER BY sort_order ASC, id ASC');
  res.json({ status: 'true', packages });
}));

router.post('/api/admin/packages', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const {
    code, name, description = '', minAmount, maxAmount, price,
    packageType = 'Seller', durationDays = 365, maxProducts = 25,
    localDeliveryAllowed = true, shiprocketAllowed = true, features = [], isActive = true,
  } = req.body || {};
  if (!code || !name || price === undefined) {
    return res.status(400).json({ status: 'false', message: 'code, name, and price are required' });
  }
  const mrp = Number(price);
  const row = await db.queryOne(
    DB,
    `INSERT INTO commerza_packages (
       code, name, description, min_amount, max_amount, price, package_type,
       duration_days, max_products, local_delivery_allowed, shiprocket_allowed, features_json, is_active
     ) VALUES (
       @code, @name, @description, @minAmt, @maxAmt, @price, @pkgType,
       @durationDays, @maxProducts, @local, @sr, @features::jsonb, @active
     ) RETURNING *`,
    {
      code: String(code).toUpperCase().trim(),
      name: String(name).trim(),
      description,
      minAmt: minAmount !== undefined ? Number(minAmount) : mrp,
      maxAmt: maxAmount !== undefined ? Number(maxAmount) : mrp,
      price: mrp,
      pkgType: String(packageType || 'Seller'),
      durationDays: parseInt(durationDays, 10),
      maxProducts: parseInt(maxProducts, 10),
      local: Boolean(localDeliveryAllowed),
      sr: Boolean(shiprocketAllowed),
      features: JSON.stringify(Array.isArray(features) ? features : []),
      active: Boolean(isActive),
    }
  );
  res.status(201).json({ status: 'true', pkg: row });
}));

router.put('/api/admin/packages/:id', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const id = parseInt(req.params.id, 10);
  const b = req.body || {};
  const row = await db.queryOne(
    DB,
    `UPDATE commerza_packages
     SET code = COALESCE(@code, code),
         name = COALESCE(@name, name),
         description = COALESCE(@description, description),
         min_amount = COALESCE(@minAmt, min_amount),
         max_amount = COALESCE(@maxAmt, max_amount),
         price = COALESCE(@price, price),
         package_type = COALESCE(@pkgType, package_type),
         duration_days = COALESCE(@durationDays, duration_days),
         max_products = COALESCE(@maxProducts, max_products),
         local_delivery_allowed = COALESCE(@local, local_delivery_allowed),
         shiprocket_allowed = COALESCE(@sr, shiprocket_allowed),
         features_json = COALESCE(@features::jsonb, features_json),
         is_active = COALESCE(@active, is_active)
     WHERE id = @id
     RETURNING *`,
    {
      id,
      code: b.code ? String(b.code).toUpperCase().trim() : null,
      name: b.name ?? null,
      description: b.description ?? null,
      minAmt: b.minAmount !== undefined ? Number(b.minAmount) : null,
      maxAmt: b.maxAmount !== undefined ? Number(b.maxAmount) : null,
      price: b.price !== undefined ? Number(b.price) : null,
      pkgType: b.packageType ?? null,
      durationDays: b.durationDays !== undefined ? parseInt(b.durationDays, 10) : null,
      maxProducts: b.maxProducts !== undefined ? parseInt(b.maxProducts, 10) : null,
      local: b.localDeliveryAllowed !== undefined ? Boolean(b.localDeliveryAllowed) : null,
      sr: b.shiprocketAllowed !== undefined ? Boolean(b.shiprocketAllowed) : null,
      features: Array.isArray(b.features) ? JSON.stringify(b.features) : null,
      active: b.isActive !== undefined ? Boolean(b.isActive) : null,
    }
  );
  if (!row) return res.status(404).json({ status: 'false', message: 'Package not found' });
  res.json({ status: 'true', pkg: row });
}));

router.patch('/api/admin/packages/:id/toggle', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const id = parseInt(req.params.id, 10);
  const active = Boolean(req.body?.is_active);
  const updated = await db.exec(DB, 'UPDATE commerza_packages SET is_active = @active WHERE id = @id', { id, active });
  if (!updated) return res.status(404).json({ status: 'false', message: 'Package not found' });
  res.json({ status: 'true', message: 'Package status updated' });
}));

// ---- Master Settings (Company/Bank, Taxes/Commission, Logistics) ---------------------------
router.get('/api/admin/master-settings', ...guard, asyncHandler(async (_req, res) => {
  await ensureCommerzaSchema();
  const rows = await db.query(DB, 'SELECT setting_key, value_json FROM commerza_master_settings');
  const map = {};
  for (const r of rows) map[r.setting_key] = r.value_json;
  res.json({
    status: 'true',
    settings: {
      company: map.company || {
        companyName: 'Commerzaa Global',
        supportEmail: 'info@clusteroffer.com',
        supportPhone: '0120-4858585',
        upiId: 'commerzaa@upi',
        bankName: 'HDFC Bank',
        accountHolder: 'Commerzaa Global Pvt Ltd',
        accountNumber: '123456789012',
        ifscCode: 'HDFC0001234',
      },
      taxes: map.taxes || {
        defaultGstPercent: 18,
        platformCommissionPercent: 5,
        requireProductApproval: true,
        requireShopVerification: true,
      },
      logistics: map.logistics || {
        defaultLocalRadiusKm: 5,
        defaultLocalFee: 30,
        defaultLocalEta: '45-60 mins',
        shiprocketEnabledGlobally: true,
      },
    },
  });
}));

router.put('/api/admin/master-settings/:section', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const section = String(req.params.section || '').trim();
  if (!['company', 'taxes', 'logistics'].includes(section)) {
    return res.status(400).json({ status: 'false', message: 'Invalid master settings section' });
  }
  await db.query(
    DB,
    `INSERT INTO commerza_master_settings (setting_key, value_json, updated_at)
     VALUES (@key, @val::jsonb, NOW())
     ON CONFLICT (setting_key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = NOW()`,
    { key: section, val: JSON.stringify(req.body || {}) }
  );
  res.json({ status: 'true', message: 'Master settings saved' });
}));

router.get('/api/admin/subscriptions', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const statusFilter = req.query.status || 'all';
  let where = '1=1';
  if (['pending', 'approved', 'rejected'].includes(String(statusFilter))) {
    where = 's.status = @statusFilter';
  }
  const subscriptions = await db.query(
    DB,
    `SELECT s.*, pm.companyname, pm.comemailid, pm.mobileno, pm.isverified AS shop_verified,
            pkg.code AS package_code, pkg.max_products, pkg.duration_days
     FROM commerza_partner_subscriptions s
     LEFT JOIN portal_master pm ON pm.pmid = s.pmid
     LEFT JOIN commerza_packages pkg ON pkg.id = s.package_id
     WHERE ${where}
     ORDER BY s.id DESC`,
    { statusFilter }
  );
  res.json({ status: 'true', subscriptions });
}));

router.patch('/api/admin/subscriptions/:id/review', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const id = parseInt(req.params.id, 10);
  const { action, verifiedAmount, remark = '' } = req.body || {};
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ status: 'false', message: "action must be 'approve' or 'reject'" });
  }

  const sub = await db.queryOne(
    DB,
    `SELECT s.*, COALESCE(pkg.duration_days, 365) AS duration_days
     FROM commerza_partner_subscriptions s
     LEFT JOIN commerza_packages pkg ON pkg.id = s.package_id
     WHERE s.id = @id`,
    { id }
  );
  if (!sub) return res.status(404).json({ status: 'false', message: 'Subscription request not found' });

  await db.tx(DB, async (t) => {
    if (action === 'approve') {
      const amount = verifiedAmount !== undefined ? Number(verifiedAmount) : Number(sub.amount_paid || sub.amount_expected);
      await t.query(
        `UPDATE commerza_partner_subscriptions
         SET status = 'approved',
             amount_paid = @amount,
             admin_remark = @remark,
             verified_by = @admin,
             starts_at = NOW(),
             expires_at = NOW() + (@days || ' days')::interval,
             updated_at = NOW()
         WHERE id = @id`,
        { id, amount, remark: String(remark), admin: req.user.userName || 'admin', days: Number(sub.duration_days) }
      );
      // Verify the partner shop & delivery settings so they can immediately add products
      await t.query(
        'UPDATE portal_master SET isverified = 1, active = true WHERE pmid = @pmid',
        { pmid: sub.pmid }
      );
      await t.query(
        `INSERT INTO commerza_shop_delivery_settings (pmid, delivery_verified)
         VALUES (@pmid, true)
         ON CONFLICT (pmid) DO UPDATE SET delivery_verified = true, updated_at = NOW()`,
        { pmid: sub.pmid }
      );

      // Credit partner-to-partner referral commission (10% of verified package amount) if referred
      const loginRow = await t.queryOne('SELECT intro_plid FROM portal_login WHERE pmid = @pmid LIMIT 1', { pmid: sub.pmid });
      if (loginRow?.intro_plid) {
        const referrer = await t.queryOne('SELECT pmid FROM portal_login WHERE plid = @plid LIMIT 1', { plid: loginRow.intro_plid });
        if (referrer?.pmid && Number(referrer.pmid) !== Number(sub.pmid)) {
          const alreadyCredited = await t.scalar(
            "SELECT COUNT(*)::int FROM commerza_partner_wallet_tx WHERE pmid = @refPmid AND source_pmid = @srcPmid AND category = 'referral_bonus'",
            { refPmid: referrer.pmid, srcPmid: sub.pmid }
          );
          if (!alreadyCredited) {
            const bonus = Number((amount * 0.10).toFixed(2));
            if (bonus > 0) {
              await t.query(
                `INSERT INTO commerza_partner_wallet_tx (pmid, tx_type, category, amount, source_pmid, description, status)
                 VALUES (@refPmid, 'credit', 'referral_bonus', @bonus, @srcPmid, @desc, 'completed')`,
                {
                  refPmid: referrer.pmid,
                  bonus,
                  srcPmid: sub.pmid,
                  desc: `10% referral bonus for ${sub.package_name} (Shop #${sub.pmid})`,
                }
              );
            }
          }
        }
      }
    } else {
      await t.query(
        `UPDATE commerza_partner_subscriptions
         SET status = 'rejected',
             admin_remark = @remark,
             verified_by = @admin,
             updated_at = NOW()
         WHERE id = @id`,
        { id, remark: String(remark || 'Payment verification failed'), admin: req.user.userName || 'admin' }
      );
    }
  });

  res.json({ status: 'true', message: `Subscription ${action === 'approve' ? 'approved and shop unlocked' : 'rejected'}` });
}));

// ---- Shop Verification ---------------------------------------------------------------------
router.get('/api/admin/shops', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const statusFilter = req.query.status; // 'all' | 'pending' | 'verified' | 'rejected'
  let where = '1=1';
  if (statusFilter === 'pending') where = 'COALESCE(pm.isverified, 0) = 0';
  else if (statusFilter === 'verified') where = 'COALESCE(pm.isverified, 0) = 1';
  else if (statusFilter === 'rejected') where = 'COALESCE(pm.isverified, 0) = 2';

  const shops = await db.query(
    DB,
    `SELECT pm.pmid, pm.companyname, pm.mobileno, pm.comemailid, pm.address, pm.pincode,
            pm.areaname, pm.active, pm.isverified, pm.doc,
            ds.local_delivery_enabled, ds.local_pincodes, ds.local_radius_km, ds.local_fee,
            ds.local_eta_text, ds.shiprocket_enabled, ds.delivery_verified,
            sd.latitude, sd.longitude, sd.map_address, sd.city, sd.state, sd.landmark,
            sd.shop_category, sd.gst_number, sd.pan_number, sd.fssai_or_license,
            sd.bank_account_name, sd.bank_account_number, sd.bank_ifsc, sd.upi_id,
            sd.opening_time, sd.closing_time, sd.working_days,
            sd.shop_logo_url, sd.shop_banner_url, sd.is_profile_completed,
            sub.status AS subscription_status, sub.package_name AS subscription_package,
            sub.amount_paid AS subscription_amount_paid, sub.transaction_ref AS subscription_ref
     FROM portal_master pm
     LEFT JOIN commerza_shop_delivery_settings ds ON ds.pmid = pm.pmid
     LEFT JOIN commerza_shop_details sd ON sd.pmid = pm.pmid
     LEFT JOIN LATERAL (
       SELECT status, package_name, amount_paid, transaction_ref
       FROM commerza_partner_subscriptions s
       WHERE s.pmid = pm.pmid
       ORDER BY s.id DESC LIMIT 1
     ) sub ON TRUE
     WHERE ${where}
     ORDER BY pm.pmid DESC`
  );
  res.json({ status: 'true', shops });
}));

router.patch('/api/admin/shops/:pmid/verify', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = parseInt(req.params.pmid, 10);
  const { action, deliveryVerified } = req.body || {}; // action: 'approve' | 'reject'
  const isverified = action === 'approve' ? 1 : action === 'reject' ? 2 : 0;

  const updated = await db.exec(
    DB,
    'UPDATE portal_master SET isverified = @isverified, active = @active WHERE pmid = @pmid',
    { pmid, isverified, active: action !== 'reject' }
  );
  if (!updated) return res.status(404).json({ status: 'false', message: 'Shop not found' });

  await db.query(
    DB,
    `INSERT INTO commerza_shop_delivery_settings (pmid, delivery_verified)
     VALUES (@pmid, @dv)
     ON CONFLICT (pmid) DO UPDATE SET delivery_verified = @dv, updated_at = NOW()`,
    { pmid, dv: deliveryVerified !== undefined ? Boolean(deliveryVerified) : action === 'approve' }
  );

  res.json({ status: 'true', message: `Shop ${action === 'approve' ? 'verified' : 'updated'}`, isverified });
}));

// ---- Product Approval ----------------------------------------------------------------------
router.get('/api/admin/products', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const statusFilter = req.query.status; // 'all' | 'pending' | 'approved' | 'rejected'
  let where = '1=1';
  if (statusFilter === 'pending') where = 'COALESCE(sp.isverified, 0) = 0';
  else if (statusFilter === 'approved') where = 'COALESCE(sp.isverified, 0) = 1';
  else if (statusFilter === 'rejected') where = 'COALESCE(sp.isverified, 0) = 2';

  const products = await db.query(
    DB,
    `SELECT sp.sprid, sp.subprcode, sp.prskucode, sp.mprid, mp.producttitle, mp.productcode, mp.companyid AS pmid,
            pm.companyname, pc.gmid, gm.groupname, mp.catid, pc.catname, mp.subcategoryid, sc.scatname,
            mp.shotdescription, mp.fulldescription, mp.keyfeatures, mp.createddate,
            sp.qty, sp.unit, sp.color, sp.size, sp.sellmrp, sp.dap, sp.discountpercentage,
            sp.cashondelivery, sp.shippingcharges, sp.replacementday, sp.procurementsla, sp.specification,
            sp.productimages, sp.isactive, sp.isverified,
            COALESCE(sp.weight_kg, meta.weight_kg) AS weight_kg,
            COALESCE(sp.length_cms, meta.length_cm) AS length_cm,
            COALESCE(sp.breadth_cms, meta.breadth_cm) AS breadth_cm,
            COALESCE(sp.height_cms, meta.height_cm) AS height_cm,
            COALESCE(NULLIF(sp.hsn, ''), meta.hsn_code) AS hsn_code,
            COALESCE(NULLIF(sp.rejectremark, ''), meta.reject_remark) AS reject_remark
     FROM ims_subproduct sp
     JOIN ims_masterproduct mp ON mp.mprid = sp.mprid
     LEFT JOIN portal_master pm ON pm.pmid = mp.companyid
     LEFT JOIN product_category pc ON pc.catid = mp.catid
     LEFT JOIN tbl_categorygroupmaster gm ON gm.gmid = pc.gmid
     LEFT JOIN product_subcategory sc ON sc.scatid = mp.subcategoryid
     LEFT JOIN commerza_product_meta meta ON meta.sprid = sp.sprid
     WHERE ${where}
     ORDER BY mp.mprid DESC, sp.sprid DESC`
  );

  const sprids = products.map((p) => p.sprid);
  let attrsBySprid = {};
  if (sprids.length > 0) {
    const attrs = await db.query(
      DB,
      'SELECT sprid, title, value FROM ims_masterproductattribute WHERE sprid = ANY(@sprids::bigint[]) ORDER BY position ASC, mpaid ASC',
      { sprids }
    );
    for (const a of attrs) {
      if (!attrsBySprid[a.sprid]) attrsBySprid[a.sprid] = [];
      attrsBySprid[a.sprid].push({ title: a.title, value: a.value });
    }
  }

  const enriched = products.map((p) => {
    const imgs = String(p.productimages || '').split('^').filter(Boolean);
    return {
      ...p,
      thumbnail: imgs[0] || '',
      gallery: imgs,
      attributes: attrsBySprid[p.sprid] || [],
    };
  });

  res.json({ status: 'true', products: enriched });
}));

router.patch('/api/admin/products/:sprid/toggle-active', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const sprid = parseInt(req.params.sprid, 10);
  const active = Boolean(req.body?.isactive);
  const updated = await db.exec(
    DB,
    'UPDATE ims_subproduct SET isactive = @active WHERE sprid = @sprid',
    { sprid, active }
  );
  if (!updated) return res.status(404).json({ status: 'false', message: 'Product not found' });
  res.json({ status: 'true', message: `Product ${active ? 'activated' : 'deactivated'}`, isactive: active });
}));

router.patch('/api/admin/shops/:pmid/toggle-active', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = parseInt(req.params.pmid, 10);
  const active = Boolean(req.body?.active);
  const updated = await db.exec(DB, 'UPDATE portal_master SET active = @active WHERE pmid = @pmid', { pmid, active });
  if (!updated) return res.status(404).json({ status: 'false', message: 'Shop not found' });
  res.json({ status: 'true', message: `Shop ${active ? 'activated' : 'suspended'}`, active });
}));

router.put('/api/admin/shops/:pmid', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = parseInt(req.params.pmid, 10);
  const b = req.body || {};

  await db.tx(DB, async (t) => {
    await t.query(
      `UPDATE portal_master
       SET companyname = COALESCE(@companyName, companyname),
           mobileno = COALESCE(@mobileno, mobileno),
           comemailid = COALESCE(@comemailid, comemailid),
           address = COALESCE(@address, address),
           pincode = COALESCE(@pincode, pincode),
           areaname = COALESCE(@areaName, areaname),
           companydesc = COALESCE(@companyDesc, companydesc)
       WHERE pmid = @pmid`,
      {
        pmid,
        companyName: b.companyname ?? null,
        mobileno: b.mobileno ?? null,
        comemailid: b.comemailid ?? null,
        address: b.address ?? null,
        pincode: b.pincode ?? null,
        areaName: b.areaname ?? null,
        companyDesc: b.companydesc ?? null,
      }
    );

    await t.query(
      `INSERT INTO commerza_shop_details (
         pmid, shop_category, gst_number, pan_number, fssai_or_license,
         bank_account_name, bank_account_number, bank_ifsc, upi_id,
         opening_time, closing_time, working_days, city, state, landmark,
         is_profile_completed, updated_at
       ) VALUES (
         @pmid, @cat, @gst, @pan, @fssai,
         @bankName, @bankAcc, @ifsc, @upi,
         @openTime, @closeTime, @workDays, @city, @state, @landmark,
         TRUE, NOW()
       )
       ON CONFLICT (pmid) DO UPDATE SET
         shop_category = EXCLUDED.shop_category,
         gst_number = EXCLUDED.gst_number,
         pan_number = EXCLUDED.pan_number,
         fssai_or_license = EXCLUDED.fssai_or_license,
         bank_account_name = EXCLUDED.bank_account_name,
         bank_account_number = EXCLUDED.bank_account_number,
         bank_ifsc = EXCLUDED.bank_ifsc,
         upi_id = EXCLUDED.upi_id,
         opening_time = EXCLUDED.opening_time,
         closing_time = EXCLUDED.closing_time,
         working_days = EXCLUDED.working_days,
         city = EXCLUDED.city,
         state = EXCLUDED.state,
         landmark = EXCLUDED.landmark,
         is_profile_completed = TRUE,
         updated_at = NOW()`,
      {
        pmid,
        cat: String(b.shop_category || ''),
        gst: String(b.gst_number || ''),
        pan: String(b.pan_number || ''),
        fssai: String(b.fssai_or_license || ''),
        bankName: String(b.bank_account_name || ''),
        bankAcc: String(b.bank_account_number || ''),
        ifsc: String(b.bank_ifsc || ''),
        upi: String(b.upi_id || ''),
        openTime: String(b.opening_time || '09:00'),
        closeTime: String(b.closing_time || '21:00'),
        workDays: String(b.working_days || 'Mon - Sun'),
        city: String(b.city || ''),
        state: String(b.state || ''),
        landmark: String(b.landmark || ''),
      }
    );
  });

  res.json({ status: 'true', message: 'Shop details updated' });
}));

// ---- Group Categories, Categories & Subcategories ------------------------------------------
router.get('/api/admin/categories', ...guard, asyncHandler(async (_req, res) => {
  await ensureCommerzaSchema();
  const [groups, categories, subcategories] = await Promise.all([
    db.query(DB, 'SELECT gmid, groupname, COALESCE(status, 1) AS status FROM tbl_categorygroupmaster ORDER BY gmid ASC'),
    db.query(
      DB,
      `SELECT c.catid, c.catname, c.catdesc, COALESCE(c.catactive, true) AS active, c.gmid, g.groupname,
              COALESCE(NULLIF(c.image_url, ''), c.catimgname, '') AS image_url
       FROM product_category c
       LEFT JOIN tbl_categorygroupmaster g ON g.gmid = c.gmid
       ORDER BY c.catid ASC`
    ),
    db.query(
      DB,
      `SELECT sc.scatid, sc.scatname, sc.scatdesc, COALESCE(sc.scatactive, true) AS active, sc.catid, c.catname,
              COALESCE(sc.image_url, '') AS image_url
       FROM product_subcategory sc
       LEFT JOIN product_category c ON c.catid = sc.catid
       ORDER BY sc.scatid ASC`
    ),
  ]);
  res.json({ status: 'true', groups, categories, subcategories });
}));

router.post('/api/admin/category-groups', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const groupname = String(req.body?.groupname || '').trim();
  if (!groupname) return res.status(400).json({ status: 'false', message: 'groupname is required' });
  const nextId = await db.scalar(DB, 'SELECT COALESCE(MAX(gmid), 0) + 1 FROM tbl_categorygroupmaster');
  await db.query(
    DB,
    'INSERT INTO tbl_categorygroupmaster (gmid, groupname, status) VALUES (@gmid, @groupname, 1)',
    { gmid: nextId, groupname }
  );
  res.status(201).json({ status: 'true', group: { gmid: Number(nextId), groupname, status: 1 } });
}));

router.patch('/api/admin/category-groups/:gmid', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const gmid = parseInt(req.params.gmid, 10);
  const { groupname, status } = req.body || {};
  const updated = await db.exec(
    DB,
    `UPDATE tbl_categorygroupmaster
     SET groupname = COALESCE(@groupname, groupname),
         status = COALESCE(@status, status)
     WHERE gmid = @gmid`,
    { gmid, groupname: groupname ?? null, status: status !== undefined ? Number(status) : null }
  );
  if (!updated) return res.status(404).json({ status: 'false', message: 'Group category not found' });
  res.json({ status: 'true', message: 'Group category updated' });
}));

router.post('/api/admin/categories', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const catname = String(req.body?.catname || '').trim();
  const gmid = req.body?.gmid ? parseInt(req.body.gmid, 10) : null;
  if (!catname) return res.status(400).json({ status: 'false', message: 'catname is required' });
  const nextId = await db.scalar(DB, 'SELECT COALESCE(MAX(catid), 0) + 1 FROM product_category');
  await db.query(
    DB,
    'INSERT INTO product_category (catid, catname, catactive, gmid) VALUES (@catid, @catname, true, @gmid)',
    { catid: nextId, catname, gmid }
  );
  res.status(201).json({ status: 'true', category: { catid: Number(nextId), catname, gmid, active: true } });
}));

router.patch('/api/admin/categories/:catid', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const catid = parseInt(req.params.catid, 10);
  const { catname, active, gmid } = req.body || {};
  const updated = await db.exec(
    DB,
    `UPDATE product_category
     SET catname = COALESCE(@catname, catname),
         catactive = COALESCE(@active, catactive),
         gmid = COALESCE(@gmid, gmid)
     WHERE catid = @catid`,
    {
      catid,
      catname: catname ?? null,
      active: active !== undefined ? Boolean(active) : null,
      gmid: gmid !== undefined ? parseInt(gmid, 10) : null,
    }
  );
  if (!updated) return res.status(404).json({ status: 'false', message: 'Category not found' });
  res.json({ status: 'true', message: 'Category updated' });
}));

router.post('/api/admin/subcategories', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const scatname = String(req.body?.scatname || '').trim();
  const catid = parseInt(req.body?.catid || 0, 10);
  const imageUrl = String(req.body?.image_url || '').trim();
  if (!scatname || !catid) return res.status(400).json({ status: 'false', message: 'scatname and catid are required' });
  const nextId = await db.scalar(DB, 'SELECT COALESCE(MAX(scatid), 0) + 1 FROM product_subcategory');
  await db.query(
    DB,
    'INSERT INTO product_subcategory (scatid, scatname, scatactive, catid, image_url) VALUES (@scatid, @scatname, true, @catid, @imageUrl)',
    { scatid: nextId, scatname, catid, imageUrl }
  );
  res.status(201).json({ status: 'true', subcategory: { scatid: Number(nextId), scatname, catid, image_url: imageUrl, active: true } });
}));

router.patch('/api/admin/subcategories/:scatid', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const scatid = parseInt(req.params.scatid, 10);
  const { scatname, active, catid, image_url } = req.body || {};
  const updated = await db.exec(
    DB,
    `UPDATE product_subcategory
     SET scatname = COALESCE(@scatname, scatname),
         scatactive = COALESCE(@active, scatactive),
         catid = COALESCE(@catid, catid),
         image_url = COALESCE(@imageUrl, image_url)
     WHERE scatid = @scatid`,
    {
      scatid,
      scatname: scatname ?? null,
      active: active !== undefined ? Boolean(active) : null,
      catid: catid !== undefined ? parseInt(catid, 10) : null,
      imageUrl: image_url ?? null,
    }
  );
  if (!updated) return res.status(404).json({ status: 'false', message: 'Subcategory not found' });
  res.json({ status: 'true', message: 'Subcategory updated' });
}));

router.patch('/api/admin/products/:sprid/review', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const sprid = parseInt(req.params.sprid, 10);
  const { action, remark = '' } = req.body || {}; // 'approve' | 'reject'
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ status: 'false', message: "action must be 'approve' or 'reject'" });
  }

  const isverified = action === 'approve' ? 1 : 2;
  const isactive = action === 'approve';
  const updated = await db.exec(
    DB,
    'UPDATE ims_subproduct SET isverified = @isverified, isactive = @isactive WHERE sprid = @sprid',
    { sprid, isverified, isactive }
  );
  if (!updated) return res.status(404).json({ status: 'false', message: 'Product not found' });

  await db.query(
    DB,
    `UPDATE commerza_product_meta SET reject_remark = @remark, updated_at = NOW() WHERE sprid = @sprid`,
    { sprid, remark: action === 'reject' ? String(remark) : '' }
  );

  res.json({ status: 'true', message: `Product ${action === 'approve' ? 'approved' : 'rejected'}`, isverified });
}));

// ---- Orders & Disputes ---------------------------------------------------------------------
router.get('/api/admin/orders', ...guard, asyncHandler(async (_req, res) => {
  await ensureCommerzaSchema();
  const orders = await db.query(
    DB,
    `SELECT o.*, pm.companyname,
            s.provider, s.awb_code, s.courier_name, s.status AS shipment_status, s.tracking_url
     FROM commerza_orders o
     LEFT JOIN portal_master pm ON pm.pmid = o.pmid
     LEFT JOIN LATERAL (
       SELECT * FROM commerza_shipments sh WHERE sh.order_id = o.id ORDER BY sh.id DESC LIMIT 1
     ) s ON TRUE
     ORDER BY o.id DESC`
  );
  res.json({ status: 'true', orders });
}));

router.patch('/api/admin/orders/:id/status', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const id = parseInt(req.params.id, 10);
  const status = String(req.body?.status || '').trim();
  const updated = await db.exec(
    DB,
    'UPDATE commerza_orders SET fulfillment_status = @status, updated_at = NOW() WHERE id = @id',
    { id, status }
  );
  if (!updated) return res.status(404).json({ status: 'false', message: 'Order not found' });
  res.json({ status: 'true', message: 'Order status updated' });
}));

router.get('/api/admin/disputes', ...guard, asyncHandler(async (_req, res) => {
  await ensureCommerzaSchema();
  const disputes = await db.query(
    DB,
    `SELECT d.*, pm.companyname, o.order_number
     FROM commerza_disputes d
     LEFT JOIN portal_master pm ON pm.pmid = d.pmid
     LEFT JOIN commerza_orders o ON o.id = d.order_id
     ORDER BY d.id DESC`
  );
  res.json({ status: 'true', disputes });
}));

router.post('/api/admin/disputes', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const { orderId, pmid, raisedBy = 'admin', subject, description = '' } = req.body || {};
  if (!subject) return res.status(400).json({ status: 'false', message: 'subject is required' });
  const row = await db.queryOne(
    DB,
    `INSERT INTO commerza_disputes (order_id, pmid, raised_by, subject, description)
     VALUES (@orderId, @pmid, @raisedBy, @subject, @description) RETURNING *`,
    { orderId: orderId || null, pmid: pmid || null, raisedBy, subject, description }
  );
  res.status(201).json({ status: 'true', dispute: row });
}));

router.patch('/api/admin/disputes/:id', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const id = parseInt(req.params.id, 10);
  const { status = 'resolved', resolutionNote = '' } = req.body || {};
  const updated = await db.exec(
    DB,
    `UPDATE commerza_disputes SET status = @status, resolution_note = @note, updated_at = NOW() WHERE id = @id`,
    { id, status, note: resolutionNote }
  );
  if (!updated) return res.status(404).json({ status: 'false', message: 'Dispute not found' });
  res.json({ status: 'true', message: 'Dispute updated' });
}));

// ---- Admin Staff Users & Roles -------------------------------------------------------------
router.get('/api/admin/users', ...guard, asyncHandler(async (_req, res) => {
  await ensureCommerzaSchema();
  const users = await db.query(
    DB,
    'SELECT id, full_name, email, phone, role, is_active, created_at FROM commerza_admin_users ORDER BY id DESC'
  );
  res.json({ status: 'true', users });
}));

router.post('/api/admin/users', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const { fullName, email, phone = '', password, role = 'moderator' } = req.body || {};
  if (!fullName || !email || !password) {
    return res.status(400).json({ status: 'false', message: 'fullName, email, and password are required' });
  }
  const allowedRoles = ['super_admin', 'moderator', 'finance', 'support'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ status: 'false', message: `Invalid role. Allowed: ${allowedRoles.join(', ')}` });
  }
  const row = await db.queryOne(
    DB,
    `INSERT INTO commerza_admin_users (full_name, email, phone, password, role)
     VALUES (@name, @email, @phone, @pw, @role)
     RETURNING id, full_name, email, phone, role, is_active, created_at`,
    { name: String(fullName).trim(), email: String(email).trim(), phone: String(phone), pw: String(password), role }
  );
  res.status(201).json({ status: 'true', user: row });
}));

router.patch('/api/admin/users/:id', ...guard, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { role, is_active } = req.body || {};
  const updated = await db.exec(
    DB,
    `UPDATE commerza_admin_users
     SET role = COALESCE(@role, role),
         is_active = COALESCE(@active, is_active)
     WHERE id = @id`,
    { id, role: role ?? null, active: is_active !== undefined ? Boolean(is_active) : null }
  );
  if (!updated) return res.status(404).json({ status: 'false', message: 'Admin user not found' });
  res.json({ status: 'true', message: 'Admin user updated' });
}));

router.delete('/api/admin/users/:id', ...guard, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.exec(DB, 'DELETE FROM commerza_admin_users WHERE id = @id', { id });
  res.json({ status: 'true', message: 'Admin user removed' });
}));

// ---- Admin Coupons Monitor -----------------------------------------------------------------
router.get('/api/admin/coupons', ...guard, asyncHandler(async (_req, res) => {
  await ensureCommerzaSchema();
  const coupons = await db.query(
    DB,
    `SELECT c.*, pm.companyname, mp.producttitle
     FROM commerza_coupons c
     LEFT JOIN portal_master pm ON pm.pmid = c.pmid
     LEFT JOIN ims_masterproduct mp ON mp.mprid = c.mprid
     ORDER BY c.id DESC`
  );
  res.json({ status: 'true', coupons });
}));

router.patch('/api/admin/coupons/:id/toggle', ...guard, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const active = Boolean(req.body?.is_active);
  const updated = await db.exec(DB, 'UPDATE commerza_coupons SET is_active = @active WHERE id = @id', { id, active });
  if (!updated) return res.status(404).json({ status: 'false', message: 'Coupon not found' });
  res.json({ status: 'true', message: 'Coupon updated' });
}));

// ---- Admin Top-Up Wallet Approvals ---------------------------------------------------------
router.get('/api/admin/topups', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const statusFilter = req.query.status || 'all';
  let where = '1=1';
  if (['pending', 'approved', 'rejected'].includes(String(statusFilter))) {
    where = 't.status = @statusFilter';
  }
  const topups = await db.query(
    DB,
    `SELECT t.*, pm.companyname, pm.comemailid, pm.mobileno
     FROM commerza_partner_topup_requests t
     LEFT JOIN portal_master pm ON pm.pmid = t.pmid
     WHERE ${where}
     ORDER BY t.id DESC`,
    { statusFilter }
  );
  res.json({ status: 'true', topups });
}));

router.patch('/api/admin/topups/:id/review', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const id = parseInt(req.params.id, 10);
  const { action, verifiedAmount, remark = '' } = req.body || {};
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ status: 'false', message: "action must be 'approve' or 'reject'" });
  }

  const reqRow = await db.queryOne(DB, 'SELECT * FROM commerza_partner_topup_requests WHERE id = @id', { id });
  if (!reqRow) return res.status(404).json({ status: 'false', message: 'Top-up request not found' });
  if (reqRow.status === 'approved') {
    return res.status(409).json({ status: 'false', message: 'Top-up request is already approved' });
  }

  await db.tx(DB, async (t) => {
    if (action === 'approve') {
      const amount = verifiedAmount !== undefined ? Number(verifiedAmount) : Number(reqRow.amount);
      await t.query(
        `UPDATE commerza_partner_topup_requests
         SET status = 'approved', amount = @amount, admin_remark = @remark, verified_by = @admin, updated_at = NOW()
         WHERE id = @id`,
        { id, amount, remark: String(remark), admin: req.user.userName || 'admin' }
      );
      await t.query(
        `INSERT INTO commerza_partner_wallet_tx (pmid, wallet_type, tx_type, category, amount, description, status)
         VALUES (@pmid, 'topup', 'credit', 'topup', @amount, @desc, 'completed')`,
        {
          pmid: reqRow.pmid,
          amount,
          desc: `Wallet Top-Up approved (Ref: ${reqRow.transaction_ref})`,
        }
      );
    } else {
      await t.query(
        `UPDATE commerza_partner_topup_requests
         SET status = 'rejected', admin_remark = @remark, verified_by = @admin, updated_at = NOW()
         WHERE id = @id`,
        { id, remark: String(remark || 'Payment verification failed'), admin: req.user.userName || 'admin' }
      );
    }
  });

  res.json({ status: 'true', message: `Top-up ${action === 'approve' ? 'approved and credited to wallet' : 'rejected'}` });
}));

// ---- Unified Member & Shop Management (Every Shop IS a Member) ------------------------------
router.get('/api/admin/members', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const filter = String(req.query.filter || 'all').toLowerCase();
  let where = '1=1';
  if (filter === 'paid') {
    where = "sub.status = 'approved' AND COALESCE(pm.active, true) = true";
  } else if (filter === 'free') {
    where = "COALESCE(sub.status, '') != 'approved' AND COALESCE(pm.active, true) = true";
  } else if (filter === 'blocked') {
    where = 'COALESCE(pm.active, true) = false';
  }

  const members = await db.query(
    DB,
    `SELECT pm.pmid,
            COALESCE(NULLIF(pl.referalcode, ''), 'CMZ-P' || pm.pmid::text) AS username,
            pm.companyname AS shop_name,
            TRIM(CONCAT(COALESCE(pl.fname, ''), ' ', COALESCE(pl.lname, ''))) AS owner_name,
            pm.mobileno,
            COALESCE(NULLIF(pm.comemailid, ''), pl.emailid, '') AS email,
            pm.address,
            pm.pincode,
            pm.areaname,
            COALESCE(pm.active, true) AS active,
            COALESCE(pm.isverified, 0) AS isverified,
            pm.doc AS join_date,
            COALESCE(NULLIF(pl.refral_id, ''), sp_ref.referalcode, '') AS sponsor_username,
            COALESCE(sp_ref.referalcode, NULLIF(pl.refral_id, ''), '') AS parent_username,
            sd.city, sd.state, sd.gst_number, sd.pan_number, sd.fssai_or_license,
            sd.bank_account_name, sd.bank_account_number, sd.bank_ifsc, sd.upi_id,
            sd.shop_logo_url, sd.shop_banner_url, sd.is_profile_completed,
            COALESCE(sd.block_remark, '') AS block_remark,
            COALESCE(sd.kyc_mode, 'ONLINE') AS kyc_mode,
            COALESCE(sd.kyc_photo_status, 'PENDING') AS kyc_photo_status,
            COALESCE(sd.kyc_id_status, 'PENDING') AS kyc_id_status,
            COALESCE(sd.kyc_tax_status, 'PENDING') AS kyc_tax_status,
            COALESCE(sd.kyc_bank_status, 'PENDING') AS kyc_bank_status,
            COALESCE(sd.kyc_profile_status, 'PENDING') AS kyc_profile_status,
            COALESCE(sd.kyc_all_status, 'PENDING') AS kyc_all_status,
            sd.kyc_approved_at,
            COALESCE(sd.kyc_remark, '') AS kyc_remark,
            sub.id AS subscription_id,
            sub.package_id,
            COALESCE(sub.package_name, '') AS package_name,
            COALESCE(sub.amount_paid, 0)::numeric(12,2) AS package_amount,
            sub.status AS subscription_status,
            sub.starts_at AS activation_date,
            COALESCE(wt.topup_balance, 0)::numeric(12,2) AS topup_balance,
            COALESCE(wt.income_balance, 0)::numeric(12,2) AS income_balance,
            COALESCE(wt.cp_points, 0)::numeric(12,2) AS cp_points
     FROM portal_master pm
     LEFT JOIN LATERAL (
       SELECT plid, pmid, emailid, fname, lname, referalcode, intro_plid, refral_id
       FROM portal_login l
       WHERE l.pmid = pm.pmid
       ORDER BY l.plid ASC LIMIT 1
     ) pl ON TRUE
     LEFT JOIN portal_login sp_ref ON sp_ref.plid = pl.intro_plid
     LEFT JOIN commerza_shop_details sd ON sd.pmid = pm.pmid
     LEFT JOIN LATERAL (
       SELECT id, package_id, package_name, amount_paid, status, starts_at
       FROM commerza_partner_subscriptions s
       WHERE s.pmid = pm.pmid AND s.status = 'approved'
       ORDER BY s.id DESC LIMIT 1
     ) sub ON TRUE
     LEFT JOIN LATERAL (
       SELECT
         COALESCE(SUM(CASE WHEN wallet_type = 'topup' AND status != 'rejected' THEN (CASE WHEN tx_type = 'credit' THEN amount ELSE -amount END) ELSE 0 END), 0) AS topup_balance,
         COALESCE(SUM(CASE WHEN wallet_type = 'income' AND status != 'rejected' THEN (CASE WHEN tx_type = 'credit' THEN amount ELSE -amount END) ELSE 0 END), 0) AS income_balance,
         COALESCE(SUM(CASE WHEN wallet_type = 'income' AND tx_type = 'credit' AND status != 'rejected' THEN amount ELSE 0 END), 0) AS cp_points
       FROM commerza_partner_wallet_tx w
       WHERE w.pmid = pm.pmid
     ) wt ON TRUE
     WHERE ${where}
     ORDER BY pm.pmid DESC`
  );

  res.json({ status: 'true', members });
}));

router.patch('/api/admin/members/:pmid/block', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = parseInt(req.params.pmid, 10);
  const { active, remark = '' } = req.body || {};
  const isActive = Boolean(active);

  await db.tx(DB, async (t) => {
    const updated = await t.exec('UPDATE portal_master SET active = @active WHERE pmid = @pmid', { pmid, active: isActive });
    if (!updated) {
      const err = new Error('Shop/Member not found');
      err.status = 404;
      throw err;
    }
    await t.query('UPDATE portal_login SET active = @active, isactive = @active WHERE pmid = @pmid', { pmid, active: isActive });
    await t.query(
      `INSERT INTO commerza_shop_details (pmid, block_remark, updated_at)
       VALUES (@pmid, @remark, NOW())
       ON CONFLICT (pmid) DO UPDATE SET block_remark = @remark, updated_at = NOW()`,
      { pmid, remark: isActive ? '' : String(remark || 'Blocked by admin') }
    );
  });

  res.json({ status: 'true', message: `Member/Shop ${isActive ? 'unblocked' : 'blocked'}`, active: isActive });
}));

router.patch('/api/admin/members/:pmid/kyc', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = parseInt(req.params.pmid, 10);
  const b = req.body || {};
  const action = String(b.action || 'update');

  const existing = await db.queryOne(DB, 'SELECT * FROM commerza_shop_details WHERE pmid = @pmid', { pmid });
  const norm = (val, fallback) => {
    const u = String(val || fallback || 'PENDING').toUpperCase();
    return ['PENDING', 'APPROVED', 'REJECTED'].includes(u) ? u : 'PENDING';
  };

  let photo = norm(b.photo, existing?.kyc_photo_status);
  let idProof = norm(b.id_proof, existing?.kyc_id_status);
  let tax = norm(b.tax, existing?.kyc_tax_status);
  let bank = norm(b.bank, existing?.kyc_bank_status);
  let profile = norm(b.profile, existing?.kyc_profile_status);

  if (action === 'approve_all') {
    photo = idProof = tax = bank = profile = 'APPROVED';
  } else if (action === 'reject_all') {
    photo = idProof = tax = bank = profile = 'REJECTED';
  }

  const statuses = [photo, idProof, tax, bank, profile];
  const allStatus = statuses.every((s) => s === 'APPROVED')
    ? 'APPROVED'
    : statuses.some((s) => s === 'REJECTED')
      ? 'REJECTED'
      : 'PENDING';

  const kycMode = String(b.kycMode || existing?.kyc_mode || 'ONLINE').toUpperCase();
  const remark = String(b.remark ?? existing?.kyc_remark ?? '');
  const approvedAt = allStatus === 'APPROVED' ? (existing?.kyc_approved_at || new Date()) : null;

  await db.tx(DB, async (t) => {
    await t.query(
      `INSERT INTO commerza_shop_details (
         pmid, kyc_mode, kyc_photo_status, kyc_id_status, kyc_tax_status,
         kyc_bank_status, kyc_profile_status, kyc_all_status, kyc_approved_at, kyc_remark, updated_at
       ) VALUES (
         @pmid, @kycMode, @photo, @idProof, @tax,
         @bank, @profile, @allStatus, @approvedAt, @remark, NOW()
       )
       ON CONFLICT (pmid) DO UPDATE SET
         kyc_mode = EXCLUDED.kyc_mode,
         kyc_photo_status = EXCLUDED.kyc_photo_status,
         kyc_id_status = EXCLUDED.kyc_id_status,
         kyc_tax_status = EXCLUDED.kyc_tax_status,
         kyc_bank_status = EXCLUDED.kyc_bank_status,
         kyc_profile_status = EXCLUDED.kyc_profile_status,
         kyc_all_status = EXCLUDED.kyc_all_status,
         kyc_approved_at = EXCLUDED.kyc_approved_at,
         kyc_remark = EXCLUDED.kyc_remark,
         updated_at = NOW()`,
      { pmid, kycMode, photo, idProof, tax, bank, profile, allStatus, approvedAt, remark }
    );
    if (allStatus === 'APPROVED') {
      await t.query('UPDATE portal_master SET isverified = 1 WHERE pmid = @pmid', { pmid });
    }
  });

  res.json({
    status: 'true',
    message: `KYC updated (${allStatus})`,
    kyc: { photo, id_proof: idProof, tax, bank, profile, all_status: allStatus },
  });
}));

router.post('/api/admin/members/change-password', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const { username, passwordType = 'login', newPassword } = req.body || {};
  const uname = String(username || '').trim();
  if (!uname || !newPassword || String(newPassword).length < 4) {
    return res.status(400).json({ status: 'false', message: 'Valid username and newPassword (min 4 chars) are required' });
  }

  const loginRow = await db.queryOne(
    DB,
    `SELECT plid, pmid, loginid, emailid, referalcode
     FROM portal_login
     WHERE upper(COALESCE(referalcode, '')) = upper(@u)
        OR lower(COALESCE(loginid, '')) = lower(@u)
        OR lower(COALESCE(emailid, '')) = lower(@u)
        OR ('CMZ-P' || pmid::text) = upper(@u)
        OR pmid::text = @u
     LIMIT 1`,
    { u: uname }
  );
  if (!loginRow) {
    return res.status(404).json({ status: 'false', message: `Member/Shop '${uname}' not found` });
  }

  const enc = Encryptword(String(newPassword)) || String(newPassword);
  await db.exec(DB, 'UPDATE portal_login SET password = @enc WHERE plid = @plid', { enc, plid: loginRow.plid });

  res.json({
    status: 'true',
    message: `${passwordType === 'transaction' ? 'Transaction' : 'Login'} password updated for ${loginRow.referalcode || `CMZ-P${loginRow.pmid}`}`,
  });
}));

router.get('/api/admin/members/downline', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmidParam = String(req.query.pmid || '').trim();
  const pmid = pmidParam && pmidParam !== 'all' ? parseInt(pmidParam, 10) : null;

  const downline = await db.query(
    DB,
    `SELECT pm.pmid,
            pm.companyname AS name,
            COALESCE(NULLIF(pl.referalcode, ''), 'CMZ-P' || pm.pmid::text) AS username,
            COALESCE(sub.amount_paid, 0)::numeric(12,2) AS amount,
            COALESCE(sd.state, '') AS statename,
            COALESCE(sd.city, pm.areaname, '') AS cityname,
            pm.mobileno AS mobile_no,
            pm.doc AS joining_date,
            sub.starts_at AS activation_date,
            COALESCE(cp.cp_points, 0)::numeric(12,2) AS c_points,
            COALESCE(parent_pl.referalcode, NULLIF(pl.refral_id, ''), '') AS sponsor_username
     FROM portal_login pl
     JOIN portal_master pm ON pm.pmid = pl.pmid
     LEFT JOIN portal_login parent_pl ON parent_pl.plid = pl.intro_plid
     LEFT JOIN commerza_shop_details sd ON sd.pmid = pm.pmid
     LEFT JOIN LATERAL (
       SELECT amount_paid, starts_at
       FROM commerza_partner_subscriptions s
       WHERE s.pmid = pm.pmid AND s.status = 'approved'
       ORDER BY s.id DESC LIMIT 1
     ) sub ON TRUE
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(amount), 0) AS cp_points
       FROM commerza_partner_wallet_tx w
       WHERE w.pmid = pm.pmid AND w.wallet_type = 'income' AND w.tx_type = 'credit' AND w.status != 'rejected'
     ) cp ON TRUE
     WHERE (@pmid::bigint IS NULL AND pl.intro_plid IS NOT NULL)
        OR (@pmid::bigint IS NOT NULL AND parent_pl.pmid = @pmid::bigint)
     ORDER BY pm.pmid DESC`,
    { pmid }
  );

  const totalBv = downline.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  res.json({ status: 'true', downline, totalBv });
}));

router.get('/api/admin/members/generation', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const rootPmidParam = String(req.query.pmid || '').trim();
  const rootPmid = rootPmidParam && rootPmidParam !== 'all' ? parseInt(rootPmidParam, 10) : null;

  const generations = await db.query(
    DB,
    `WITH RECURSIVE tree AS (
       SELECT pl.plid, pl.pmid, pl.intro_plid,
              COALESCE(NULLIF(pl.referalcode, ''), 'CMZ-P' || pl.pmid::text) AS username,
              CAST(COALESCE(parent_pl.referalcode, NULLIF(pl.refral_id, ''), '') AS VARCHAR(120)) AS parent_username,
              1 AS level
       FROM portal_login pl
       LEFT JOIN portal_login parent_pl ON parent_pl.plid = pl.intro_plid
       WHERE (@rootPmid::bigint IS NULL AND pl.intro_plid IS NULL)
          OR (@rootPmid::bigint IS NOT NULL AND parent_pl.pmid = @rootPmid::bigint)
       UNION ALL
       SELECT c.plid, c.pmid, c.intro_plid,
              COALESCE(NULLIF(c.referalcode, ''), 'CMZ-P' || c.pmid::text) AS username,
              CAST(t.username AS VARCHAR(120)) AS parent_username,
              t.level + 1 AS level
       FROM portal_login c
       JOIN tree t ON c.intro_plid = t.plid
       WHERE t.level < 10
     )
     SELECT t.pmid AS userid,
            t.username,
            pm.companyname AS name,
            t.parent_username,
            t.level,
            pm.doc AS join_date,
            sub.starts_at AS activation_date,
            COALESCE(sub.package_name, 'Free') AS package_name,
            COALESCE(sub.amount_paid, 0)::numeric(12,2) AS package_amount,
            COALESCE(cp.cp_points, 0)::numeric(12,2) AS cp_points
     FROM tree t
     JOIN portal_master pm ON pm.pmid = t.pmid
     LEFT JOIN LATERAL (
       SELECT package_name, amount_paid, starts_at
       FROM commerza_partner_subscriptions s
       WHERE s.pmid = pm.pmid AND s.status = 'approved'
       ORDER BY s.id DESC LIMIT 1
     ) sub ON TRUE
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(amount), 0) AS cp_points
       FROM commerza_partner_wallet_tx w
       WHERE w.pmid = pm.pmid AND w.wallet_type = 'income' AND w.tx_type = 'credit' AND w.status != 'rejected'
     ) cp ON TRUE
     ORDER BY t.level ASC, t.pmid DESC`,
    { rootPmid }
  );

  res.json({ status: 'true', generations });
}));

router.get('/api/admin/members/binary-tree', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmidParam = String(req.query.pmid || '').trim();
  let rootRow = null;
  if (pmidParam && pmidParam !== 'all') {
    rootRow = await db.queryOne(
      DB,
      'SELECT plid, pmid FROM portal_login WHERE pmid = @pmid ORDER BY plid ASC LIMIT 1',
      { pmid: parseInt(pmidParam, 10) }
    );
  } else {
    rootRow = await db.queryOne(
      DB,
      'SELECT plid, pmid FROM portal_login ORDER BY plid ASC LIMIT 1'
    );
  }
  if (!rootRow) return res.json({ status: 'true', rootPlid: null, nodes: [], summary: { leftCount: 0, rightCount: 0, leftBv: 0, rightBv: 0 } });

  const nodes = await db.query(
    DB,
    `WITH RECURSIVE btree AS (
       SELECT pl.plid, pl.pmid, COALESCE(pl.parent_plid, pl.intro_plid) AS parent_plid,
              pl.intro_plid,
              CASE WHEN pl.communityside = 2 THEN 'Right' WHEN pl.communityside = 1 THEN 'Left' ELSE '' END AS side,
              COALESCE(NULLIF(pl.referalcode, ''), 'CMZ-P' || pl.pmid::text) AS username,
              CAST('' AS VARCHAR(20)) AS root_leg,
              0 AS level
       FROM portal_login pl
       WHERE pl.plid = @rootPlid
       UNION ALL
       SELECT c.plid, c.pmid, COALESCE(c.parent_plid, c.intro_plid) AS parent_plid,
              c.intro_plid,
              CASE WHEN c.communityside = 2 THEN 'Right' ELSE 'Left' END AS side,
              COALESCE(NULLIF(c.referalcode, ''), 'CMZ-P' || c.pmid::text) AS username,
              CAST(CASE WHEN b.level = 0 THEN (CASE WHEN c.communityside = 2 THEN 'Right' ELSE 'Left' END) ELSE b.root_leg END AS VARCHAR(20)) AS root_leg,
              b.level + 1 AS level
       FROM portal_login c
       JOIN btree b ON COALESCE(c.parent_plid, c.intro_plid) = b.plid
       WHERE b.level < 8
     )
     SELECT bt.plid, bt.pmid, bt.parent_plid, bt.intro_plid, bt.side, bt.username, bt.root_leg, bt.level,
            pm.companyname AS shop_name, pm.isverified, COALESCE(pm.active, true) AS active,
            COALESCE(sp.referalcode, '') AS sponsor_username,
            COALESCE(sub.package_name, 'Free') AS package_name,
            COALESCE(sub.amount_paid, 0)::numeric(12,2) AS package_amount
     FROM btree bt
     JOIN portal_master pm ON pm.pmid = bt.pmid
     LEFT JOIN portal_login sp ON sp.plid = bt.intro_plid
     LEFT JOIN LATERAL (
       SELECT package_name, amount_paid
       FROM commerza_partner_subscriptions s
       WHERE s.pmid = pm.pmid AND s.status = 'approved'
       ORDER BY s.id DESC LIMIT 1
     ) sub ON TRUE
     ORDER BY bt.level ASC, bt.side ASC, bt.plid ASC`,
    { rootPlid: rootRow.plid }
  );

  const descendants = nodes.filter((n) => n.level > 0);
  const leftNodes = descendants.filter((n) => String(n.root_leg).toLowerCase() === 'left');
  const rightNodes = descendants.filter((n) => String(n.root_leg).toLowerCase() === 'right');

  res.json({
    status: 'true',
    rootPlid: Number(rootRow.plid),
    rootPmid: Number(rootRow.pmid),
    summary: {
      leftCount: leftNodes.length,
      rightCount: rightNodes.length,
      leftBv: leftNodes.reduce((s, n) => s + Number(n.package_amount || 0), 0),
      rightBv: rightNodes.reduce((s, n) => s + Number(n.package_amount || 0), 0),
    },
    nodes,
  });
}));

// ---- Units & Category Attributes Master ----------------------------------------------------
router.get('/api/admin/units', ...guard, asyncHandler(async (_req, res) => {
  await ensureCommerzaSchema();
  const units = await db.query(DB, 'SELECT * FROM commerza_units ORDER BY sort_order ASC, id ASC');
  res.json({ status: 'true', units });
}));

router.post('/api/admin/units', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const {
    code,
    name,
    symbol,
    unit_group = 'count',
    base_unit_code = '',
    conversion_factor = 1,
    sort_order = 0,
  } = req.body || {};
  const cleanCode = String(code || '').trim().toLowerCase();
  if (!cleanCode || !name) {
    return res.status(400).json({ status: 'false', message: 'code and name are required' });
  }
  const unit = await db.queryOne(
    DB,
    `INSERT INTO commerza_units (code, name, symbol, unit_group, base_unit_code, conversion_factor, sort_order)
     VALUES (@code, @name, @symbol, @group, @base, @factor, @order)
     RETURNING *`,
    {
      code: cleanCode,
      name: String(name).trim(),
      symbol: String(symbol || cleanCode).trim(),
      group: String(unit_group || 'count'),
      base: String(base_unit_code || ''),
      factor: Number(conversion_factor || 1),
      order: parseInt(sort_order || 0, 10),
    }
  );
  res.status(201).json({ status: 'true', unit });
}));

router.put('/api/admin/units/:id', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const id = parseInt(req.params.id, 10);
  const { name, symbol, unit_group, base_unit_code, conversion_factor, sort_order, is_active } = req.body || {};
  const unit = await db.queryOne(
    DB,
    `UPDATE commerza_units
     SET name = COALESCE(@name, name),
         symbol = COALESCE(@symbol, symbol),
         unit_group = COALESCE(@group, unit_group),
         base_unit_code = COALESCE(@base, base_unit_code),
         conversion_factor = COALESCE(@factor, conversion_factor),
         sort_order = COALESCE(@order, sort_order),
         is_active = COALESCE(@active, is_active)
     WHERE id = @id
     RETURNING *`,
    {
      id,
      name: name ?? null,
      symbol: symbol ?? null,
      group: unit_group ?? null,
      base: base_unit_code ?? null,
      factor: conversion_factor !== undefined ? Number(conversion_factor) : null,
      order: sort_order !== undefined ? parseInt(sort_order, 10) : null,
      active: is_active !== undefined ? Boolean(is_active) : null,
    }
  );
  if (!unit) return res.status(404).json({ status: 'false', message: 'Unit not found' });
  res.json({ status: 'true', unit });
}));

router.patch('/api/admin/units/:id/toggle', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const id = parseInt(req.params.id, 10);
  const active = Boolean(req.body?.is_active);
  const updated = await db.exec(DB, 'UPDATE commerza_units SET is_active = @active WHERE id = @id', { id, active });
  if (!updated) return res.status(404).json({ status: 'false', message: 'Unit not found' });
  res.json({ status: 'true', message: 'Unit status updated' });
}));

router.get('/api/admin/categories/:catid/catalog-rules', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const catid = parseInt(req.params.catid, 10);
  const [unitLinks, sizeLinks, attributes] = await Promise.all([
    db.query(
      DB,
      `SELECT cu.unit_id, cu.is_default, u.code, u.name, u.symbol
       FROM commerza_category_units cu
       JOIN commerza_units u ON u.id = cu.unit_id
       WHERE cu.catid = @catid
       ORDER BY u.sort_order ASC, u.id ASC`,
      { catid }
    ),
    db.query(
      DB,
      `SELECT cs.size_id, cs.is_default, s.code, s.name, s.size_group
       FROM commerza_category_sizes cs
       JOIN commerza_sizes s ON s.id = cs.size_id
       WHERE cs.catid = @catid
       ORDER BY s.sort_order ASC, s.id ASC`,
      { catid }
    ),
    db.query(
      DB,
      `SELECT * FROM commerza_category_attributes
       WHERE catid = @catid
       ORDER BY sort_order ASC, id ASC`,
      { catid }
    ),
  ]);
  res.json({ status: 'true', catid, unitLinks, sizeLinks, attributes });
}));

router.get('/api/admin/sizes', ...guard, asyncHandler(async (_req, res) => {
  await ensureCommerzaSchema();
  const sizes = await db.query(DB, 'SELECT * FROM commerza_sizes ORDER BY sort_order ASC, id ASC');
  res.json({ status: 'true', sizes });
}));

router.post('/api/admin/sizes', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const { code, name, size_group = 'general', sort_order = 0 } = req.body || {};
  const cleanCode = String(code || '').trim();
  if (!cleanCode) {
    return res.status(400).json({ status: 'false', message: 'size code is required' });
  }
  const size = await db.queryOne(
    DB,
    `INSERT INTO commerza_sizes (code, name, size_group, sort_order)
     VALUES (@code, @name, @group, @order)
     RETURNING *`,
    {
      code: cleanCode,
      name: String(name || cleanCode).trim(),
      group: String(size_group || 'general'),
      order: parseInt(sort_order || 0, 10),
    }
  );
  res.status(201).json({ status: 'true', size });
}));

router.patch('/api/admin/sizes/:id/toggle', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const id = parseInt(req.params.id, 10);
  const active = Boolean(req.body?.is_active);
  const updated = await db.exec(DB, 'UPDATE commerza_sizes SET is_active = @active WHERE id = @id', { id, active });
  if (!updated) return res.status(404).json({ status: 'false', message: 'Size not found' });
  res.json({ status: 'true', message: 'Size status updated' });
}));

router.put('/api/admin/categories/:catid/sizes', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const catid = parseInt(req.params.catid, 10);
  const { sizeIds = [], defaultSizeId = null } = req.body || {};
  await db.tx(DB, async (t) => {
    await t.query('DELETE FROM commerza_category_sizes WHERE catid = @catid', { catid });
    for (const sid of sizeIds) {
      const numId = parseInt(sid, 10);
      if (!numId) continue;
      await t.query(
        `INSERT INTO commerza_category_sizes (catid, size_id, is_default)
         VALUES (@catid, @sid, @isDef)
         ON CONFLICT (catid, size_id) DO UPDATE SET is_default = EXCLUDED.is_default`,
        { catid, sid: numId, isDef: Number(defaultSizeId) === numId }
      );
    }
  });
  res.json({ status: 'true', message: 'Category allowed sizes updated' });
}));

router.put('/api/admin/categories/:catid/units', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const catid = parseInt(req.params.catid, 10);
  const { unitIds = [], defaultUnitId = null } = req.body || {};

  await db.tx(DB, async (t) => {
    await t.query('DELETE FROM commerza_category_units WHERE catid = @catid', { catid });
    for (const uid of unitIds) {
      const numId = parseInt(uid, 10);
      if (!numId) continue;
      await t.query(
        `INSERT INTO commerza_category_units (catid, unit_id, is_default)
         VALUES (@catid, @uid, @isDef)
         ON CONFLICT (catid, unit_id) DO UPDATE SET is_default = EXCLUDED.is_default`,
        { catid, uid: numId, isDef: Number(defaultUnitId) === numId }
      );
    }
  });
  res.json({ status: 'true', message: 'Category allowed units updated' });
}));

router.post('/api/admin/categories/:catid/attributes', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const catid = parseInt(req.params.catid, 10);
  const { attr_name, input_type = 'text', options = [], is_required = false, sort_order = 0 } = req.body || {};
  if (!attr_name || !String(attr_name).trim()) {
    return res.status(400).json({ status: 'false', message: 'attr_name is required' });
  }
  const opts = Array.isArray(options)
    ? options.map((s) => String(s).trim()).filter(Boolean)
    : String(options || '').split(',').map((s) => s.trim()).filter(Boolean);

  const row = await db.queryOne(
    DB,
    `INSERT INTO commerza_category_attributes (catid, attr_name, input_type, options_json, is_required, sort_order)
     VALUES (@catid, @name, @type, @opts::jsonb, @req, @order)
     RETURNING *`,
    {
      catid,
      name: String(attr_name).trim(),
      type: ['text', 'select', 'number', 'boolean'].includes(input_type) ? input_type : 'text',
      opts: JSON.stringify(opts),
      req: Boolean(is_required),
      order: parseInt(sort_order || 0, 10),
    }
  );
  res.status(201).json({ status: 'true', attribute: row });
}));

router.delete('/api/admin/category-attributes/:id', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const id = parseInt(req.params.id, 10);
  await db.exec(DB, 'DELETE FROM commerza_category_attributes WHERE id = @id', { id });
  res.json({ status: 'true', message: 'Attribute template deleted' });
}));

module.exports = router;
