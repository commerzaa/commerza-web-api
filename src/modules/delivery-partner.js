'use strict';
const express = require('express');
const db = require('../db');
const { auth, requireType } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { hashStaffPassword, verifyStaffPassword } = require('../lib/staffPassword');
const { ensureCommerzaSchema } = require('../lib/commerzaSchema');
const { createSession, rotateSession, revokeSession } = require('../lib/refreshTokens');

const router = express.Router();
const DB = 'shopping';
const guard = [auth, requireType('delivery_boy')];

let deliveryColumnsEnsured = false;
async function ensureDeliveryColumns() {
  await ensureCommerzaSchema();
  if (deliveryColumnsEnsured) return;
  await db.query(
    DB,
    `ALTER TABLE dbo.commerza_partner_staff
       ADD COLUMN IF NOT EXISTS current_latitude DOUBLE PRECISION,
       ADD COLUMN IF NOT EXISTS current_longitude DOUBLE PRECISION,
       ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP`
  ).catch(() => {});
  deliveryColumnsEnsured = true;
}

function mapFulfillmentToAppStatus(status) {
  switch (String(status || '').toLowerCase()) {
    case 'pending':
    case 'accepted':
      return 'headingToPickup';
    case 'preparing':
      return 'atPickup';
    case 'out_for_delivery':
      return 'headingToCustomer';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'headingToPickup';
  }
}

function formatOrderForApp(row) {
  if (!row) return null;
  let items = [];
  if (Array.isArray(row.items_json)) {
    items = row.items_json;
  } else if (typeof row.items_json === 'string') {
    try { items = JSON.parse(row.items_json); } catch (_) { items = []; }
  }

  const fallbackAddress = [row.ca_shortaddress, row.ca_landmark, row.ca_cityname]
    .filter(Boolean)
    .join(', ');

  return {
    id: String(row.id),
    orderNumber: row.order_number || `CMZ-${row.id}`,
    createdAt: row.created_at,
    deliveredAt: row.fulfillment_status === 'delivered' ? row.updated_at : null,
    status: mapFulfillmentToAppStatus(row.fulfillment_status),
    priority: String(row.priority || 'normal').toLowerCase(),
    totalAmount: Number(row.total_amount || 0),
    estimatedEarnings: Number(row.delivery_fee || 40),
    pickupDistanceKm: 0.8,
    deliveryDistanceKm: 2.5,
    estimatedMinutes: 20,
    paymentType: String(row.payment_status || '').toLowerCase() === 'paid' ? 'prepaid' : 'cod',
    isCodCollected: String(row.payment_status || '').toLowerCase() === 'paid',
    pickupOtp: String(row.id).padStart(4, '0').slice(-4),
    deliveryOtp: String(Number(row.id) + 1234).padStart(4, '0').slice(-4),
    merchant: {
      id: String(row.pmid || 0),
      name: row.shop_name || 'Commerzaa Store',
      shopName: row.shop_name || 'Commerzaa Store',
      phone: row.shop_phone || '',
      address: row.shop_address || '',
      landmark: row.shop_pincode ? `Pincode ${row.shop_pincode}` : '',
      latitude: Number(row.shop_latitude || 12.9716),
      longitude: Number(row.shop_longitude || 77.5946),
    },
    customer: {
      id: String(row.id),
      name: row.customer_name || 'Customer',
      phone: row.customer_phone || '',
      address: (row.delivery_address && row.delivery_address.trim()) ? row.delivery_address : fallbackAddress,
      landmark: (row.delivery_pincode || row.ca_pincode)
        ? `Pincode ${row.delivery_pincode || row.ca_pincode}`
        : (row.ca_landmark || ''),
      deliveryInstructions: '',
      latitude: Number(row.customer_latitude || 12.9784),
      longitude: Number(row.customer_longitude || 77.6408),
    },
    items: items.map((item, idx) => ({
      id: String(item.id || item.sprid || idx + 1),
      name: String(item.name || item.product_name || 'Item'),
      quantity: Number(item.quantity || item.qty || 1),
      price: Number(item.price || 0),
      unit: String(item.unit || 'Unit'),
    })),
  };
}

