'use strict';
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../db');
const config = require('../config');
const { signToken, auth, requireType } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { Encryptword } = require('../utils/crypto');
const { ensureCommerzaSchema } = require('../lib/commerzaSchema');
const { createSession, rotateSession, revokeSession } = require('../lib/refreshTokens');
const shiprocket = require('../lib/shiprocket');

const router = express.Router();
const DB = 'shopping';
const guard = [auth, requireType('merchant')];

async function getPartnerSubscriptionState(pmid) {
  await ensureCommerzaSchema();
  const latest = await db.queryOne(
    DB,
    `SELECT s.*, pkg.code AS package_code, pkg.max_products, pkg.local_delivery_allowed, pkg.shiprocket_allowed
     FROM commerza_partner_subscriptions s
     LEFT JOIN commerza_packages pkg ON pkg.id = s.package_id
     WHERE s.pmid = @pmid
     ORDER BY s.id DESC LIMIT 1`,
    { pmid }
  );
  const active = await db.queryOne(
    DB,
    `SELECT s.*, pkg.code AS package_code, pkg.max_products, pkg.local_delivery_allowed, pkg.shiprocket_allowed
     FROM commerza_partner_subscriptions s
     LEFT JOIN commerza_packages pkg ON pkg.id = s.package_id
     WHERE s.pmid = @pmid
       AND s.status = 'approved'
       AND (s.expires_at IS NULL OR s.expires_at > NOW())
     ORDER BY s.id DESC LIMIT 1`,
    { pmid }
  );
  const usedProducts = await db.scalar(
    DB,
    `SELECT COUNT(*)::int FROM ims_subproduct sp
     JOIN ims_masterproduct mp ON mp.mprid = sp.mprid
     WHERE mp.companyid = @pmid`,
    { pmid }
  );
  const maxProducts = active ? Number(active.max_products || 25) : 0;
  return {
    canAddProducts: Boolean(active),
    activeSubscription: active || null,
    latestSubscription: latest || null,
    usedProducts: Number(usedProducts || 0),
    maxProducts,
    remainingProducts: active ? Math.max(0, maxProducts - Number(usedProducts || 0)) : 0,
  };
}

const requireApprovedSubscription = asyncHandler(async (req, res, next) => {
  const pmid = Number(req.user.pmid);
  const state = await getPartnerSubscriptionState(pmid);
  if (!state.canAddProducts) {
    return res.status(403).json({
      status: 'false',
      code: 'SUBSCRIPTION_REQUIRED',
      message: state.latestSubscription?.status === 'pending'
        ? 'Your package payment is pending admin verification. You can add products once approved.'
        : 'Please choose and purchase a partner package first, then wait for admin approval.',
    });
  }
  req.subscriptionState = state;
  next();
});

function makeSafeFileName(prefix, ext = 'png') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

// ---- Auth: Register & Login ----------------------------------------------------------------
router.post('/api/partner/register', asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const {
    companyName, ownerName, email, phone, password,
    address = '', pincode = '', areaName = '', description = '', referralCode = '',
  } = req.body || {};

  if (!companyName || !email || !phone || !password) {
    return res.status(400).json({ status: 'false', message: 'companyName, email, phone, and password are required' });
  }

  const existing = await db.queryOne(
    DB,
    'SELECT plid FROM portal_login WHERE lower(emailid) = lower(@email) OR lower(loginid) = lower(@email) OR phone = @phone LIMIT 1',
    { email, phone }
  );
  if (existing) {
    return res.status(409).json({ status: 'false', message: 'A partner account with this email or phone already exists' });
  }

  const encPassword = Encryptword(password) || password;
  const result = await db.tx(DB, async (t) => {
    const nextPmid = await t.scalar('SELECT COALESCE(MAX(pmid), 0) + 1 FROM portal_master');
    const nextPlid = await t.scalar('SELECT COALESCE(MAX(plid), 0) + 1 FROM portal_login');

    await t.query(
      `INSERT INTO portal_master
        (pmid, companyname, mobileno, address, pincode, active, areaname, companydesc, comemailid, isverified, doc)
       VALUES
        (@pmid, @companyName, @phone, @address, @pincode, true, @areaName, @description, @email, 0, NOW())`,
      { pmid: nextPmid, companyName, phone, address, pincode, areaName, description, email }
    );

    const names = String(ownerName || companyName).trim().split(/\s+/);
    const fname = names[0] || companyName;
    const lname = names.slice(1).join(' ');
    const myRefCode = `CMZ-P${nextPmid}`;

    let introPlid = null;
    let parentPlid = null;
    let communitySide = null;
    let refralId = null;
    if (String(referralCode || '').trim()) {
      const refRow = await t.queryOne(
        'SELECT plid, pmid, referalcode FROM portal_login WHERE upper(referalcode) = upper(@rc) LIMIT 1',
        { rc: String(referralCode).trim() }
      );
      if (refRow) {
        introPlid = Number(refRow.plid);
        refralId = refRow.referalcode;
        const rawSide = String(req.body?.side || '').trim().toLowerCase();
        let targetSideNum = rawSide === 'right' || rawSide === '2' ? 2 : rawSide === 'left' || rawSide === '1' ? 1 : 0;
        if (!targetSideNum) {
          const leftTaken = await t.queryOne(
            'SELECT plid FROM portal_login WHERE parent_plid = @p AND COALESCE(communityside, 1) = 1 LIMIT 1',
            { p: introPlid }
          );
          targetSideNum = leftTaken ? 2 : 1;
        }
        let cursor = introPlid;
        for (let depth = 0; depth < 50; depth++) {
          const child = await t.queryOne(
            'SELECT plid FROM portal_login WHERE parent_plid = @p AND COALESCE(communityside, 1) = @s LIMIT 1',
            { p: cursor, s: targetSideNum }
          );
          if (!child) break;
          cursor = Number(child.plid);
        }
        parentPlid = cursor;
        communitySide = targetSideNum;
      }
    }

    await t.query(
      `INSERT INTO portal_login
        (plid, pmid, loginid, password, active, isactive, username, fname, lname, phone, emailid,
         referalcode, intro_plid, parent_plid, communityside, refral_id, ismerchantpanelaccepted, doc)
       VALUES
        (@plid, @pmid, @email, @password, true, true, @email, @fname, @lname, @phone, @email,
         @myRefCode, @introPlid, @parentPlid, @communitySide, @refralId, 1, NOW())`,
      { plid: nextPlid, pmid: nextPmid, email, password: encPassword, fname, lname, phone, myRefCode, introPlid, parentPlid, communitySide, refralId }
    );

    await t.query(
      `INSERT INTO commerza_shop_delivery_settings (pmid, local_pincodes)
       VALUES (@pmid, @pincode)
       ON CONFLICT (pmid) DO NOTHING`,
      { pmid: nextPmid, pincode }
    );

    return { pmid: Number(nextPmid), plid: Number(nextPlid) };
  });

  const session = await createSession({
    userType: 'merchant',
    subjectId: result.plid,
    subjectKey: email,
    payload: {
      plid: result.plid,
      pmid: result.pmid,
      userName: email,
      companyName,
      userType: 'merchant',
    },
  });

  res.status(201).json({
    status: 'true',
    message: 'Shop registered successfully. Pending admin verification.',
    token: session.token,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
    partner: {
      plid: result.plid,
      pmid: result.pmid,
      uniqueId: `CMZ-P${result.pmid}`,
      companyName,
      email,
      phone,
      isVerified: 0,
      canAddProducts: false,
    },
    subscription: { canAddProducts: false, activeSubscription: null, latestSubscription: null, usedProducts: 0, maxProducts: 0, remainingProducts: 0 },
  });
}));

router.post('/api/partner/login', asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const { email, loginId, password } = req.body || {};
  const identifier = String(email || loginId || '').trim();
  if (!identifier || !password) {
    return res.status(400).json({ status: 'false', message: 'Email/Login ID and password are required' });
  }

  let user = await db.queryOne(
    DB,
    `SELECT pl.plid, pl.pmid, pl.loginid, pl.password, pl.emailid, pl.phone, pl.fname, pl.lname, pl.active,
            pm.companyname, pm.isverified, pm.address, pm.pincode, pm.areaname, 'owner'::text AS role
     FROM portal_login pl
     LEFT JOIN portal_master pm ON pm.pmid = pl.pmid
     WHERE lower(pl.loginid) = lower(@id) OR lower(pl.emailid) = lower(@id) OR pl.phone = @id
     LIMIT 1`,
    { id: identifier }
  );

  if (!user) {
    const staff = await db.queryOne(
      DB,
      `SELECT u.id AS plid, u.pmid, u.email AS loginid, u.password, u.email AS emailid, u.phone,
              u.full_name AS fname, ''::text AS lname, u.is_active AS active, u.role,
              pm.companyname, pm.isverified, pm.address, pm.pincode, pm.areaname
       FROM commerza_portal_users u
       LEFT JOIN portal_master pm ON pm.pmid = u.pmid
       WHERE lower(u.email) = lower(@id) OR u.phone = @id
       LIMIT 1`,
      { id: identifier }
    );
    if (staff) user = staff;
  }

  if (!user) {
    return res.status(401).json({ status: 'false', message: 'Invalid credentials' });
  }

  const enc = Encryptword(password);
  const valid = user.password === password || (enc && user.password === enc);
  if (!valid) {
    return res.status(401).json({ status: 'false', message: 'Invalid credentials' });
  }

  if (user.active === false) {
    return res.status(403).json({ status: 'false', message: 'Account is inactive' });
  }

  const session = await createSession({
    userType: 'merchant',
    subjectId: Number(user.plid),
    subjectKey: user.loginid || user.emailid || identifier,
    payload: {
      plid: Number(user.plid),
      pmid: Number(user.pmid || 0),
      userName: user.loginid || user.emailid,
      companyName: user.companyname || '',
      role: user.role || 'owner',
      userType: 'merchant',
    },
  });

  const subState = await getPartnerSubscriptionState(Number(user.pmid || 0));

  res.json({
    status: 'true',
    token: session.token,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
    partner: {
      plid: Number(user.plid),
      pmid: Number(user.pmid || 0),
      loginId: user.loginid,
      email: user.emailid,
      phone: user.phone,
      ownerName: [user.fname, user.lname].filter(Boolean).join(' '),
      companyName: user.companyname || '',
      address: user.address || '',
      pincode: user.pincode || '',
      areaName: user.areaname || '',
      role: user.role || 'owner',
      isVerified: Number(user.isverified || 0),
      canAddProducts: subState.canAddProducts,
    },
    subscription: subState,
  });
}));

