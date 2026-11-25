'use strict';
const express = require('express');
const db = require('../db');
const { signToken, auth, requireType } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
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
    openDisputes, pendingPayments, totalCoupons, totalAdminUsers,
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
    db.scalar(DB, 'SELECT COUNT(*)::int FROM commerza_coupons WHERE is_active = true'),
    db.scalar(DB, 'SELECT COUNT(*)::int FROM commerza_admin_users WHERE is_active = true'),
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
      pendingPayments,
      totalCoupons,
      totalAdminUsers,
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
  const { code, name, description = '', price, durationDays = 365, maxProducts = 25, localDeliveryAllowed = true, shiprocketAllowed = true, features = [] } = req.body || {};
  if (!code || !name || price === undefined) {
    return res.status(400).json({ status: 'false', message: 'code, name, and price are required' });
  }
  const row = await db.queryOne(
    DB,
    `INSERT INTO commerza_packages (code, name, description, price, duration_days, max_products, local_delivery_allowed, shiprocket_allowed, features_json)
     VALUES (@code, @name, @description, @price, @durationDays, @maxProducts, @local, @sr, @features::jsonb)
     RETURNING *`,
    {
      code: String(code).toUpperCase().trim(),
      name: String(name).trim(),
      description,
      price: Number(price),
      durationDays: parseInt(durationDays, 10),
      maxProducts: parseInt(maxProducts, 10),
      local: Boolean(localDeliveryAllowed),
      sr: Boolean(shiprocketAllowed),
      features: JSON.stringify(Array.isArray(features) ? features : []),
    }
  );
  res.status(201).json({ status: 'true', pkg: row });
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
      `SELECT c.catid, c.catname, c.catdesc, COALESCE(c.catactive, true) AS active, c.gmid, g.groupname
       FROM product_category c
       LEFT JOIN tbl_categorygroupmaster g ON g.gmid = c.gmid
       ORDER BY c.catid ASC`
    ),
    db.query(
      DB,
      `SELECT sc.scatid, sc.scatname, sc.scatdesc, COALESCE(sc.scatactive, true) AS active, sc.catid, c.catname
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
  if (!scatname || !catid) return res.status(400).json({ status: 'false', message: 'scatname and catid are required' });
  const nextId = await db.scalar(DB, 'SELECT COALESCE(MAX(scatid), 0) + 1 FROM product_subcategory');
  await db.query(
    DB,
    'INSERT INTO product_subcategory (scatid, scatname, scatactive, catid) VALUES (@scatid, @scatname, true, @catid)',
    { scatid: nextId, scatname, catid }
  );
  res.status(201).json({ status: 'true', subcategory: { scatid: Number(nextId), scatname, catid, active: true } });
}));

router.patch('/api/admin/subcategories/:scatid', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const scatid = parseInt(req.params.scatid, 10);
  const { scatname, active, catid } = req.body || {};
  const updated = await db.exec(
    DB,
    `UPDATE product_subcategory
     SET scatname = COALESCE(@scatname, scatname),
         scatactive = COALESCE(@active, scatactive),
         catid = COALESCE(@catid, catid)
     WHERE scatid = @scatid`,
    {
      scatid,
      scatname: scatname ?? null,
      active: active !== undefined ? Boolean(active) : null,
      catid: catid !== undefined ? parseInt(catid, 10) : null,
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

module.exports = router;