// ---- Auth: Delivery Boy Login (Email or Mobile + Password) with JWT + Refresh Token --------
router.post('/api/delivery/auth/login', asyncHandler(async (req, res) => {
  await ensureDeliveryColumns();
  const { identifier, password } = req.body || {};
  const cleanId = String(identifier || '').trim();
  const rawPw = String(password || '');

  if (!cleanId || !rawPw) {
    return res.status(400).json({ status: 'false', message: 'Email/mobile and password are required' });
  }

  const user = await db.queryOne(
    DB,
    `SELECT u.id, u.pmid, u.full_name, u.email, u.phone, u.password, u.role, u.user_type,
            u.vehicle_type, u.vehicle_number, u.license_number, u.is_available, u.is_active, u.created_at,
            pm.companyname AS hub_name, pm.address AS hub_address, pm.mobileno AS hub_phone,
            (SELECT COUNT(*)::int FROM dbo.commerza_orders o WHERE o.assigned_delivery_user_id = u.id AND o.fulfillment_status = 'delivered') AS total_deliveries
     FROM dbo.commerza_partner_staff u
     LEFT JOIN portal_master pm ON pm.pmid = u.pmid
     WHERE (u.user_type = 'delivery_boy' OR u.role = 'delivery_boy')
       AND (lower(u.email) = lower(@id) OR u.phone = @id)
     LIMIT 1`,
    { id: cleanId }
  );

  if (!user) {
    return res.status(401).json({ status: 'false', message: 'Invalid delivery partner credentials' });
  }
  if (!user.is_active) {
    return res.status(403).json({ status: 'false', message: 'Your delivery partner account is disabled' });
  }

  const pwCheck = verifyStaffPassword(user.password, rawPw);
  if (!pwCheck.valid) {
    return res.status(401).json({ status: 'false', message: 'Invalid delivery partner credentials' });
  }
  await db.exec(
    DB,
    `UPDATE dbo.commerza_partner_staff
     SET last_login_at = NOW(), password = CASE WHEN @rehash THEN @pw ELSE password END
     WHERE id = @id`,
    { id: Number(user.id), rehash: pwCheck.needsRehash, pw: pwCheck.needsRehash ? hashStaffPassword(rawPw) : '' }
  );

  const session = await createSession({
    userType: 'delivery_boy',
    subjectId: Number(user.id),
    subjectKey: user.email || user.phone || cleanId,
    payload: {
      uid: Number(user.id),
      pmid: Number(user.pmid),
      userName: user.email || user.phone,
      userType: 'delivery_boy',
    },
  });

  res.json({
    status: 'true',
    message: 'Login successful',
    token: session.token,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
    partner: {
      id: user.id,
      pmid: user.pmid,
      fullName: user.full_name,
      email: user.email || '',
      phone: user.phone || '',
      vehicleType: user.vehicle_type || 'bike',
      vehicleNumber: user.vehicle_number || '',
      licenseNumber: user.license_number || '',
      isAvailable: Boolean(user.is_available),
      hubName: user.hub_name || 'Commerzaa Hub',
      hubAddress: user.hub_address || '',
      hubPhone: user.hub_phone || '',
      totalDeliveries: Number(user.total_deliveries || 0),
      joinedDate: user.created_at,
    },
  });
}));

router.post('/api/delivery/auth/refresh', asyncHandler(async (req, res) => {
  const rawToken = (req.body && (req.body.refreshToken || req.body.RefreshToken)) || '';
  const result = await rotateSession(rawToken, 'delivery_boy', async (t, row) => {
    const p = typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : (row.payload_json || {});
    const uid = Number(p.uid || row.subject_id || 0);
    if (!uid) return 'Invalid delivery session.';
    const u = await t.queryOne('SELECT is_active FROM dbo.commerza_partner_staff WHERE id = @uid LIMIT 1', { uid });
    if (!u || u.is_active === false) return 'Account is inactive.';
    return null;
  });
  if (result.error) {
    return res.status(401).json({ status: 'false', message: result.error, code: 'REFRESH_INVALID' });
  }
  res.json({
    status: 'true',
    token: result.token,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
  });
}));