router.post('/api/partner/refresh', asyncHandler(async (req, res) => {
  const rawToken = (req.body && (req.body.refreshToken || req.body.RefreshToken)) || '';
  const result = await rotateSession(rawToken, 'merchant', async (t, row) => {
    const p = typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : (row.payload_json || {});
    const plid = Number(p.plid || row.subject_id || 0);
    if (!plid) return 'Invalid partner session.';
    if (p.role && p.role !== 'owner') {
      const staff = await t.queryOne('SELECT is_active FROM commerza_portal_users WHERE id = @plid LIMIT 1', { plid });
      if (staff && staff.is_active === false) return 'Account is inactive';
    } else {
      const owner = await t.queryOne('SELECT active FROM portal_login WHERE plid = @plid LIMIT 1', { plid });
      if (owner && owner.active === false) return 'Account is inactive';
    }
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

router.post('/api/partner/logout', ...guard, asyncHandler(async (req, res) => {
  await revokeSession(req.user?.sid);
  res.json({ status: 'true', message: 'Signed out' });
}));

async function getWalletBalances(pmid) {
  await ensureCommerzaSchema();
  const [topupIn, topupOut, incIn, incOut, pendingW] = await Promise.all([
    db.scalar(DB, "SELECT COALESCE(SUM(amount), 0)::numeric(12,2) FROM commerza_partner_wallet_tx WHERE pmid = @pmid AND wallet_type = 'topup' AND tx_type = 'credit'", { pmid }),
    db.scalar(DB, "SELECT COALESCE(SUM(amount), 0)::numeric(12,2) FROM commerza_partner_wallet_tx WHERE pmid = @pmid AND wallet_type = 'topup' AND tx_type = 'debit'", { pmid }),
    db.scalar(DB, "SELECT COALESCE(SUM(amount), 0)::numeric(12,2) FROM commerza_partner_wallet_tx WHERE pmid = @pmid AND COALESCE(wallet_type, 'income') = 'income' AND tx_type = 'credit'", { pmid }),
    db.scalar(DB, "SELECT COALESCE(SUM(amount), 0)::numeric(12,2) FROM commerza_partner_wallet_tx WHERE pmid = @pmid AND COALESCE(wallet_type, 'income') = 'income' AND tx_type = 'debit'", { pmid }),
    db.scalar(DB, "SELECT COALESCE(SUM(amount), 0)::numeric(12,2) FROM commerza_partner_withdrawals WHERE pmid = @pmid AND status = 'pending'", { pmid }),
  ]);
  const topupBalance = Math.max(0, Number((Number(topupIn || 0) - Number(topupOut || 0)).toFixed(2)));
  const totalEarned = Number(incIn || 0);
  const totalWithdrawn = Number(incOut || 0);
  const pendingWithdrawal = Number(pendingW || 0);
  const walletBalance = Math.max(0, Number((totalEarned - totalWithdrawn - pendingWithdrawal).toFixed(2)));
  return { topupBalance, walletBalance, totalEarned, totalWithdrawn, pendingWithdrawal };
}

// ---- Packages & Subscription Purchase ------------------------------------------------------
router.get('/api/partner/packages', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const [packages, subState, balances] = await Promise.all([
    db.query(DB, 'SELECT * FROM commerza_packages WHERE is_active = true ORDER BY sort_order ASC, id ASC'),
    getPartnerSubscriptionState(pmid),
    getWalletBalances(pmid),
  ]);
  const currentPlanPrice = subState.activeSubscription
    ? Number(subState.activeSubscription.amount_expected || subState.activeSubscription.amount_paid || 0)
    : 0;

  const enriched = packages.map((pkg) => {
    const price = Number(pkg.price || 0);
    const isCurrent = subState.activeSubscription?.package_id === pkg.id;
    const isUpgrade = Boolean(subState.activeSubscription) && !isCurrent && price > currentPlanPrice;
    const payableAmount = subState.activeSubscription
      ? Math.max(0, Number((price - currentPlanPrice).toFixed(2)))
      : price;
    return { ...pkg, isCurrent, isUpgrade, currentPlanPrice, payableAmount };
  });

  res.json({ status: 'true', packages: enriched, topupBalance: balances.topupBalance, currentPlanPrice });
}));

router.post('/api/partner/packages/purchase-from-wallet', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const { packageId } = req.body || {};
  if (!packageId) {
    return res.status(400).json({ status: 'false', message: 'packageId is required' });
  }

  const pkg = await db.queryOne(DB, 'SELECT * FROM commerza_packages WHERE id = @id AND is_active = true', { id: parseInt(packageId, 10) });
  if (!pkg) return res.status(404).json({ status: 'false', message: 'Package not found' });

  const [subState, balances] = await Promise.all([
    getPartnerSubscriptionState(pmid),
    getWalletBalances(pmid),
  ]);

  if (subState.activeSubscription?.package_id === pkg.id) {
    return res.status(400).json({ status: 'false', message: 'You are already on this plan.' });
  }

  const currentPlanPrice = subState.activeSubscription
    ? Number(subState.activeSubscription.amount_expected || subState.activeSubscription.amount_paid || 0)
    : 0;
  const isUpgrade = Boolean(subState.activeSubscription) && Number(pkg.price) > currentPlanPrice;
  const payable = subState.activeSubscription
    ? Math.max(0, Number((Number(pkg.price) - currentPlanPrice).toFixed(2)))
    : Number(pkg.price);

  if (balances.topupBalance < payable) {
    const shortfall = Number((payable - balances.topupBalance).toFixed(2));
    return res.status(400).json({
      status: 'false',
      code: 'INSUFFICIENT_WALLET',
      message: `Insufficient Top-Up Wallet balance. Need ₹${shortfall} more (Payable: ₹${payable}, Balance: ₹${balances.topupBalance}).`,
    });
  }

  const sub = await db.tx(DB, async (t) => {
    if (payable > 0) {
      await t.query(
        `INSERT INTO commerza_partner_wallet_tx (pmid, wallet_type, tx_type, category, amount, description, status)
         VALUES (@pmid, 'topup', 'debit', 'package_purchase', @amt, @desc, 'completed')`,
        {
          pmid,
          amt: payable,
          desc: isUpgrade
            ? `Upgraded to ${pkg.name} (Plan ₹${pkg.price} - Previous ₹${currentPlanPrice})`
            : `Purchased ${pkg.name}`,
        }
      );
    }

    const row = await t.queryOne(
      `INSERT INTO commerza_partner_subscriptions (
         pmid, package_id, package_name, amount_expected, amount_paid,
         payment_method, transaction_ref, notes, status, verified_by, starts_at, expires_at
       ) VALUES (
         @pmid, @pkgId, @pkgName, @expected, @paid,
         'topup_wallet', @ref, @notes, 'approved', 'wallet_auto', NOW(), NOW() + (@days || ' days')::interval
       ) RETURNING *`,
      {
        pmid,
        pkgId: pkg.id,
        pkgName: pkg.name,
        expected: Number(pkg.price),
        paid: payable,
        ref: `WALLET-${Date.now()}`,
        notes: isUpgrade ? `Upgraded from ₹${currentPlanPrice} plan` : 'Purchased via Top-Up Wallet',
        days: Number(pkg.duration_days || 365),
      }
    );

    await t.query('UPDATE portal_master SET isverified = 1, active = true WHERE pmid = @pmid', { pmid });
    await t.query(
      `INSERT INTO commerza_shop_delivery_settings (pmid, delivery_verified)
       VALUES (@pmid, true)
       ON CONFLICT (pmid) DO UPDATE SET delivery_verified = true, updated_at = NOW()`,
      { pmid }
    );

    // Credit 10% referral bonus on actual payable amount if referred
    if (payable > 0) {
      const loginRow = await t.queryOne('SELECT intro_plid FROM portal_login WHERE pmid = @pmid LIMIT 1', { pmid });
      if (loginRow?.intro_plid) {
        const referrer = await t.queryOne('SELECT pmid FROM portal_login WHERE plid = @plid LIMIT 1', { plid: loginRow.intro_plid });
        if (referrer?.pmid && Number(referrer.pmid) !== pmid) {
          const bonus = Number((payable * 0.10).toFixed(2));
          if (bonus > 0) {
            await t.query(
              `INSERT INTO commerza_partner_wallet_tx (pmid, wallet_type, tx_type, category, amount, source_pmid, description, status)
               VALUES (@refPmid, 'income', 'credit', 'referral_bonus', @bonus, @srcPmid, @desc, 'completed')`,
              {
                refPmid: referrer.pmid,
                bonus,
                srcPmid: pmid,
                desc: `10% referral bonus for ${pkg.name} (Shop #${pmid})`,
              }
            );
          }
        }
      }
    }

    return row;
  });

  const nextBalances = await getWalletBalances(pmid);
  res.status(201).json({
    status: 'true',
    message: isUpgrade
      ? `Upgraded to ${pkg.name} for ₹${payable}! Remaining wallet balance: ₹${nextBalances.topupBalance}`
      : `${pkg.name} activated! Remaining wallet balance: ₹${nextBalances.topupBalance}`,
    subscription: sub,
    topupBalance: nextBalances.topupBalance,
  });
}));

router.get('/api/partner/subscription', ...guard, asyncHandler(async (req, res) => {
  const pmid = Number(req.user.pmid);
  const state = await getPartnerSubscriptionState(pmid);
  const history = await db.query(
    DB,
    `SELECT s.*, pkg.code AS package_code, pkg.max_products
     FROM commerza_partner_subscriptions s
     LEFT JOIN commerza_packages pkg ON pkg.id = s.package_id
     WHERE s.pmid = @pmid
     ORDER BY s.id DESC`,
    { pmid }
  );
  res.json({ status: 'true', ...state, history });
}));

router.get('/api/partner/stats', ...guard, asyncHandler(async (req, res) => {
  const pmid = Number(req.user.pmid);
  const [subState, prodStats, orderStats, shopDetails, delivery, couponCount, userCount, latestOrders, salesTrend, statusBreak, deliveryBreak] = await Promise.all([
    getPartnerSubscriptionState(pmid),
    db.queryOne(
      DB,
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE COALESCE(sp.isverified, 0) = 1)::int AS approved,
              COUNT(*) FILTER (WHERE COALESCE(sp.isverified, 0) = 0)::int AS pending,
              COUNT(*) FILTER (WHERE COALESCE(sp.isverified, 0) = 2)::int AS rejected
       FROM ims_subproduct sp
       JOIN ims_masterproduct mp ON mp.mprid = sp.mprid
       WHERE mp.companyid = @pmid`,
      { pmid }
    ),
    db.queryOne(
      DB,
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE fulfillment_status IN ('pending','accepted','preparing','out_for_delivery','shipped'))::int AS active,
              COUNT(*) FILTER (WHERE fulfillment_status = 'delivered')::int AS delivered,
              COALESCE(SUM(total_amount), 0)::numeric(12,2) AS revenue
       FROM commerza_orders WHERE pmid = @pmid`,
      { pmid }
    ),
    db.queryOne(DB, 'SELECT is_profile_completed, latitude, longitude FROM commerza_shop_details WHERE pmid = @pmid', { pmid }),
    db.queryOne(DB, 'SELECT local_delivery_enabled, shiprocket_enabled FROM commerza_shop_delivery_settings WHERE pmid = @pmid', { pmid }),
    db.scalar(DB, 'SELECT COUNT(*)::int FROM commerza_coupons WHERE pmid = @pmid AND is_active = true', { pmid }),
    db.scalar(DB, 'SELECT COUNT(*)::int FROM commerza_portal_users WHERE pmid = @pmid AND is_active = true', { pmid }),
    db.query(
      DB,
      `SELECT id, order_number, customer_name, total_amount, delivery_method, fulfillment_status, created_at
       FROM commerza_orders WHERE pmid = @pmid ORDER BY id DESC LIMIT 6`,
      { pmid }
    ),
    db.query(
      DB,
      `SELECT to_char(d::date, 'Mon DD') AS label,
              COALESCE(COUNT(o.id), 0)::int AS orders,
              COALESCE(SUM(o.total_amount), 0)::numeric(12,2) AS revenue
       FROM generate_series(CURRENT_DATE - interval '6 days', CURRENT_DATE, interval '1 day') AS d
       LEFT JOIN commerza_orders o ON o.pmid = @pmid AND o.created_at::date = d::date
       GROUP BY d::date
       ORDER BY d::date ASC`,
      { pmid }
    ),
    db.query(
      DB,
      `SELECT fulfillment_status AS label, COUNT(*)::int AS value
       FROM commerza_orders WHERE pmid = @pmid GROUP BY fulfillment_status`,
      { pmid }
    ),
    db.query(
      DB,
      `SELECT delivery_method AS label, COUNT(*)::int AS value
       FROM commerza_orders WHERE pmid = @pmid GROUP BY delivery_method`,
      { pmid }
    ),
  ]);

  res.json({
    status: 'true',
    stats: {
      subscription: subState,
      products: prodStats || { total: 0, approved: 0, pending: 0, rejected: 0 },
      orders: orderStats || { total: 0, active: 0, delivered: 0, revenue: 0 },
      activeCoupons: Number(couponCount || 0),
      teamUsers: Number(userCount || 0),
      profileCompleted: Boolean(shopDetails?.is_profile_completed),
      hasMapLocation: Boolean(shopDetails?.latitude && shopDetails?.longitude),
      localDeliveryEnabled: Boolean(delivery?.local_delivery_enabled),
      shiprocketEnabled: Boolean(delivery?.shiprocket_enabled),
      latestOrders: latestOrders || [],
      salesTrend: salesTrend || [],
      orderStatusBreakdown: statusBreak || [],
      deliveryBreakdown: deliveryBreak || [],
    },
  });
}));

