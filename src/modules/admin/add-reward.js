'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Add_Reward.cs (class Add_RewardController)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nint, nstr, reqInt, outStr, col, view, mapRows } = require('./_shared/batch02-common');

const router = express.Router();
const C = 'Add_Reward';

/** class AddReward */
const ADDREWARD_PROPS = ['EWRID', 'FROMBUSINESS', 'TOBUSINESS', 'REWARDSAMOUNT', 'ADMINCHARGE', 'PAYBLEAMOUNT', 'REWARDNAME', 'FROMDATE', 'TODATE', 'Days', 'Status'];

/** non-nullable decimal action parameter */
function reqDec(v, name) {
  const n = v === undefined || v === null || v === '' ? NaN : Number(v);
  if (!Number.isFinite(n)) {
    const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Decimal'`);
    e.status = 500;
    throw e;
  }
  return n;
}

// ---------------------------------------------------------------- Index(int? Ewrid)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Add-Reward" -> Add_Reward/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Add-Reward'], adminAuth, asyncHandler(async (req, res) => {
  const Ewrid = nint(req.p.Ewrid);
  const ViewBag = {};
  if (Ewrid !== null) {
    const RewardList = mapRows(await db.proc(DB, 'USP_GETALLREWARDBYID', { EWRID: Ewrid }), ADDREWARD_PROPS);
    if (!RewardList.length) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.');
    ViewBag.FromDate = RewardList[0].FROMDATE;
    ViewBag.Todate = RewardList[0].TODATE;
    ViewBag.RewardName = RewardList[0].REWARDNAME;
    ViewBag.RewardAmount = RewardList[0].REWARDSAMOUNT;
    ViewBag.Tobuiness = RewardList[0].TOBUSINESS;
    ViewBag.Frombusiness = RewardList[0].FROMBUSINESS;
    ViewBag.Admincharge = RewardList[0].ADMINCHARGE;
    ViewBag.PayableAmt = RewardList[0].PAYBLEAMOUNT;
    ViewBag.Days = RewardList[0].Days;
    ViewBag.Status = RewardList[0].Status;
    ViewBag.EWrid = Ewrid;
  }
  return view(res, '~/Views/AdminPanel/Add_Reward/Index.cshtml', undefined, ViewBag);
}));

// ---------------------------------------------------------------- JsonResult AddReward(string Fromdate, string Todate, decimal Frombusiness, decimal Tobusiness, decimal Admin, decimal RewardAmount, decimal PayableAmt, string RewardName, int Days, int IsActive)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/AddReward{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Frombusiness = reqDec(req.p.Frombusiness, 'Frombusiness');
  const Tobusiness = reqDec(req.p.Tobusiness, 'Tobusiness');
  const Admin = reqDec(req.p.Admin, 'Admin');
  const RewardAmount = reqDec(req.p.RewardAmount, 'RewardAmount');
  const PayableAmt = reqDec(req.p.PayableAmt, 'PayableAmt');
  const Days = reqInt(req.p.Days, 'Days');
  const IsActive = reqInt(req.p.IsActive, 'IsActive');
  // DBO_USP_ADDREWARD (sic: the procedure is really named "DBO_USP_ADDREWARD")
  const row = await db.procOne(DB, 'DBO_USP_ADDREWARD', {
    FROMDATE: nstr(req.p.Fromdate), TODATE: nstr(req.p.Todate), FROMBUSINESS: Frombusiness, TOBUSINESS: Tobusiness, ADMIN: Admin,
    REWARDSAMOUNT: RewardAmount, PAYBLEAMOUNT: PayableAmt, REWARDNAME: nstr(req.p.RewardName), STATUS: IsActive, DAYS: Days,
  });
  return res.json(outStr(col(row, 'result')));
}));

// ---------------------------------------------------------------- JsonResult UpdateReward(string Fromdate, string Todate, decimal Frombusiness, decimal Tobusiness, decimal Admin, decimal RewardAmount, decimal PayableAmt, string RewardName, int EWrid, int Days, int IsActive)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/UpdateReward{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Frombusiness = reqDec(req.p.Frombusiness, 'Frombusiness');
  const Tobusiness = reqDec(req.p.Tobusiness, 'Tobusiness');
  const Admin = reqDec(req.p.Admin, 'Admin');
  const RewardAmount = reqDec(req.p.RewardAmount, 'RewardAmount');
  const PayableAmt = reqDec(req.p.PayableAmt, 'PayableAmt');
  const EWrid = reqInt(req.p.EWrid, 'EWrid');
  const Days = reqInt(req.p.Days, 'Days');
  const IsActive = reqInt(req.p.IsActive, 'IsActive');
  const row = await db.procOne(DB, 'USP_UPDATEADDREWARD', {
    FROMDATE: nstr(req.p.Fromdate), TODATE: nstr(req.p.Todate), FROMBUSINESS: Frombusiness, TOBUSINESS: Tobusiness, ADMIN: Admin,
    REWARDSAMOUNT: RewardAmount, PAYBLEAMOUNT: PayableAmt, REWARDNAME: nstr(req.p.RewardName), STATUS: IsActive, EWRID: EWrid, DAYS: Days,
  });
  return res.json(outStr(col(row, 'result')));
}));

module.exports = router;