router.post('/api/delivery/auth/logout', ...guard, asyncHandler(async (req, res) => {
  await revokeSession(req.user?.sid);
  res.json({ status: 'true', message: 'Signed out' });
}));

// ---- Profile & Availability ----------------------------------------------------------------
router.get('/api/delivery/profile', ...guard, asyncHandler(async (req, res) => {
  await ensureDeliveryColumns();
  const user = await db.queryOne(
    DB,
    `SELECT u.id, u.pmid, u.full_name, u.email, u.phone, u.vehicle_type, u.vehicle_number,
            u.license_number, u.is_available, u.is_active, u.created_at,
            pm.companyname AS hub_name, pm.address AS hub_address, pm.mobileno AS hub_phone,
            (SELECT COUNT(*)::int FROM dbo.commerza_orders o WHERE o.assigned_delivery_user_id = u.id AND o.fulfillment_status = 'delivered') AS total_deliveries
     FROM dbo.commerza_partner_staff u
     LEFT JOIN portal_master pm ON pm.pmid = u.pmid
     WHERE u.id = @uid LIMIT 1`,
    { uid: req.user.uid }
  );
  if (!user) return res.status(404).json({ status: 'false', message: 'Partner not found' });
  res.json({
    status: 'true',
    data: {
      id: user.id,
      pmid: user.pmid,
      fullName: user.full_name,
      email: user.email || '',
      phone: user.phone || '',
      vehicleType: user.vehicle_type || 'bike',
      vehicleNumber: user.vehicle_number || '',
      licenseNumber: user.license_number || '',
      isAvailable: Boolean(user.is_available),
      hubName: user.hub_name || 'Commerzaa Hub',
      hubAddress: user.hub_address || '',
      hubPhone: user.hub_phone || '',
      totalDeliveries: Number(user.total_deliveries || 0),
      joinedDate: user.created_at,
    },
  });
}));

router.patch('/api/delivery/availability', ...guard, asyncHandler(async (req, res) => {
  await ensureDeliveryColumns();
  const isAvailable = Boolean(req.body?.isAvailable);
  await db.exec(
    DB,
    'UPDATE dbo.commerza_partner_staff SET is_available = @avail WHERE id = @uid',
    { avail: isAvailable, uid: req.user.uid }
  );
  res.json({ status: 'true', isAvailable });
}));

// ---- Live GPS Location Update --------------------------------------------------------------
router.post('/api/delivery/location', ...guard, asyncHandler(async (req, res) => {
  await ensureDeliveryColumns();
  const lat = Number(req.body?.latitude);
  const lng = Number(req.body?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ status: 'false', message: 'Valid latitude and longitude are required' });
  }
  await db.exec(
    DB,
    `UPDATE dbo.commerza_partner_staff
     SET current_latitude = @lat, current_longitude = @lng, location_updated_at = NOW()
     WHERE id = @uid`,
    { lat, lng, uid: req.user.uid }
  );
  res.json({ status: 'true', latitude: lat, longitude: lng });
}));