router.post('/api/partner/packages/purchase', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const { packageId, paymentMethod = 'upi', amountPaid, transactionRef = '', paymentProofUrl = '', notes = '' } = req.body || {};

  if (!packageId || !String(transactionRef).trim()) {
    return res.status(400).json({ status: 'false', message: 'packageId and transactionRef (UTR / Payment Reference) are required' });
  }

  const pkg = await db.queryOne(DB, 'SELECT * FROM commerza_packages WHERE id = @id AND is_active = true', { id: parseInt(packageId, 10) });
  if (!pkg) return res.status(404).json({ status: 'false', message: 'Package not found' });

  const pending = await db.queryOne(
    DB,
    "SELECT id FROM commerza_partner_subscriptions WHERE pmid = @pmid AND status = 'pending' LIMIT 1",
    { pmid }
  );
  if (pending) {
    return res.status(409).json({
      status: 'false',
      message: 'You already have a pending package payment awaiting admin verification.',
    });
  }

  const paid = amountPaid !== undefined ? Number(amountPaid) : Number(pkg.price);
  const sub = await db.queryOne(
    DB,
    `INSERT INTO commerza_partner_subscriptions (
       pmid, package_id, package_name, amount_expected, amount_paid,
       payment_method, transaction_ref, payment_proof_url, notes, status
     ) VALUES (
       @pmid, @pkgId, @pkgName, @expected, @paid,
       @method, @ref, @proof, @notes, 'pending'
     ) RETURNING *`,
    {
      pmid,
      pkgId: pkg.id,
      pkgName: pkg.name,
      expected: Number(pkg.price),
      paid,
      method: String(paymentMethod),
      ref: String(transactionRef).trim(),
      proof: String(paymentProofUrl || ''),
      notes: String(notes || ''),
    }
  );

  res.status(201).json({
    status: 'true',
    message: 'Package purchase submitted. Waiting for admin amount verification & approval.',
    subscription: sub,
  });
}));

// ---- Profile & Delivery Settings -----------------------------------------------------------
router.get('/api/partner/profile', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const shop = await db.queryOne(
    DB,
    `SELECT pm.*, ds.local_delivery_enabled, ds.local_pincodes, ds.local_radius_km, ds.local_fee,
            ds.local_eta_text, ds.local_rider_type, ds.shiprocket_enabled, ds.shiprocket_pickup_location,
            ds.default_weight_kg, ds.default_length_cm, ds.default_breadth_cm, ds.default_height_cm, ds.delivery_verified,
            sd.shop_category, sd.gst_number, sd.pan_number, sd.fssai_or_license,
            sd.bank_account_name, sd.bank_account_number, sd.bank_ifsc, sd.upi_id,
            sd.opening_time, sd.closing_time, sd.working_days, sd.city, sd.state,
            sd.landmark, sd.latitude, sd.longitude, sd.map_address,
            sd.shop_logo_url, sd.shop_banner_url, sd.is_profile_completed
     FROM portal_master pm
     LEFT JOIN commerza_shop_delivery_settings ds ON ds.pmid = pm.pmid
     LEFT JOIN commerza_shop_details sd ON sd.pmid = pm.pmid
     WHERE pm.pmid = @pmid`,
    { pmid }
  );
  if (!shop) return res.status(404).json({ status: 'false', message: 'Shop not found' });
  res.json({ status: 'true', shop });
}));