// ---- Road Route Proxy (OSRM + OSM.DE fallback for reliable mobile navigation) -------------
router.get('/api/delivery/route', ...guard, asyncHandler(async (req, res) => {
  const startLat = Number(req.query.startLat);
  const startLng = Number(req.query.startLng);
  const endLat = Number(req.query.endLat);
  const endLng = Number(req.query.endLng);
  if (![startLat, startLng, endLat, endLng].every(Number.isFinite)) {
    return res.status(400).json({ status: 'false', message: 'Valid start/end coordinates are required' });
  }

  const coords = `${startLng},${startLat};${endLng},${endLat}`;
  const urls = [
    `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`,
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const r = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!r.ok) continue;
      const data = await r.json();
      const route = Array.isArray(data?.routes) ? data.routes[0] : null;
      const rawCoords = route?.geometry?.coordinates;
      if (!Array.isArray(rawCoords) || rawCoords.length === 0) continue;

      let instruction = 'Follow highlighted street route';
      const firstStep = route?.legs?.[0]?.steps?.[0];
      if (firstStep) {
        const name = String(firstStep.name || '').trim();
        const mod = String(firstStep.maneuver?.modifier || 'ahead').trim();
        if (name) instruction = `Head ${mod} on ${name}`;
      }

      return res.json({
        status: 'true',
        data: {
          distanceMeters: Number(route.distance || 0),
          durationSeconds: Math.round(Number(route.duration || 0)),
          instruction,
          points: rawCoords.map((c) => [Number(c[1]), Number(c[0])]),
        },
      });
    } catch (_) {
      // try next routing mirror
    }
  }

  return res.status(502).json({ status: 'false', message: 'Routing service unavailable' });
}));

// ---- Earnings Summary from DB --------------------------------------------------------------
router.get('/api/delivery/earnings', ...guard, asyncHandler(async (req, res) => {
  await ensureDeliveryColumns();
  const pmid = Number(req.user.pmid);
  const uid = Number(req.user.uid);
  const stats = await db.queryOne(
    DB,
    `SELECT
       COALESCE(SUM(CASE WHEN fulfillment_status = 'delivered' AND updated_at::date = CURRENT_DATE THEN delivery_fee ELSE 0 END), 0)::numeric(12,2) AS today_earnings,
       COALESCE(SUM(CASE WHEN fulfillment_status = 'delivered' AND updated_at >= NOW() - INTERVAL '7 days' THEN delivery_fee ELSE 0 END), 0)::numeric(12,2) AS weekly_earnings,
       COALESCE(SUM(CASE WHEN fulfillment_status = 'delivered' AND updated_at >= NOW() - INTERVAL '30 days' THEN delivery_fee ELSE 0 END), 0)::numeric(12,2) AS monthly_earnings,
       COALESCE(SUM(CASE WHEN fulfillment_status = 'delivered' THEN delivery_fee ELSE 0 END), 0)::numeric(12,2) AS total_earnings,
       COUNT(*) FILTER (WHERE fulfillment_status = 'delivered' AND updated_at::date = CURRENT_DATE)::int AS today_deliveries,
       COUNT(*) FILTER (WHERE fulfillment_status = 'delivered')::int AS total_deliveries
     FROM dbo.commerza_orders
     WHERE pmid = @pmid AND assigned_delivery_user_id = @uid`,
    { pmid, uid }
  );

  const txRows = await db.query(
    DB,
    `SELECT id, order_number, delivery_fee, updated_at
     FROM dbo.commerza_orders
     WHERE pmid = @pmid AND assigned_delivery_user_id = @uid AND fulfillment_status = 'delivered'
     ORDER BY updated_at DESC
     LIMIT 20`,
    { pmid, uid }
  );

  res.json({
    status: 'true',
    data: {
      todayEarnings: Number(stats?.today_earnings || 0),
      weeklyEarnings: Number(stats?.weekly_earnings || 0),
      monthlyEarnings: Number(stats?.monthly_earnings || 0),
      availableWalletBalance: Number(stats?.total_earnings || 0),
      totalCodInHand: 0,
      todayDeliveries: Number(stats?.today_deliveries || 0),
      todayDistanceKm: Number((Number(stats?.today_deliveries || 0) * 3.2).toFixed(1)),
      transactions: txRows.map((r) => ({
        id: String(r.id),
        title: `Order #${r.order_number}`,
        subtitle: 'Delivery Payout',
        amount: Number(r.delivery_fee || 0),
        date: r.updated_at,
        type: 'earning',
        status: 'Completed',
      })),
    },
  });
}));

// ---- Orders: Active, Incoming, History, Status & Completion --------------------------------
const ORDER_SELECT = `
  SELECT o.*,
         sd.latitude AS shop_latitude, sd.longitude AS shop_longitude,
         pm.companyname AS shop_name, pm.address AS shop_address, pm.pincode AS shop_pincode, pm.mobileno AS shop_phone,
         ca.shortaddress AS ca_shortaddress, ca.landmark AS ca_landmark, ca.cityname AS ca_cityname, ca.pincode AS ca_pincode
  FROM dbo.commerza_orders o
  LEFT JOIN portal_master pm ON pm.pmid = o.pmid
  LEFT JOIN dbo.commerza_shop_details sd ON sd.pmid = o.pmid
  LEFT JOIN LATERAL (
    SELECT shortaddress, landmark, cityname, pincode
    FROM dbo.ims_customeraddress ca
    WHERE (lower(ca.email1) = lower(o.customer_email) OR ca.phoneno1 = o.customer_phone)
      AND ca.isactive = TRUE
    ORDER BY ca.isdefault DESC, ca.id DESC
    LIMIT 1
  ) ca ON TRUE
`;

router.get('/api/delivery/orders/active', ...guard, asyncHandler(async (req, res) => {
  await ensureDeliveryColumns();
  const pmid = Number(req.user.pmid);
  const row = await db.queryOne(
    DB,
    `${ORDER_SELECT}
     WHERE o.pmid = @pmid
       AND o.delivery_method = 'local'
       AND o.assigned_delivery_user_id = @uid
       AND o.fulfillment_status IN ('accepted', 'preparing', 'out_for_delivery')
     ORDER BY o.assigned_at DESC NULLS LAST, o.id DESC
     LIMIT 1`,
    { uid: req.user.uid, pmid }
  );
  res.json({ status: 'true', data: formatOrderForApp(row) });
}));

router.get('/api/delivery/orders/incoming', ...guard, asyncHandler(async (req, res) => {
  await ensureDeliveryColumns();
  const pmid = Number(req.user.pmid);
  // Only orders confirmed by the partner for local delivery (not shiprocket, not unconfirmed pending)
  const row = await db.queryOne(
    DB,
    `${ORDER_SELECT}
     WHERE o.pmid = @pmid
       AND o.delivery_method = 'local'
       AND (
         (o.assigned_delivery_user_id IS NULL AND o.fulfillment_status IN ('accepted', 'preparing'))
         OR (o.assigned_delivery_user_id = @uid AND o.fulfillment_status = 'pending')
       )
     ORDER BY
       CASE WHEN o.assigned_delivery_user_id = @uid THEN 0 ELSE 1 END,
       CASE lower(COALESCE(o.priority, 'normal')) WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
       o.id DESC
     LIMIT 1`,
    { uid: req.user.uid, pmid }
  );
  res.json({ status: 'true', data: formatOrderForApp(row) });
}));

router.get('/api/delivery/orders/available', ...guard, asyncHandler(async (req, res) => {
  await ensureDeliveryColumns();
  const pmid = Number(req.user.pmid);
  const rows = await db.query(
    DB,
    `${ORDER_SELECT}
     WHERE o.pmid = @pmid
       AND o.delivery_method = 'local'
       AND (
         (o.assigned_delivery_user_id IS NULL AND o.fulfillment_status IN ('accepted', 'preparing'))
         OR (o.assigned_delivery_user_id = @uid AND o.fulfillment_status = 'pending')
       )
     ORDER BY
       CASE lower(COALESCE(o.priority, 'normal')) WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
       o.id DESC
     LIMIT 50`,
    { uid: req.user.uid, pmid }
  );
  res.json({ status: 'true', data: rows.map(formatOrderForApp) });
}));

router.get('/api/delivery/orders/history', ...guard, asyncHandler(async (req, res) => {
  await ensureDeliveryColumns();
  const pmid = Number(req.user.pmid);
  const rows = await db.query(
    DB,
    `${ORDER_SELECT}
     WHERE o.pmid = @pmid
       AND o.assigned_delivery_user_id = @uid
       AND o.fulfillment_status IN ('delivered', 'cancelled')
     ORDER BY o.updated_at DESC, o.id DESC
     LIMIT 50`,
    { uid: req.user.uid, pmid }
  );
  res.json({ status: 'true', data: rows.map(formatOrderForApp) });
}));