router.put('/api/partner/profile', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const b = req.body || {};

  await db.tx(DB, async (t) => {
    await t.query(
      `UPDATE portal_master
       SET companyname = COALESCE(@companyName, companyname),
           mobileno = COALESCE(@mobileno, mobileno),
           address = COALESCE(@address, address),
           pincode = COALESCE(@pincode, pincode),
           areaname = COALESCE(@areaName, areaname),
           companydesc = COALESCE(@companyDesc, companydesc),
           comemailid = COALESCE(@comemailid, comemailid),
           lankmark = COALESCE(@landmark, lankmark),
           companyimage = COALESCE(@logo, companyimage),
           companyprofileimage = COALESCE(@banner, companyprofileimage)
       WHERE pmid = @pmid`,
      {
        pmid,
        companyName: b.companyName ?? null,
        mobileno: b.mobileno ?? null,
        address: b.address ?? null,
        pincode: b.pincode ?? null,
        areaName: b.areaName ?? null,
        companyDesc: b.companyDesc ?? null,
        comemailid: b.comemailid ?? null,
        landmark: b.landmark ?? null,
        logo: b.shop_logo_url ?? null,
        banner: b.shop_banner_url ?? null,
      }
    );

    const lat = b.latitude !== undefined && b.latitude !== null && b.latitude !== '' ? Number(b.latitude) : null;
    const lng = b.longitude !== undefined && b.longitude !== null && b.longitude !== '' ? Number(b.longitude) : null;

    await t.query(
      `INSERT INTO commerza_shop_details (
         pmid, shop_category, gst_number, pan_number, fssai_or_license,
         bank_account_name, bank_account_number, bank_ifsc, upi_id,
         opening_time, closing_time, working_days, city, state, landmark,
         latitude, longitude, map_address, shop_logo_url, shop_banner_url,
         is_profile_completed, updated_at
       ) VALUES (
         @pmid, @cat, @gst, @pan, @fssai,
         @bankName, @bankAcc, @ifsc, @upi,
         @openTime, @closeTime, @workDays, @city, @state, @landmark,
         @lat, @lng, @mapAddr, @logo, @banner,
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
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         map_address = EXCLUDED.map_address,
         shop_logo_url = EXCLUDED.shop_logo_url,
         shop_banner_url = EXCLUDED.shop_banner_url,
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
        lat,
        lng,
        mapAddr: String(b.map_address || ''),
        logo: String(b.shop_logo_url || ''),
        banner: String(b.shop_banner_url || ''),
      }
    );
  });

  res.json({ status: 'true', message: 'Shop profile & location saved' });
}));

router.get('/api/partner/delivery-settings', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  let row = await db.queryOne(DB, 'SELECT * FROM commerza_shop_delivery_settings WHERE pmid = @pmid', { pmid });
  if (!row) {
    await db.query(DB, 'INSERT INTO commerza_shop_delivery_settings (pmid) VALUES (@pmid) ON CONFLICT DO NOTHING', { pmid });
    row = await db.queryOne(DB, 'SELECT * FROM commerza_shop_delivery_settings WHERE pmid = @pmid', { pmid });
  }
  res.json({ status: 'true', settings: row });
}));

router.put('/api/partner/delivery-settings', ...guard, requireApprovedSubscription, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const b = req.body || {};
  await db.query(
    DB,
    `INSERT INTO commerza_shop_delivery_settings (
       pmid, local_delivery_enabled, local_pincodes, local_radius_km, local_fee, local_eta_text,
       local_rider_type, shiprocket_enabled, shiprocket_pickup_location,
       default_weight_kg, default_length_cm, default_breadth_cm, default_height_cm, updated_at
     ) VALUES (
       @pmid, @localEnabled, @localPincodes, @localRadius, @localFee, @localEta,
       @riderType, @srEnabled, @srPickup,
       @w, @l, @br, @h, NOW()
     )
     ON CONFLICT (pmid) DO UPDATE SET
       local_delivery_enabled = EXCLUDED.local_delivery_enabled,
       local_pincodes = EXCLUDED.local_pincodes,
       local_radius_km = EXCLUDED.local_radius_km,
       local_fee = EXCLUDED.local_fee,
       local_eta_text = EXCLUDED.local_eta_text,
       local_rider_type = EXCLUDED.local_rider_type,
       shiprocket_enabled = EXCLUDED.shiprocket_enabled,
       shiprocket_pickup_location = EXCLUDED.shiprocket_pickup_location,
       default_weight_kg = EXCLUDED.default_weight_kg,
       default_length_cm = EXCLUDED.default_length_cm,
       default_breadth_cm = EXCLUDED.default_breadth_cm,
       default_height_cm = EXCLUDED.default_height_cm,
       updated_at = NOW()`,
    {
      pmid,
      localEnabled: b.local_delivery_enabled !== undefined ? Boolean(b.local_delivery_enabled) : true,
      localPincodes: String(b.local_pincodes ?? ''),
      localRadius: Number(b.local_radius_km ?? 5),
      localFee: Number(b.local_fee ?? 30),
      localEta: String(b.local_eta_text ?? '45-60 mins'),
      riderType: String(b.local_rider_type ?? 'self'),
      srEnabled: Boolean(b.shiprocket_enabled),
      srPickup: String(b.shiprocket_pickup_location ?? ''),
      w: Number(b.default_weight_kg ?? 0.5),
      l: Number(b.default_length_cm ?? 15),
      br: Number(b.default_breadth_cm ?? 15),
      h: Number(b.default_height_cm ?? 10),
    }
  );
  const settings = await db.queryOne(DB, 'SELECT * FROM commerza_shop_delivery_settings WHERE pmid = @pmid', { pmid });
  res.json({ status: 'true', message: 'Delivery settings saved', settings });
}));

// ---- Categories & Image Upload -------------------------------------------------------------
router.get('/api/partner/categories', ...guard, asyncHandler(async (_req, res) => {
  await ensureCommerzaSchema();
  const [groups, categories, subcategories] = await Promise.all([
    db.query(DB, 'SELECT gmid, groupname FROM tbl_categorygroupmaster WHERE COALESCE(status, 1) = 1 ORDER BY groupname ASC'),
    db.query(DB, 'SELECT catid, catname, gmid FROM product_category WHERE COALESCE(catactive, true) = true ORDER BY catname ASC'),
    db.query(DB, 'SELECT scatid, scatname, catid FROM product_subcategory WHERE COALESCE(scatactive, true) = true ORDER BY scatname ASC'),
  ]);
  res.json({ status: 'true', groups, categories, subcategories });
}));

router.post('/api/partner/upload-image', ...guard, asyncHandler(async (req, res) => {
  const { dataUrl, fileName } = req.body || {};
  if (!dataUrl || typeof dataUrl !== 'string') {
    return res.status(400).json({ status: 'false', message: 'dataUrl is required' });
  }
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ status: 'false', message: 'Invalid base64 image dataUrl' });
  }
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1].replace(/[^a-z0-9]/gi, '') || 'png';
  const dir = path.join(config.uploadDir, 'products');
  fs.mkdirSync(dir, { recursive: true });
  const safeName = makeSafeFileName(`p${req.user.pmid || req.user.plid}`, ext);
  fs.writeFileSync(path.join(dir, safeName), Buffer.from(match[2], 'base64'));
  res.json({ status: 'true', url: `/uploads/products/${safeName}`, fileName: fileName || safeName });
}));

// ---- Products & Variants CRUD --------------------------------------------------------------
function buildImagesString(thumbnailUrl, galleryImages, fallbackString) {
  const list = [];
  if (thumbnailUrl && String(thumbnailUrl).trim()) list.push(String(thumbnailUrl).trim());
  if (Array.isArray(galleryImages)) {
    for (const img of galleryImages) {
      const s = String(img || '').trim();
      if (s && !list.includes(s)) list.push(s);
    }
  }
  if (list.length > 0) return list.join('^');
  return String(fallbackString || '');
}

async function getCatalogMetaForCategory(catid) {
  const cid = parseInt(catid || 0, 10) || 0;
  const mappedUnits = cid > 0
    ? await db.query(
      DB,
      `SELECT u.*, cu.is_default
         FROM commerza_category_units cu
         JOIN commerza_units u ON u.id = cu.unit_id
         WHERE cu.catid = @cid AND u.is_active = true
         ORDER BY cu.is_default DESC, u.sort_order ASC, u.id ASC`,
      { cid }
    )
    : [];

  const units = mappedUnits.length > 0
    ? mappedUnits
    : await db.query(
      DB,
      `SELECT *, (code = 'pcs') AS is_default
         FROM commerza_units
         WHERE is_active = true
         ORDER BY sort_order ASC, id ASC`
    );

  const defaultUnitCode = (units.find((u) => u.is_default) || units[0])?.code || 'pcs';

  const mappedSizes = cid > 0
    ? await db.query(
      DB,
      `SELECT s.*, cs.is_default
         FROM commerza_category_sizes cs
         JOIN commerza_sizes s ON s.id = cs.size_id
         WHERE cs.catid = @cid AND s.is_active = true
         ORDER BY cs.is_default DESC, s.sort_order ASC, s.id ASC`,
      { cid }
    )
    : [];

  const sizes = mappedSizes.length > 0
    ? mappedSizes
    : await db.query(
      DB,
      `SELECT *, (code = 'Standard') AS is_default
         FROM commerza_sizes
         WHERE is_active = true
         ORDER BY sort_order ASC, id ASC`
    );

  const defaultSizeCode = (sizes.find((s) => s.is_default) || sizes[0])?.code || '';

  const attributes = await db.query(
    DB,
    `SELECT * FROM commerza_category_attributes
     WHERE is_active = true AND (catid = 0 OR catid = @cid)
     ORDER BY CASE WHEN catid = @cid THEN 0 ELSE 1 END, sort_order ASC, id ASC`,
    { cid }
  );

  return {
    units,
    defaultUnitCode,
    sizes,
    defaultSizeCode,
    attributes,
    restrictedToCategory: mappedUnits.length > 0,
    sizesRestrictedToCategory: mappedSizes.length > 0,
  };
}

async function resolveValidUnit(catid, rawUnit) {
  const meta = await getCatalogMetaForCategory(catid);
  const val = String(rawUnit || meta.defaultUnitCode || 'pcs').trim();
  const matched = meta.units.find(
    (u) => u.code.toLowerCase() === val.toLowerCase() || u.symbol.toLowerCase() === val.toLowerCase()
  );
  if (!matched) {
    const allowedList = meta.units.map((u) => u.code).join(', ');
    const err = new Error(`Invalid unit '${val}'. Allowed backend units${meta.restrictedToCategory ? ' for this category' : ''}: ${allowedList}`);
    err.status = 400;
    throw err;
  }
  return matched.code;
}

async function resolveValidSize(catid, rawSize) {
  const val = String(rawSize || '').trim();
  if (!val) return '';
  const meta = await getCatalogMetaForCategory(catid);
  const matched = meta.sizes.find(
    (s) => s.code.toLowerCase() === val.toLowerCase() || s.name.toLowerCase() === val.toLowerCase()
  );
  if (!matched) {
    const allowedList = meta.sizes.map((s) => s.code).join(', ');
    const err = new Error(`Invalid size '${val}'. Allowed backend sizes${meta.sizesRestrictedToCategory ? ' for this category' : ''}: ${allowedList}`);
    err.status = 400;
    throw err;
  }
  return matched.code;
}

router.get('/api/partner/catalog-meta', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const catid = parseInt(req.query.catid || 0, 10) || 0;
  const meta = await getCatalogMetaForCategory(catid);
  res.json({ status: 'true', catid, ...meta });
}));

router.get('/api/partner/products', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const statusFilter = req.query.status; // 'all' | 'approved' | 'pending' | 'rejected'
  const search = String(req.query.search || '').trim();
  const gmid = parseInt(req.query.gmid || 0, 10) || 0;
  const catid = parseInt(req.query.catid || 0, 10) || 0;
  const subcatid = parseInt(req.query.subcatid || 0, 10) || 0;
  const mprid = parseInt(req.query.mprid || 0, 10) || 0;
  const stockStatus = String(req.query.stockStatus || 'all').toLowerCase();
  const createdFrom = String(req.query.createdFrom || '').trim();
  const createdTo = String(req.query.createdTo || '').trim();

  const page = Math.max(1, parseInt(req.query.page || 1, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || 25, 10) || 25));
  const offset = (page - 1) * limit;

  let where = 'mp.companyid = @pmid';
  if (statusFilter === 'approved') where += ' AND COALESCE(sp.isverified, 0) = 1';
  else if (statusFilter === 'pending') where += ' AND COALESCE(sp.isverified, 0) = 0';
  else if (statusFilter === 'rejected') where += ' AND COALESCE(sp.isverified, 0) = 2';

  if (mprid > 0) where += ' AND mp.mprid = @mprid';
  if (gmid > 0) where += ' AND pc.gmid = @gmid';
  if (catid > 0) where += ' AND mp.catid = @catid';
  if (subcatid > 0) where += ' AND mp.subcategoryid = @subcatid';

  if (stockStatus === 'in_stock') where += ' AND COALESCE(sp.stocknet, sp.qty, 0) > 0';
  else if (stockStatus === 'low_stock') where += ' AND COALESCE(sp.stocknet, sp.qty, 0) > 0 AND COALESCE(sp.stocknet, sp.qty, 0) <= 10';
  else if (stockStatus === 'out_of_stock') where += ' AND COALESCE(sp.stocknet, sp.qty, 0) <= 0';

  if (createdFrom) where += ' AND mp.createddate::date >= @createdFrom::date';
  if (createdTo) where += ' AND mp.createddate::date <= @createdTo::date';

  if (search) {
    where += ` AND (
      mp.producttitle ILIKE @q OR sp.subprcode ILIKE @q OR mp.productcode ILIKE @q
      OR sp.prskucode ILIKE @q OR sp.color ILIKE @q OR sp.size ILIKE @q
      OR pc.catname ILIKE @q OR sc.scatname ILIKE @q
    )`;
  }

  const params = {
    pmid,
    mprid,
    gmid,
    catid,
    subcatid,
    createdFrom: createdFrom || null,
    createdTo: createdTo || null,
    q: `%${search}%`,
    limit,
    offset,
  };

  const total = Number(await db.scalar(
    DB,
    `SELECT COUNT(*)::int
     FROM ims_subproduct sp
     JOIN ims_masterproduct mp ON mp.mprid = sp.mprid
     LEFT JOIN product_category pc ON pc.catid = mp.catid
     LEFT JOIN product_subcategory sc ON sc.scatid = mp.subcategoryid
     WHERE ${where}`,
    params
  ) || 0);

  const products = await db.query(
    DB,
    `SELECT sp.sprid, sp.subprcode, sp.prskucode, sp.mprid, mp.producttitle, mp.productcode,
            mp.catid, mp.subcategoryid, pc.gmid, gm.groupname, pc.catname, sc.scatname,
            mp.shotdescription, mp.fulldescription, mp.keyfeatures,
            mp.minorderqty, mp.maxorderqty, mp.createddate, mp.modifydate,
            sp.qty, sp.unit, sp.color, sp.color_hex, sp.size, sp.stockin, sp.stockout, sp.stocknet,
            sp.isoutofstock, sp.productimages, sp.actualprice, sp.sellmrp, sp.dap,
            sp.discountpercentage, sp.isallowcoupon, sp.cashondelivery, sp.shippingcharges, sp.replacementday,
            sp.procurementsla, sp.specification, sp.manufacturerdetails,
            sp.isactive, sp.isverified,
            COALESCE(sp.weight_kg, pm_meta.weight_kg) AS weight_kg,
            COALESCE(sp.length_cms, pm_meta.length_cm) AS length_cm,
            COALESCE(sp.breadth_cms, pm_meta.breadth_cm) AS breadth_cm,
            COALESCE(sp.height_cms, pm_meta.height_cm) AS height_cm,
            COALESCE(NULLIF(sp.hsn, ''), pm_meta.hsn_code) AS hsn_code,
            COALESCE(pm_meta.discount_type, 'percentage') AS discount_type,
            COALESCE(pm_meta.discount_value, sp.discountpercentage, 0) AS discount_value,
            COALESCE(NULLIF(sp.rejectremark, ''), pm_meta.reject_remark) AS reject_remark
     FROM ims_subproduct sp
     JOIN ims_masterproduct mp ON mp.mprid = sp.mprid
     LEFT JOIN product_category pc ON pc.catid = mp.catid
     LEFT JOIN tbl_categorygroupmaster gm ON gm.gmid = pc.gmid
     LEFT JOIN product_subcategory sc ON sc.scatid = mp.subcategoryid
     LEFT JOIN commerza_product_meta pm_meta ON pm_meta.sprid = sp.sprid
     WHERE ${where}
     ORDER BY mp.mprid DESC, sp.sprid DESC
     LIMIT @limit OFFSET @offset`,
    params
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

  res.json({
    status: 'true',
    products: enriched,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}));

async function insertVariantTx(t, { mprid, pmid, productCode, catid, subcatid, v, index }) {
  const nextSprid = await t.scalar('SELECT COALESCE(MAX(sprid), 0) + 1 FROM ims_subproduct');
  const subPrCode = v.skuCode || `${productCode}-V${index + 1}`;
  const stock = Math.max(0, parseInt(v.stock ?? 0, 10) || 0);
  const mrp = Number(v.sellMrp);
  const discountType = v.discountType === 'fixed' ? 'fixed' : 'percentage';
  let discountValue = Number(v.discountValue ?? 0);
  let price = v.sellingPrice !== undefined && v.sellingPrice !== '' ? Number(v.sellingPrice) : mrp;
  if (discountValue > 0 && (v.sellingPrice === undefined || v.sellingPrice === '' || v.sellingPrice === null)) {
    price = discountType === 'fixed'
      ? Math.max(0, Number((mrp - discountValue).toFixed(2)))
      : Math.max(0, Number((mrp * (1 - discountValue / 100)).toFixed(2)));
  } else if (mrp > 0 && price <= mrp && !discountValue) {
    discountValue = Number((((mrp - price) / mrp) * 100).toFixed(2));
  }
  const discountPct = mrp > 0 && price <= mrp ? Number((((mrp - price) / mrp) * 100).toFixed(2)) : 0;
  const imagesStr = buildImagesString(v.thumbnailUrl, v.galleryImages, v.productImages);

  await t.query(
    `INSERT INTO ims_subproduct (
       sprid, subprcode, prskucode, mprid, qty, unit, color, color_hex, size,
       stockin, stockout, stocknet, isoutofstock, productimages,
       actualprice, sellmrp, dap, discountpercentage, isallowcoupon,
       cashondelivery, shippingcharges, replacementday, procurementsla,
       weight_kg, length_cms, breadth_cms, height_cms, hsn,
       specification, manufacturerdetails, createddate, modifydate,
       isactive, isverified
     ) VALUES (
       @sprid, @subPrCode, @subPrCode, @mprid, @stock, @unit, @color, @colorHex, @size,
       @stock, 0, @stock, @outOfStock, @images,
       @sellingPrice, @sellMrp, @sellingPrice, @discountPct, @allowCoupon,
       @cod, @shipping, @replacementDay, @sla,
       @w, @l, @br, @h, @hsn,
       @spec, @mfg, NOW(), NOW(),
       false, 0
     )`,
    {
      sprid: nextSprid,
      subPrCode,
      mprid,
      stock,
      unit: String(v.unit || 'pcs'),
      color: String(v.color || ''),
      colorHex: String(v.colorHex || v.color_hex || ''),
      size: String(v.size || ''),
      outOfStock: stock <= 0,
      images: imagesStr,
      sellingPrice: price,
      sellMrp: mrp,
      discountPct,
      allowCoupon: v.isAllowCoupon !== undefined ? Boolean(v.isAllowCoupon) : true,
      cod: v.cashOnDelivery !== undefined ? Boolean(v.cashOnDelivery) : true,
      shipping: Number(v.shippingCharges ?? 0),
      replacementDay: parseInt(v.replacementDay ?? 7, 10),
      sla: parseInt(v.procurementSla ?? 2, 10),
      w: Number(v.weightKg ?? 0.5),
      l: Number(v.lengthCm ?? 15),
      br: Number(v.breadthCm ?? 15),
      h: Number(v.heightCm ?? 10),
      hsn: String(v.hsnCode || ''),
      spec: String(v.specification || ''),
      mfg: String(v.manufacturerDetails || ''),
    }
  );

  await t.query(
    `INSERT INTO commerza_product_meta (sprid, pmid, weight_kg, length_cm, breadth_cm, height_cm, hsn_code, discount_type, discount_value)
     VALUES (@sprid, @pmid, @w, @l, @br, @h, @hsn, @dType, @dVal)`,
    {
      sprid: nextSprid,
      pmid,
      w: Number(v.weightKg ?? 0.5),
      l: Number(v.lengthCm ?? 15),
      br: Number(v.breadthCm ?? 15),
      h: Number(v.heightCm ?? 10),
      hsn: String(v.hsnCode || ''),
      dType: discountType,
      dVal: discountValue,
    }
  );

  if (Array.isArray(v.attributes)) {
    let pos = 1;
    for (const attr of v.attributes) {
      if (!attr?.title || !attr?.value) continue;
      const nextMpaid = await t.scalar('SELECT COALESCE(MAX(mpaid), 0) + 1 FROM ims_masterproductattribute');
      await t.query(
        `INSERT INTO ims_masterproductattribute (mpaid, sprid, title, value, showongrid, position, isactive, catid, subcatid)
         VALUES (@mpaid, @sprid, @title, @value, true, @pos, true, @catid, @subcatid)`,
        {
          mpaid: nextMpaid,
          sprid: nextSprid,
          title: String(attr.title).trim(),
          value: String(attr.value).trim(),
          pos: pos++,
          catid,
          subcatid,
        }
      );
    }
  }

  return Number(nextSprid);
}

router.post('/api/partner/products', ...guard, requireApprovedSubscription, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const plid = Number(req.user.plid);
  const b = req.body || {};

  const variantsInput = Array.isArray(b.variants) && b.variants.length > 0 ? b.variants : [b];

  if (req.subscriptionState.usedProducts + variantsInput.length > req.subscriptionState.maxProducts) {
    return res.status(403).json({
      status: 'false',
      code: 'PLAN_LIMIT_REACHED',
      message: `Your current plan allows up to ${req.subscriptionState.maxProducts} product variants. Upgrade your plan to add more.`,
    });
  }

  if (!b.productTitle || variantsInput.some((v) => v.sellMrp === undefined || (v.sellingPrice === undefined && v.discountValue === undefined))) {
    return res.status(400).json({ status: 'false', message: 'productTitle and variant sellMrp / sellingPrice (or discountValue) are required' });
  }

  const created = await db.tx(DB, async (t) => {
    const nextMprid = await t.scalar('SELECT COALESCE(MAX(mprid), 0) + 1 FROM ims_masterproduct');
    const productCode = b.productCode || `CMZ-${pmid}-${nextMprid}`;
    const catid = parseInt(b.catid || 1, 10);
    const subcatid = parseInt(b.subcatid || 0, 10);

    await t.query(
      `INSERT INTO ims_masterproduct (
         mprid, productcode, maincategoryid, subcategoryid, brandid, producttitle,
         shotdescription, fulldescription, minorderqty, maxorderqty, paymode,
         companyid, branchid, createddate, modifydate, catid, keyfeatures
       ) VALUES (
         @mprid, @productCode, @catid, @subcatid, 0, @title,
         @shortDesc, @fullDesc, @minQty, @maxQty, 'ALL',
         @pmid, @plid, NOW(), NOW(), @catid, @keyFeatures
       )`,
      {
        mprid: nextMprid,
        productCode,
        catid,
        subcatid,
        title: String(b.productTitle).trim(),
        shortDesc: String(b.shortDescription || ''),
        fullDesc: String(b.fullDescription || ''),
        minQty: parseInt(b.minOrderQty || 1, 10),
        maxQty: parseInt(b.maxOrderQty || 50, 10),
        pmid,
        plid,
        keyFeatures: String(b.keyFeatures || ''),
      }
    );

    const sprids = [];
    for (let i = 0; i < variantsInput.length; i++) {
      const validUnit = await resolveValidUnit(catid, variantsInput[i].unit);
      const validSize = await resolveValidSize(catid, variantsInput[i].size);
      const v = {
        ...variantsInput[i],
        unit: validUnit,
        size: validSize,
        hsnCode: variantsInput[i].hsnCode ?? b.hsnCode,
        specification: variantsInput[i].specification ?? b.specification,
        manufacturerDetails: variantsInput[i].manufacturerDetails ?? b.manufacturerDetails,
        cashOnDelivery: variantsInput[i].cashOnDelivery ?? b.cashOnDelivery,
        shippingCharges: variantsInput[i].shippingCharges ?? b.shippingCharges,
        replacementDay: variantsInput[i].replacementDay ?? b.replacementDay,
        procurementSla: variantsInput[i].procurementSla ?? b.procurementSla,
        attributes: variantsInput[i].attributes ?? b.attributes,
      };
      const sprid = await insertVariantTx(t, { mprid: nextMprid, pmid, productCode, catid, subcatid, v, index: i });
      sprids.push(sprid);
    }

    return { mprid: Number(nextMprid), sprid: sprids[0], sprids };
  });

  res.status(201).json({
    status: 'true',
    message: `Product with ${created.sprids.length} variant(s) submitted for admin approval`,
    ...created,
  });
}));

router.post('/api/partner/products/:mprid/variants', ...guard, requireApprovedSubscription, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const mprid = parseInt(req.params.mprid, 10);
  const v = req.body || {};

  if (req.subscriptionState.usedProducts >= req.subscriptionState.maxProducts) {
    return res.status(403).json({ status: 'false', code: 'PLAN_LIMIT_REACHED', message: 'Plan variant limit reached.' });
  }

  const master = await db.queryOne(DB, 'SELECT * FROM ims_masterproduct WHERE mprid = @mprid AND companyid = @pmid', { mprid, pmid });
  if (!master) return res.status(404).json({ status: 'false', message: 'Master product not found' });

  const existingCount = await db.scalar(DB, 'SELECT COUNT(*)::int FROM ims_subproduct WHERE mprid = @mprid', { mprid });
  const validUnit = await resolveValidUnit(master.catid || 1, v.unit);
  const validSize = await resolveValidSize(master.catid || 1, v.size);

  const sprid = await db.tx(DB, (t) =>
    insertVariantTx(t, {
      mprid,
      pmid,
      productCode: master.productcode,
      catid: master.catid || 1,
      subcatid: master.subcategoryid || 0,
      v: { ...v, unit: validUnit, size: validSize },
      index: Number(existingCount || 0),
    })
  );

  res.status(201).json({ status: 'true', message: 'Variant added and submitted for approval', mprid, sprid });
}));

router.put('/api/partner/products/:sprid', ...guard, requireApprovedSubscription, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const sprid = parseInt(req.params.sprid, 10);
  const b = req.body || {};

  const existing = await db.queryOne(
    DB,
    `SELECT sp.sprid, sp.mprid, mp.catid FROM ims_subproduct sp
     JOIN ims_masterproduct mp ON mp.mprid = sp.mprid
     WHERE sp.sprid = @sprid AND mp.companyid = @pmid`,
    { sprid, pmid }
  );
  if (!existing) return res.status(404).json({ status: 'false', message: 'Product not found' });

  const validUnit = b.unit !== undefined ? await resolveValidUnit(b.catid ?? existing.catid, b.unit) : null;
  const validSize = b.size !== undefined ? await resolveValidSize(b.catid ?? existing.catid, b.size) : null;

  await db.tx(DB, async (t) => {
    await t.query(
      `UPDATE ims_masterproduct
       SET producttitle = COALESCE(@title, producttitle),
           catid = COALESCE(@catid, catid),
           maincategoryid = COALESCE(@catid, maincategoryid),
           subcategoryid = COALESCE(@subcatid, subcategoryid),
           shotdescription = COALESCE(@shortDesc, shotdescription),
           fulldescription = COALESCE(@fullDesc, fulldescription),
           keyfeatures = COALESCE(@keyFeatures, keyfeatures),
           modifydate = NOW()
       WHERE mprid = @mprid`,
      {
        mprid: existing.mprid,
        title: b.productTitle ?? null,
        catid: b.catid !== undefined ? parseInt(b.catid, 10) : null,
        subcatid: b.subcatid !== undefined ? parseInt(b.subcatid, 10) : null,
        shortDesc: b.shortDescription ?? null,
        fullDesc: b.fullDescription ?? null,
        keyFeatures: b.keyFeatures ?? null,
      }
    );

    const stockVal = b.stock !== undefined ? Math.max(0, parseInt(b.stock, 10) || 0) : null;
    const imagesStr = (b.thumbnailUrl !== undefined || Array.isArray(b.galleryImages))
      ? buildImagesString(b.thumbnailUrl, b.galleryImages, b.productImages)
      : (b.productImages ?? null);

    await t.query(
      `UPDATE ims_subproduct
       SET sellmrp = COALESCE(@sellMrp, sellmrp),
           dap = COALESCE(@sellingPrice, dap),
           actualprice = COALESCE(@sellingPrice, actualprice),
           unit = COALESCE(@unit, unit),
           color = COALESCE(@color, color),
           color_hex = COALESCE(@colorHex, color_hex),
           size = COALESCE(@size, size),
           productimages = COALESCE(@images, productimages),
           qty = COALESCE(@stock, qty),
           stocknet = COALESCE(@stock, stocknet),
           isoutofstock = CASE WHEN @stock IS NOT NULL THEN (@stock <= 0) ELSE isoutofstock END,
           cashondelivery = COALESCE(@cod, cashondelivery),
           shippingcharges = COALESCE(@shipping, shippingcharges),
           replacementday = COALESCE(@replacementDay, replacementday),
           procurementsla = COALESCE(@sla, procurementsla),
           specification = COALESCE(@spec, specification),
           hsn = COALESCE(@hsn, hsn),
           weight_kg = COALESCE(@w, weight_kg),
           length_cms = COALESCE(@l, length_cms),
           breadth_cms = COALESCE(@br, breadth_cms),
           height_cms = COALESCE(@h, height_cms),
           modifydate = NOW(),
           isverified = 0
       WHERE sprid = @sprid`,
      {
        sprid,
        sellMrp: b.sellMrp !== undefined ? Number(b.sellMrp) : null,
        sellingPrice: b.sellingPrice !== undefined ? Number(b.sellingPrice) : null,
        allowCoupon: b.isAllowCoupon !== undefined ? Boolean(b.isAllowCoupon) : null,
        unit: validUnit,
        color: b.color ?? null,
        colorHex: b.colorHex ?? b.color_hex ?? null,
        size: validSize,
        images: imagesStr,
        stock: stockVal,
        cod: b.cashOnDelivery !== undefined ? Boolean(b.cashOnDelivery) : null,
        shipping: b.shippingCharges !== undefined ? Number(b.shippingCharges) : null,
        replacementDay: b.replacementDay !== undefined ? parseInt(b.replacementDay, 10) : null,
        sla: b.procurementSla !== undefined ? parseInt(b.procurementSla, 10) : null,
        spec: b.specification ?? null,
        hsn: b.hsnCode ?? null,
        w: b.weightKg !== undefined ? Number(b.weightKg) : null,
        l: b.lengthCm !== undefined ? Number(b.lengthCm) : null,
        br: b.breadthCm !== undefined ? Number(b.breadthCm) : null,
        h: b.heightCm !== undefined ? Number(b.heightCm) : null,
      }
    );

    if (Array.isArray(b.attributes)) {
      await t.query('DELETE FROM ims_masterproductattribute WHERE sprid = @sprid', { sprid });
      let pos = 1;
      for (const attr of b.attributes) {
        if (!attr?.title || !attr?.value) continue;
        const nextMpaid = await t.scalar('SELECT COALESCE(MAX(mpaid), 0) + 1 FROM ims_masterproductattribute');
        await t.query(
          `INSERT INTO ims_masterproductattribute (mpaid, sprid, title, value, showongrid, position, isactive, catid, subcatid)
           VALUES (@mpaid, @sprid, @title, @value, true, @pos, true, @catid, 0)`,
          { mpaid: nextMpaid, sprid, title: String(attr.title).trim(), value: String(attr.value).trim(), pos: pos++, catid: parseInt(b.catid || 1, 10) }
        );
      }
    }

    await t.query(
      `INSERT INTO commerza_product_meta (sprid, pmid, weight_kg, length_cm, breadth_cm, height_cm, hsn_code, reject_remark, updated_at)
       VALUES (@sprid, @pmid, @w, @l, @br, @h, @hsn, '', NOW())
       ON CONFLICT (sprid) DO UPDATE SET
         weight_kg = COALESCE(@w, commerza_product_meta.weight_kg),
         length_cm = COALESCE(@l, commerza_product_meta.length_cm),
         breadth_cm = COALESCE(@br, commerza_product_meta.breadth_cm),
         height_cm = COALESCE(@h, commerza_product_meta.height_cm),
         hsn_code = COALESCE(@hsn, commerza_product_meta.hsn_code),
         reject_remark = '',
         updated_at = NOW()`,
      {
        sprid,
        pmid,
        w: b.weightKg !== undefined ? Number(b.weightKg) : 0.5,
        l: b.lengthCm !== undefined ? Number(b.lengthCm) : 15,
        br: b.breadthCm !== undefined ? Number(b.breadthCm) : 15,
        h: b.heightCm !== undefined ? Number(b.heightCm) : 10,
        hsn: b.hsnCode ?? '',
      }
    );
  });

  res.json({ status: 'true', message: 'Product updated and re-submitted for approval' });
}));

router.patch('/api/partner/products/:sprid/stock', ...guard, requireApprovedSubscription, asyncHandler(async (req, res) => {
  const pmid = Number(req.user.pmid);
  const sprid = parseInt(req.params.sprid, 10);
  const stock = Math.max(0, parseInt(req.body?.stock ?? 0, 10) || 0);
  const updated = await db.exec(
    DB,
    `UPDATE ims_subproduct sp
     SET qty = @stock, stocknet = @stock, isoutofstock = (@stock <= 0)
     FROM ims_masterproduct mp
     WHERE sp.mprid = mp.mprid AND sp.sprid = @sprid AND mp.companyid = @pmid`,
    { sprid, pmid, stock }
  );
  if (!updated) return res.status(404).json({ status: 'false', message: 'Product not found' });
  res.json({ status: 'true', message: 'Stock updated', stock });
}));

router.delete('/api/partner/products/:sprid', ...guard, asyncHandler(async (req, res) => {
  const pmid = Number(req.user.pmid);
  const sprid = parseInt(req.params.sprid, 10);
  const existing = await db.queryOne(
    DB,
    `SELECT sp.sprid, sp.mprid, mp.catid FROM ims_subproduct sp
     JOIN ims_masterproduct mp ON mp.mprid = sp.mprid
     WHERE sp.sprid = @sprid AND mp.companyid = @pmid`,
    { sprid, pmid }
  );
  if (!existing) return res.status(404).json({ status: 'false', message: 'Product not found' });

  const validUnit = b.unit !== undefined ? await resolveValidUnit(b.catid ?? existing.catid, b.unit) : null;
  const validSize = b.size !== undefined ? await resolveValidSize(b.catid ?? existing.catid, b.size) : null;
  await db.exec(DB, 'DELETE FROM ims_subproduct WHERE sprid = @sprid', { sprid });
  await db.exec(DB, 'DELETE FROM commerza_product_meta WHERE sprid = @sprid', { sprid });
  res.json({ status: 'true', message: 'Product removed' });
}));

// ---- Storefront Customer Order Placement (Public) ------------------------------------------
router.post('/api/storefront/orders', asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items : [];
  if (items.length === 0) {
    return res.status(400).json({ status: 'false', message: 'Order items are required' });
  }

  const customerName = String(b.customerName || '').trim();
  const customerPhone = String(b.phone || b.customerPhone || '').trim();
  const customerEmail = String(b.email || b.customerEmail || '').trim();
  const address = [b.address, b.city, b.state].filter(Boolean).join(', ');
  const pincode = String(b.pincode || '').trim();
  if (!customerName || !customerPhone || !address || !pincode) {
    return res.status(400).json({ status: 'false', message: 'customerName, phone, address, and pincode are required' });
  }

  // Resolve shop pmid for each item from ims_subproduct -> ims_masterproduct
  const groupedByShop = new Map();
  for (const item of items) {
    const sprid = parseInt(item.sprid || item.id || 0, 10);
    let shopPmid = parseInt(item.pmid || 0, 10) || 0;
    if (!shopPmid && sprid > 0) {
      const row = await db.queryOne(
        DB,
        'SELECT mp.companyid AS pmid FROM ims_subproduct sp JOIN ims_masterproduct mp ON mp.mprid = sp.mprid WHERE sp.sprid = @sprid LIMIT 1',
        { sprid }
      );
      if (row?.pmid) shopPmid = Number(row.pmid);
    }
    if (!shopPmid) shopPmid = 1; // fallback to primary demo shop if catalog item has no companyid
    if (!groupedByShop.has(shopPmid)) groupedByShop.set(shopPmid, []);
    groupedByShop.get(shopPmid).push(item);
  }

  const baseOrderNo = String(b.orderNumber || `CO-${Date.now().toString().slice(-6)}`);
  const createdOrders = [];
  let idx = 0;

  for (const [pmid, shopItems] of groupedByShop.entries()) {
    idx += 1;
    const orderNumber = groupedByShop.size > 1 ? `${baseOrderNo}-${idx}` : baseOrderNo;
    const shopSubtotal = shopItems.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 1), 0);
    const deliveryFee = idx === 1 ? Number(b.shipping || b.deliveryFee || 0) : 0;
    const totalAmount = Number((shopSubtotal + deliveryFee).toFixed(2));

    const row = await db.queryOne(
      DB,
      `INSERT INTO commerza_orders (
         order_number, pmid, customer_name, customer_phone, customer_email,
         delivery_address, delivery_pincode, customer_latitude, customer_longitude,
         delivery_method, delivery_fee, subtotal, total_amount,
         payment_status, fulfillment_status, items_json
       ) VALUES (
         @orderNumber, @pmid, @name, @phone, @email,
         @addr, @pin, @lat, @lng,
         @method, @fee, @sub, @total,
         @payStatus, 'pending', @items::jsonb
       ) RETURNING *`,
      {
        orderNumber,
        pmid,
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        addr: address,
        pin: pincode,
        lat: b.latitude !== undefined ? Number(b.latitude) : null,
        lng: b.longitude !== undefined ? Number(b.longitude) : null,
        method: String(b.deliveryMethod || 'local'),
        fee: deliveryFee,
        sub: shopSubtotal,
        total: totalAmount,
        payStatus: String(b.paymentMethod || '').toUpperCase() === 'COD' ? 'cod_pending' : 'paid',
        items: JSON.stringify(shopItems),
      }
    );
    createdOrders.push(row);
  }

  res.status(201).json({
    status: 'true',
    message: 'Order placed and sent to partner shop(s)',
    orders: createdOrders,
  });
}));

// ---- Orders & Fulfillment ------------------------------------------------------------------
router.get('/api/partner/orders', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const status = String(req.query.status || 'all').toLowerCase();
  const deliveryMethod = String(req.query.deliveryMethod || 'all').toLowerCase();
  const search = String(req.query.search || '').trim();
  const page = Math.max(1, parseInt(req.query.page || 1, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || 25, 10) || 25));
  const offset = (page - 1) * limit;

  let where = 'o.pmid = @pmid';
  if (status && status !== 'all') where += ' AND o.fulfillment_status = @status';
  if (deliveryMethod && deliveryMethod !== 'all') where += ' AND o.delivery_method = @deliveryMethod';
  if (search) {
    where += ' AND (o.order_number ILIKE @q OR o.customer_name ILIKE @q OR o.customer_phone ILIKE @q OR o.delivery_pincode ILIKE @q OR o.assigned_delivery_name ILIKE @q)';
  }

  const params = { pmid, status, deliveryMethod, q: `%${search}%`, limit, offset };
  const total = Number(await db.scalar(DB, `SELECT COUNT(*)::int FROM commerza_orders o WHERE ${where}`, params) || 0);

  const orders = await db.query(
    DB,
    `SELECT o.*, s.provider, s.awb_code, s.courier_name, s.status AS shipment_status, s.tracking_url,
            sd.latitude AS shop_latitude, sd.longitude AS shop_longitude,
            pm.companyname AS shop_name, pm.address AS shop_address, pm.pincode AS shop_pincode,
            du.vehicle_type AS delivery_vehicle_type, du.vehicle_number AS delivery_vehicle_number
     FROM commerza_orders o
     LEFT JOIN portal_master pm ON pm.pmid = o.pmid
     LEFT JOIN commerza_shop_details sd ON sd.pmid = o.pmid
     LEFT JOIN commerza_portal_users du ON du.id = o.assigned_delivery_user_id AND du.pmid = o.pmid
     LEFT JOIN LATERAL (
       SELECT * FROM commerza_shipments sh WHERE sh.order_id = o.id ORDER BY sh.id DESC LIMIT 1
     ) s ON TRUE
     WHERE ${where}
     ORDER BY o.id DESC
     LIMIT @limit OFFSET @offset`,
    params
  );
  res.json({
    status: 'true',
    orders,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
}));

router.patch('/api/partner/orders/:id/assign-delivery', ...guard, requireApprovedSubscription, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const id = parseInt(req.params.id, 10);
  const { deliveryUserId, markOutForDelivery = false } = req.body || {};

  if (!deliveryUserId) {
    const updated = await db.exec(
      DB,
      `UPDATE commerza_orders
       SET assigned_delivery_user_id = NULL, assigned_delivery_name = '', assigned_delivery_phone = '', assigned_at = NULL, updated_at = NOW()
       WHERE id = @id AND pmid = @pmid`,
      { id, pmid }
    );
    if (!updated) return res.status(404).json({ status: 'false', message: 'Order not found' });
    return res.json({ status: 'true', message: 'Delivery boy unassigned' });
  }

  const rider = await db.queryOne(
    DB,
    `SELECT id, full_name, phone, is_active
     FROM commerza_portal_users
     WHERE id = @uid AND pmid = @pmid AND (user_type = 'delivery_boy' OR role = 'delivery_boy')`,
    { uid: parseInt(deliveryUserId, 10), pmid }
  );
  if (!rider) {
    return res.status(404).json({ status: 'false', message: 'Delivery boy not found for this shop' });
  }
  if (!rider.is_active) {
    return res.status(400).json({ status: 'false', message: 'Selected delivery boy is currently disabled' });
  }

  const updated = await db.exec(
    DB,
    `UPDATE commerza_orders
     SET assigned_delivery_user_id = @uid,
         assigned_delivery_name = @name,
         assigned_delivery_phone = @phone,
         assigned_at = NOW(),
         fulfillment_status = CASE WHEN @markOut AND fulfillment_status IN ('pending','accepted','preparing') THEN 'out_for_delivery' ELSE fulfillment_status END,
         updated_at = NOW()
     WHERE id = @id AND pmid = @pmid`,
    {
      id,
      pmid,
      uid: rider.id,
      name: rider.full_name,
      phone: rider.phone || '',
      markOut: Boolean(markOutForDelivery),
    }
  );
  if (!updated) return res.status(404).json({ status: 'false', message: 'Order not found' });

  res.json({ status: 'true', message: `Order assigned to ${rider.full_name}`, deliveryBoy: rider });
}));

router.patch('/api/partner/orders/:id/delivery-method', ...guard, requireApprovedSubscription, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const id = parseInt(req.params.id, 10);
  const method = String(req.body?.deliveryMethod || '').trim().toLowerCase();
  if (!['local', 'shiprocket'].includes(method)) {
    return res.status(400).json({ status: 'false', message: "deliveryMethod must be 'local' or 'shiprocket'" });
  }

  const updated = await db.exec(
    DB,
    `UPDATE commerza_orders
     SET delivery_method = @method,
         fulfillment_status = CASE WHEN fulfillment_status = 'pending' THEN 'accepted' ELSE fulfillment_status END,
         updated_at = NOW()
     WHERE id = @id AND pmid = @pmid`,
    { id, pmid, method }
  );
  if (!updated) return res.status(404).json({ status: 'false', message: 'Order not found' });
  res.json({ status: 'true', message: `Delivery method set to ${method}`, deliveryMethod: method });
}));

router.patch('/api/partner/orders/:id/status', ...guard, requireApprovedSubscription, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const id = parseInt(req.params.id, 10);
  const status = String(req.body?.status || '').trim();
  const allowed = ['pending', 'accepted', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ status: 'false', message: `Invalid status. Allowed: ${allowed.join(', ')}` });
  }
  const updated = await db.exec(
    DB,
    'UPDATE commerza_orders SET fulfillment_status = @status, updated_at = NOW() WHERE id = @id AND pmid = @pmid',
    { id, pmid, status }
  );
  if (!updated) return res.status(404).json({ status: 'false', message: 'Order not found' });
  res.json({ status: 'true', message: 'Order status updated', statusValue: status });
}));

router.post('/api/partner/orders/:id/shiprocket', ...guard, requireApprovedSubscription, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const id = parseInt(req.params.id, 10);
  const order = await db.queryOne(DB, 'SELECT * FROM commerza_orders WHERE id = @id AND pmid = @pmid', { id, pmid });
  if (!order) return res.status(404).json({ status: 'false', message: 'Order not found' });

  const settings = await db.queryOne(DB, 'SELECT * FROM commerza_shop_delivery_settings WHERE pmid = @pmid', { pmid });
  const weight = Number(req.body?.weightKg || settings?.default_weight_kg || 0.5);
  const length = Number(req.body?.lengthCm || settings?.default_length_cm || 15);
  const breadth = Number(req.body?.breadthCm || settings?.default_breadth_cm || 15);
  const height = Number(req.body?.heightCm || settings?.default_height_cm || 10);

  if (!shiprocket.isConfigured()) {
    return res.status(400).json({
      status: 'false',
      message: 'Shiprocket credentials are not configured in backend .env (SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD)',
    });
  }

  const items = Array.isArray(order.items_json) ? order.items_json : [];
  const srPayload = {
    order_id: order.order_number,
    order_date: new Date(order.created_at).toISOString().slice(0, 16).replace('T', ' '),
    pickup_location: settings?.shiprocket_pickup_location || 'Primary',
    billing_customer_name: order.customer_name || 'Customer',
    billing_last_name: '',
    billing_address: order.delivery_address || 'NA',
    billing_city: 'City',
    billing_pincode: order.delivery_pincode || '110001',
    billing_state: 'State',
    billing_country: 'India',
    billing_email: order.customer_email || 'customer@commerzaa.com',
    billing_phone: order.customer_phone || '9999999999',
    shipping_is_billing: true,
    order_items: items.length
      ? items.map((it) => ({
        name: it.title || 'Product',
        sku: it.sku || `SKU-${it.sprid || 1}`,
        units: it.qty || 1,
        selling_price: it.price || order.total_amount,
      }))
      : [{ name: 'Marketplace Order', sku: order.order_number, units: 1, selling_price: order.total_amount }],
    payment_method: order.payment_status === 'paid' ? 'Prepaid' : 'COD',
    sub_total: Number(order.total_amount),
    length,
    breadth,
    height,
    weight,
  };

  const srRes = await shiprocket.createAdhocOrder(srPayload);
  let awbData = null;
  if (srRes.shipment_id) {
    try { awbData = await shiprocket.assignAwb(srRes.shipment_id); } catch (_) { /* optional */ }
  }

  const awbCode = awbData?.response?.data?.awb_code || srRes.awb_code || null;
  const courierName = awbData?.response?.data?.courier_name || srRes.courier_name || null;

  await db.query(
    DB,
    `INSERT INTO commerza_shipments (
       order_id, pmid, provider, shiprocket_order_id, shiprocket_shipment_id,
       awb_code, courier_name, tracking_url, status, raw_payload
     ) VALUES (
       @oid, @pmid, 'shiprocket', @srOid, @srSid, @awb, @courier, @trackUrl, @status, @raw::jsonb
     )`,
    {
      oid: order.id,
      pmid,
      srOid: srRes.order_id ? String(srRes.order_id) : null,
      srSid: srRes.shipment_id ? String(srRes.shipment_id) : null,
      awb: awbCode,
      courier: courierName,
      trackUrl: awbCode ? `https://shiprocket.co/tracking/${awbCode}` : null,
      status: srRes.status || 'booked',
      raw: JSON.stringify({ order: srRes, awb: awbData }),
    }
  );

  await db.query(
    DB,
    `UPDATE commerza_orders SET delivery_method = 'shiprocket', fulfillment_status = 'shipped', updated_at = NOW() WHERE id = @oid`,
    { oid: order.id }
  );

  res.json({ status: 'true', message: 'Shiprocket shipment created', awbCode, courierName, shiprocket: srRes });
}));