router.post('/api/delivery/orders/:id/accept', ...guard, asyncHandler(async (req, res) => {
  await ensureDeliveryColumns();
  const pmid = Number(req.user.pmid);
  const id = parseInt(req.params.id, 10);
  const rider = await db.queryOne(
    DB,
    'SELECT full_name, phone FROM dbo.commerza_partner_staff WHERE id = @uid LIMIT 1',
    { uid: req.user.uid }
  );
  const updated = await db.exec(
    DB,
    `UPDATE dbo.commerza_orders
     SET fulfillment_status = 'accepted',
         assigned_delivery_user_id = @uid,
         assigned_delivery_name = COALESCE(NULLIF(@name, ''), assigned_delivery_name),
         assigned_delivery_phone = COALESCE(NULLIF(@phone, ''), assigned_delivery_phone),
         assigned_at = COALESCE(assigned_at, NOW()),
         updated_at = NOW()
     WHERE id = @id
       AND pmid = @pmid
       AND delivery_method = 'local'
       AND (
         (assigned_delivery_user_id IS NULL AND fulfillment_status IN ('accepted', 'preparing'))
         OR assigned_delivery_user_id = @uid
       )`,
    {
      id,
      pmid,
      uid: req.user.uid,
      name: rider?.full_name || '',
      phone: rider?.phone || '',
    }
  );
  if (!updated) {
    return res.status(409).json({ status: 'false', message: 'Order is no longer available for local delivery' });
  }
  const row = await db.queryOne(DB, `${ORDER_SELECT} WHERE o.id = @id AND o.pmid = @pmid`, { id, pmid });
  res.json({ status: 'true', data: formatOrderForApp(row) });
}));

router.patch('/api/delivery/orders/:id/status', ...guard, asyncHandler(async (req, res) => {
  await ensureDeliveryColumns();
  const pmid = Number(req.user.pmid);
  const id = parseInt(req.params.id, 10);
  const appStatus = String(req.body?.status || '').trim();
  const mapToDb = {
    headingToPickup: 'accepted',
    atPickup: 'preparing',
    pickedUp: 'out_for_delivery',
    headingToCustomer: 'out_for_delivery',
    atCustomer: 'out_for_delivery',
    delivered: 'delivered',
    cancelled: 'cancelled',
  };
  const dbStatus = mapToDb[appStatus] || 'out_for_delivery';
  await db.exec(
    DB,
    `UPDATE dbo.commerza_orders
     SET fulfillment_status = @status, updated_at = NOW()
     WHERE id = @id AND pmid = @pmid AND assigned_delivery_user_id = @uid`,
    { id, pmid, uid: req.user.uid, status: dbStatus }
  );
  const row = await db.queryOne(DB, `${ORDER_SELECT} WHERE o.id = @id AND o.pmid = @pmid`, { id, pmid });
  res.json({ status: 'true', data: formatOrderForApp(row) });
}));

router.post('/api/delivery/orders/:id/complete', ...guard, asyncHandler(async (req, res) => {
  await ensureDeliveryColumns();
  const pmid = Number(req.user.pmid);
  const id = parseInt(req.params.id, 10);
  const isCodCollected = Boolean(req.body?.isCodCollected);
  await db.exec(
    DB,
    `UPDATE dbo.commerza_orders
     SET fulfillment_status = 'delivered',
         payment_status = CASE WHEN @cod THEN 'paid' ELSE payment_status END,
         updated_at = NOW()
     WHERE id = @id AND pmid = @pmid AND assigned_delivery_user_id = @uid`,
    { id, pmid, uid: req.user.uid, cod: isCodCollected }
  );
  const row = await db.queryOne(DB, `${ORDER_SELECT} WHERE o.id = @id AND o.pmid = @pmid`, { id, pmid });
  res.json({ status: 'true', data: formatOrderForApp(row) });
}));

module.exports = router;