// ---- Coupons CRUD --------------------------------------------------------------------------
router.get('/api/partner/coupons', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const coupons = await db.query(
    DB,
    `SELECT c.*, mp.producttitle
     FROM commerza_coupons c
     LEFT JOIN ims_masterproduct mp ON mp.mprid = c.mprid
     WHERE c.pmid = @pmid
     ORDER BY c.id DESC`,
    { pmid }
  );
  res.json({ status: 'true', coupons });
}));

router.post('/api/partner/coupons', ...guard, requireApprovedSubscription, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const b = req.body || {};
  const code = String(b.code || '').trim().toUpperCase();
  if (!code || b.discountValue === undefined) {
    return res.status(400).json({ status: 'false', message: 'code and discountValue are required' });
  }
  const row = await db.queryOne(
    DB,
    `INSERT INTO commerza_coupons (
       pmid, mprid, code, title, discount_type, discount_value,
       min_order_amount, max_discount, usage_limit, valid_until, is_active
     ) VALUES (
       @pmid, @mprid, @code, @title, @dType, @dVal,
       @minOrder, @maxDisc, @limit, @validUntil, true
     ) RETURNING *`,
    {
      pmid,
      mprid: b.mprid ? parseInt(b.mprid, 10) : null,
      code,
      title: String(b.title || `${code} Offer`),
      dType: b.discountType === 'fixed' ? 'fixed' : 'percentage',
      dVal: Number(b.discountValue),
      minOrder: Number(b.minOrderAmount ?? 0),
      maxDisc: Number(b.maxDiscount ?? 0),
      limit: parseInt(b.usageLimit ?? 100, 10),
      validUntil: b.validUntil || null,
    }
  );
  res.status(201).json({ status: 'true', coupon: row });
}));

router.patch('/api/partner/coupons/:id', ...guard, asyncHandler(async (req, res) => {
  const pmid = Number(req.user.pmid);
  const id = parseInt(req.params.id, 10);
  const active = Boolean(req.body?.is_active);
  const updated = await db.exec(DB, 'UPDATE commerza_coupons SET is_active = @active WHERE id = @id AND pmid = @pmid', { id, pmid, active });
  if (!updated) return res.status(404).json({ status: 'false', message: 'Coupon not found' });
  res.json({ status: 'true', message: 'Coupon updated' });
}));

router.delete('/api/partner/coupons/:id', ...guard, asyncHandler(async (req, res) => {
  const pmid = Number(req.user.pmid);
  const id = parseInt(req.params.id, 10);
  await db.exec(DB, 'DELETE FROM commerza_coupons WHERE id = @id AND pmid = @pmid', { id, pmid });
  res.json({ status: 'true', message: 'Coupon deleted' });
}));

// ---- Partner Staff Users & Delivery Boys ---------------------------------------------------
router.get('/api/partner/users', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const typeFilter = String(req.query.type || 'all').toLowerCase();
  let where = 'u.pmid = @pmid';
  if (typeFilter === 'delivery_boy') {
    where += " AND (u.user_type = 'delivery_boy' OR u.role = 'delivery_boy')";
  } else if (typeFilter === 'staff') {
    where += " AND u.user_type != 'delivery_boy' AND u.role != 'delivery_boy'";
  }
  const users = await db.query(
    DB,
    `SELECT u.id, u.pmid, u.full_name, u.email, u.phone, u.role, u.user_type,
            u.vehicle_type, u.vehicle_number, u.license_number, u.is_available,
            u.is_active, u.created_at,
            COALESCE(ord.active_orders, 0)::int AS active_orders
     FROM commerza_portal_users u
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS active_orders
       FROM commerza_orders o
       WHERE o.assigned_delivery_user_id = u.id
         AND o.fulfillment_status IN ('accepted', 'preparing', 'out_for_delivery')
     ) ord ON TRUE
     WHERE ${where}
     ORDER BY u.id DESC`,
    { pmid }
  );
  res.json({ status: 'true', users });
}));

router.post('/api/partner/users', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const {
    fullName,
    email,
    phone = '',
    password,
    role = 'catalog_manager',
    userType,
    vehicleType = '',
    vehicleNumber = '',
    licenseNumber = '',
  } = req.body || {};
  if (!fullName || !email || !password) {
    return res.status(400).json({ status: 'false', message: 'fullName, email, and password are required' });
  }
  const allowedRoles = ['owner', 'catalog_manager', 'order_manager', 'viewer', 'delivery_boy'];
  const finalRole = allowedRoles.includes(role) ? role : 'catalog_manager';
  const finalType = userType === 'delivery_boy' || finalRole === 'delivery_boy' ? 'delivery_boy' : 'staff';

  const row = await db.queryOne(
    DB,
    `INSERT INTO commerza_portal_users (
       pmid, full_name, email, phone, password, role, user_type, vehicle_type, vehicle_number, license_number
     ) VALUES (
       @pmid, @name, @email, @phone, @pw, @role, @userType, @vehicleType, @vehicleNumber, @licenseNumber
     )
     RETURNING id, pmid, full_name, email, phone, role, user_type, vehicle_type, vehicle_number, license_number, is_available, is_active, created_at`,
    {
      pmid,
      name: String(fullName).trim(),
      email: String(email).trim(),
      phone: String(phone),
      pw: Encryptword(password) || password,
      role: finalType === 'delivery_boy' ? 'delivery_boy' : finalRole,
      userType: finalType,
      vehicleType: String(vehicleType || ''),
      vehicleNumber: String(vehicleNumber || ''),
      licenseNumber: String(licenseNumber || ''),
    }
  );
  res.status(201).json({ status: 'true', user: row });
}));

router.patch('/api/partner/users/:id', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const id = parseInt(req.params.id, 10);
  const { role, is_active, is_available, fullName, phone, vehicleType, vehicleNumber, licenseNumber } = req.body || {};
  const updated = await db.exec(
    DB,
    `UPDATE commerza_portal_users
     SET role = COALESCE(@role, role),
         is_active = COALESCE(@active, is_active),
         is_available = COALESCE(@avail, is_available),
         full_name = COALESCE(@fullName, full_name),
         phone = COALESCE(@phone, phone),
         vehicle_type = COALESCE(@vehicleType, vehicle_type),
         vehicle_number = COALESCE(@vehicleNumber, vehicle_number),
         license_number = COALESCE(@licenseNumber, license_number)
     WHERE id = @id AND pmid = @pmid`,
    {
      id,
      pmid,
      role: role ?? null,
      active: is_active !== undefined ? Boolean(is_active) : null,
      avail: is_available !== undefined ? Boolean(is_available) : null,
      fullName: fullName ?? null,
      phone: phone ?? null,
      vehicleType: vehicleType ?? null,
      vehicleNumber: vehicleNumber ?? null,
      licenseNumber: licenseNumber ?? null,
    }
  );
  if (!updated) return res.status(404).json({ status: 'false', message: 'User not found' });
  res.json({ status: 'true', message: 'User updated' });
}));

router.delete('/api/partner/users/:id', ...guard, asyncHandler(async (req, res) => {
  const pmid = Number(req.user.pmid);
  const id = parseInt(req.params.id, 10);
  await db.exec(DB, 'DELETE FROM commerza_portal_users WHERE id = @id AND pmid = @pmid', { id, pmid });
  res.json({ status: 'true', message: 'User removed' });
}));

// ---- Partner-to-Partner Referrals & Wallet -------------------------------------------------
router.get('/api/partner/referrals', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const plid = Number(req.user.plid);

  let me = await db.queryOne(DB, 'SELECT plid, referalcode FROM portal_login WHERE pmid = @pmid LIMIT 1', { pmid });
  let referralCode = me?.referalcode || '';
  if (!referralCode) {
    referralCode = `CMZ-P${pmid}`;
    await db.exec(DB, 'UPDATE portal_login SET referalcode = @rc WHERE pmid = @pmid', { rc: referralCode, pmid });
  }

  const referrals = await db.query(
    DB,
    `SELECT pm.pmid, pm.companyname, pm.comemailid, pm.mobileno, pm.isverified, pm.doc AS joined_at,
            COALESCE(NULLIF(pl.referalcode, ''), 'CMZ-P' || pm.pmid::text) AS username,
            CASE WHEN pl.communityside = 2 THEN 'Right' ELSE 'Left' END AS side,
            sub.package_name, sub.amount_paid, sub.status AS subscription_status
     FROM portal_login pl
     JOIN portal_master pm ON pm.pmid = pl.pmid
     LEFT JOIN LATERAL (
       SELECT package_name, amount_paid, status
       FROM commerza_partner_subscriptions s
       WHERE s.pmid = pm.pmid
       ORDER BY s.id DESC LIMIT 1
     ) sub ON TRUE
     WHERE pl.intro_plid = @plid OR (pl.refral_id IS NOT NULL AND upper(pl.refral_id) = upper(@rc))
     ORDER BY pm.pmid DESC`,
    { plid: me?.plid || plid, rc: referralCode }
  );

  const rootPlid = Number(me?.plid || plid);
  const treeNodes = await db.query(
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
            pm.companyname AS shop_name, pm.isverified,
            COALESCE(sub.package_name, 'Free') AS package_name,
            COALESCE(sub.amount_paid, 0)::numeric(12,2) AS package_amount
     FROM btree bt
     JOIN portal_master pm ON pm.pmid = bt.pmid
     LEFT JOIN LATERAL (
       SELECT package_name, amount_paid
       FROM commerza_partner_subscriptions s
       WHERE s.pmid = pm.pmid AND s.status = 'approved'
       ORDER BY s.id DESC LIMIT 1
     ) sub ON TRUE
     ORDER BY bt.level ASC, bt.side ASC, bt.plid ASC`,
    { rootPlid }
  );

  const descendants = treeNodes.filter((n) => n.level > 0);
  const leftNodes = descendants.filter((n) => String(n.root_leg).toLowerCase() === 'left');
  const rightNodes = descendants.filter((n) => String(n.root_leg).toLowerCase() === 'right');
  const leftBv = leftNodes.reduce((s, n) => s + Number(n.package_amount || 0), 0);
  const rightBv = rightNodes.reduce((s, n) => s + Number(n.package_amount || 0), 0);

  const totalReferralEarnings = await db.scalar(
    DB,
    "SELECT COALESCE(SUM(amount), 0)::numeric(12,2) FROM commerza_partner_wallet_tx WHERE pmid = @pmid AND tx_type = 'credit' AND category = 'referral_bonus'",
    { pmid }
  );

  const verifiedReferred = referrals.filter((r) => r.isverified === 1).length;
  const totalReferralBusiness = referrals
    .filter((r) => r.subscription_status === 'approved')
    .reduce((sum, r) => sum + Number(r.amount_paid || 0), 0);

  res.json({
    status: 'true',
    referralCode,
    stats: {
      totalReferred: referrals.length,
      verifiedReferred,
      totalReferralBusiness,
      totalReferralEarnings: Number(totalReferralEarnings || 0),
      leftCount: leftNodes.length,
      rightCount: rightNodes.length,
      leftBv,
      rightBv,
    },
    referrals,
    binaryTree: {
      rootPlid,
      nodes: treeNodes,
    },
  });
}));

router.get('/api/partner/wallet', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);

  const [balances, transactions, withdrawals, topupRequests, loginRow] = await Promise.all([
    getWalletBalances(pmid),
    db.query(DB, 'SELECT * FROM commerza_partner_wallet_tx WHERE pmid = @pmid ORDER BY id DESC LIMIT 50', { pmid }),
    db.query(DB, 'SELECT * FROM commerza_partner_withdrawals WHERE pmid = @pmid ORDER BY id DESC LIMIT 50', { pmid }),
    db.query(DB, 'SELECT * FROM commerza_partner_topup_requests WHERE pmid = @pmid ORDER BY id DESC LIMIT 50', { pmid }),
    db.queryOne(DB, 'SELECT referalcode FROM portal_login WHERE pmid = @pmid ORDER BY plid ASC LIMIT 1', { pmid }),
  ]);

  res.json({
    status: 'true',
    uniqueId: loginRow?.referalcode || `CMZ-P${pmid}`,
    wallet: balances,
    transactions,
    withdrawals,
    topupRequests,
  });
}));

router.get('/api/partner/wallet/lookup', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const q = String(req.query.uniqueId || '').trim();
  if (!q) return res.status(400).json({ status: 'false', message: 'uniqueId is required' });

  const row = await db.queryOne(
    DB,
    `SELECT pm.pmid, pm.companyname, COALESCE(NULLIF(pl.referalcode, ''), 'CMZ-P' || pm.pmid::text) AS unique_id,
            COALESCE(pm.active, true) AS active
     FROM portal_master pm
     LEFT JOIN portal_login pl ON pl.pmid = pm.pmid
     WHERE upper(COALESCE(pl.referalcode, '')) = upper(@q)
        OR ('CMZ-P' || pm.pmid::text) = upper(@q)
        OR pm.pmid::text = @q
     ORDER BY pl.plid ASC LIMIT 1`,
    { q }
  );
  if (!row) return res.status(404).json({ status: 'false', message: `No partner/shop found with Unique ID '${q}'` });
  res.json({
    status: 'true',
    recipient: {
      pmid: Number(row.pmid),
      uniqueId: row.unique_id,
      shopName: row.companyname,
      active: Boolean(row.active),
    },
  });
}));

router.post('/api/partner/wallet/transfer', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const senderPmid = Number(req.user.pmid);
  const { recipientUniqueId, amount, note = '' } = req.body || {};
  const uid = String(recipientUniqueId || '').trim();
  const amt = Number(amount);

  if (!uid || !amt || amt <= 0) {
    return res.status(400).json({ status: 'false', message: 'Valid recipientUniqueId and positive amount are required' });
  }

  const recipient = await db.queryOne(
    DB,
    `SELECT pm.pmid, pm.companyname, COALESCE(NULLIF(pl.referalcode, ''), 'CMZ-P' || pm.pmid::text) AS unique_id,
            COALESCE(pm.active, true) AS active
     FROM portal_master pm
     LEFT JOIN portal_login pl ON pl.pmid = pm.pmid
     WHERE upper(COALESCE(pl.referalcode, '')) = upper(@uid)
        OR ('CMZ-P' || pm.pmid::text) = upper(@uid)
        OR pm.pmid::text = @uid
     ORDER BY pl.plid ASC LIMIT 1`,
    { uid }
  );

  if (!recipient) {
    return res.status(404).json({ status: 'false', message: `Recipient partner '${uid}' not found` });
  }
  if (Number(recipient.pmid) === senderPmid) {
    return res.status(400).json({ status: 'false', message: 'Cannot transfer wallet balance to your own account' });
  }
  if (!recipient.active) {
    return res.status(400).json({ status: 'false', message: 'Recipient partner account is suspended' });
  }

  const sender = await db.queryOne(
    DB,
    `SELECT pm.companyname, COALESCE(NULLIF(pl.referalcode, ''), 'CMZ-P' || pm.pmid::text) AS unique_id
     FROM portal_master pm
     LEFT JOIN portal_login pl ON pl.pmid = pm.pmid
     WHERE pm.pmid = @pmid ORDER BY pl.plid ASC LIMIT 1`,
    { pmid: senderPmid }
  );

  const balances = await getWalletBalances(senderPmid);
  if (amt > balances.topupBalance) {
    return res.status(400).json({
      status: 'false',
      message: `Insufficient Top-Up Wallet balance (available ₹${balances.topupBalance.toFixed(2)})`,
    });
  }

  const noteText = String(note || '').trim();
  const senderUid = sender?.unique_id || `CMZ-P${senderPmid}`;
  const recipientUid = recipient.unique_id;

  await db.tx(DB, async (t) => {
    await t.query(
      `INSERT INTO commerza_partner_wallet_tx (pmid, wallet_type, tx_type, category, amount, description, status)
       VALUES (@pmid, 'topup', 'debit', 'transfer_out', @amt, @desc, 'completed')`,
      {
        pmid: senderPmid,
        amt,
        desc: `Transferred to ${recipientUid} (${recipient.companyname})${noteText ? ` — ${noteText}` : ''}`,
      }
    );
    await t.query(
      `INSERT INTO commerza_partner_wallet_tx (pmid, wallet_type, tx_type, category, amount, description, status)
       VALUES (@pmid, 'topup', 'credit', 'transfer_in', @amt, @desc, 'completed')`,
      {
        pmid: Number(recipient.pmid),
        amt,
        desc: `Received from ${senderUid} (${sender?.companyname || 'Partner'})${noteText ? ` — ${noteText}` : ''}`,
      }
    );
  });

  const updated = await getWalletBalances(senderPmid);
  res.status(201).json({
    status: 'true',
    message: `Transferred ₹${amt.toFixed(2)} to ${recipientUid} (${recipient.companyname})`,
    topupBalance: updated.topupBalance,
  });
}));

router.post('/api/partner/wallet/topup', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const { amount, paymentMethod = 'upi', transactionRef = '', paymentProofUrl = '', notes = '' } = req.body || {};
  const amt = Number(amount);

  if (!amt || amt <= 0 || !String(transactionRef).trim()) {
    return res.status(400).json({ status: 'false', message: 'Valid amount and transactionRef (UTR) are required' });
  }

  const row = await db.queryOne(
    DB,
    `INSERT INTO commerza_partner_topup_requests (pmid, amount, payment_method, transaction_ref, payment_proof_url, notes, status)
     VALUES (@pmid, @amt, @method, @ref, @proof, @notes, 'pending') RETURNING *`,
    {
      pmid,
      amt,
      method: String(paymentMethod),
      ref: String(transactionRef).trim(),
      proof: String(paymentProofUrl || ''),
      notes: String(notes || ''),
    }
  );

  res.status(201).json({
    status: 'true',
    message: 'Wallet top-up submitted. Admin will verify the amount and credit your Top-Up Wallet.',
    topup: row,
  });
}));

router.post('/api/partner/withdrawals', ...guard, asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const pmid = Number(req.user.pmid);
  const { amount, payoutMethod = 'upi', accountDetails = '' } = req.body || {};
  const amt = Number(amount);

  if (!amt || amt <= 0 || !String(accountDetails).trim()) {
    return res.status(400).json({ status: 'false', message: 'Valid amount and account/UPI details are required' });
  }

  const balances = await getWalletBalances(pmid);
  if (amt > balances.walletBalance) {
    return res.status(400).json({ status: 'false', message: `Insufficient Income Wallet balance (available ₹${balances.walletBalance.toFixed(2)})` });
  }

  const row = await db.queryOne(
    DB,
    `INSERT INTO commerza_partner_withdrawals (pmid, amount, payout_method, account_details, status)
     VALUES (@pmid, @amt, @method, @details, 'pending') RETURNING *`,
    { pmid, amt, method: String(payoutMethod), details: String(accountDetails).trim() }
  );

  res.status(201).json({ status: 'true', message: 'Withdrawal request submitted', withdrawal: row });
}));

module.exports = router;
