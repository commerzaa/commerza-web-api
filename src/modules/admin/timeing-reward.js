'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Timeing_Reward.cs (class Timeing_RewardController => /admin/Timeing_Reward/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const { DB, nStr, reqInt, reqDec, outInt, inlinePerms } = require('./_shared/batch11-common');
const { supplied } = require('./_shared/batch13-09-common');

const router = express.Router();
const C = 'Timeing_Reward';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (kept as module state).
let url = '';
let url1 = '';

/** class WalletForTimeingReward */
const WALLET_PROPS = ['TWTID', 'WALLETTYPE'];
/** class GetTimeingReward */
const REWARD_PROPS = ['RTID', 'RANKID', 'ROWNUMBER', 'REWARDNAME', 'NOOFDIRECT', 'LEFTDIRECT', 'RIGHTDIRECT', 'TOTALBUSINESS', 'LEFTBUSINESS',
  'RIGHTBUSINESS', 'REWARDAMOUNT', 'ADMINCHARGE', 'TDS', 'WALLETTYPE', 'WALLETNAME', 'WITHINTIME', 'DATE', 'ACTIVE', 'STATUS'];

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string datetype, string orderbydate, string SearchField, ... string activationdate)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/timeing-reward" -> Timeing_Reward/Index
// (the 16 filter parameters are bound by the legacy action but never used)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/timeing-reward'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out => Convert.ToInt16(v == "" ? "0" : v)
  const p = await inlinePerms(Employeeid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  const WalletForTimeingReward = mapRows(await db.proc(DB, 'USP_GETWALLETTYPE', {}), WALLET_PROPS);
  const GetTimeingReward = mapRows(await db.proc(DB, 'USP_GETALLTIMEINGREWARD', {}), REWARD_PROPS);
  ViewBag.AllReward = GetTimeingReward;
  return res.json({ view: '~/Views/AdminPanel/Timeing_Reward/Index.cshtml', Model: WalletForTimeingReward, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult AddDirectTimeingReward(int Rankid, string Rewadrname, int NoOfDirect, ... int WithinDays, int Active)
// auth (no session check in legacy; admin reward master write => protected)
router.all(`/admin/${C}/AddDirectTimeingReward{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const P = req.p;
  const row = await db.procOne(DB, 'USP_SUBMITDIRECT_TIMEINGREWARD', supplied({
    RANKID: reqInt(P.Rankid, 'Rankid'),
    REWARDNAME: nStr(P.Rewadrname),
    NOOFDIRECT: reqInt(P.NoOfDirect, 'NoOfDirect'),
    LEFTDIRECT: reqInt(P.LeftDirect, 'LeftDirect'),
    RIGHTDIRECT: reqInt(P.RightDirct, 'RightDirct'),
    TOTALBUSINESS: reqDec(P.TotalBusines, 'TotalBusines'),
    LEFTBUSSINECT: reqDec(P.LeftBusiness, 'LeftBusiness'),
    RIGHTBUSSINESS: reqDec(P.RightBussiness, 'RightBussiness'),
    REWARDAMOUNT: reqDec(P.RewardAmt, 'RewardAmt'),
    ADMINCHARGEPER: reqDec(P.AdminCharge, 'AdminCharge'),
    TDSCHARGEPER: reqDec(P.TDSCharge, 'TDSCharge'),
    WALLETTYPE: reqInt(P.WalletType, 'WalletType'),
    WALLETNAME: nStr(P.WalletName),
    WITHINTIME: reqInt(P.WithinDays, 'WithinDays'),
    ACTIVE: reqInt(P.Active, 'Active'),
  })); // supplied(): a null string SqlParameter was 'not supplied' => proc default
  const Result = outInt(row, 'intresult'); // Convert.ToInt32(spOutput.Value.ToString())
  return res.json(Result);
}));

// ---------------------------------------------------------------- JsonResult GetTimeingRewardByRankId(int Rtid)
// auth (no session check in legacy; admin reward master data => protected)
router.all(`/admin/${C}/GetTimeingRewardByRankId{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Rtid = reqInt(req.p.Rtid, 'Rtid');
  const GetTimeingReward = mapRows(await db.proc(DB, 'USP_GETSINGLETIMEINGREWARDBYID', { RTID: Rtid }), REWARD_PROPS);
  return res.json(GetTimeingReward);
}));

// ---------------------------------------------------------------- JsonResult UpdateDirectTimingReward(int Rtid, int Rankid, ... decimal WithinTime, int Active)
// auth (no session check in legacy; admin reward master write => protected)
router.all(`/admin/${C}/UpdateDirectTimingReward{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const P = req.p;
  const row = await db.procOne(DB, 'USP_UPDATETIMINGREWARDBYID', supplied({
    RTID: reqInt(P.Rtid, 'Rtid'),
    RANKID: reqInt(P.Rankid, 'Rankid'),
    REWARDNAME: nStr(P.Rewadrname),
    NOOFDIRECT: reqInt(P.NoOfDirect, 'NoOfDirect'),
    LEFTDIRECT: reqInt(P.LeftDirect, 'LeftDirect'),
    RIGHTDIRECT: reqInt(P.RightDirct, 'RightDirct'),
    TOTALBUSINESS: reqDec(P.TotalBusines, 'TotalBusines'),
    LEFTBUSSINECT: reqDec(P.LeftBusiness, 'LeftBusiness'),
    RIGHTBUSSINESS: reqDec(P.RightBussiness, 'RightBussiness'),
    REWARDAMOUNT: reqDec(P.RewardAmt, 'RewardAmt'),
    ADMINCHARGEPER: reqDec(P.AdminCharge, 'AdminCharge'),
    TDSCHARGEPER: reqDec(P.TDSCharge, 'TDSCharge'),
    WALLETTYPE: reqInt(P.WalletType, 'WalletType'),
    WALLETNAME: nStr(P.WalletName),
    WITHINTIME: reqDec(P.WithinTime, 'WithinTime'),
    ACTIVE: reqInt(P.Active, 'Active'),
  })); // supplied(): a null string SqlParameter was 'not supplied' => proc default
  const Result = outInt(row, 'intresult');
  return res.json(Result);
}));

// ---------------------------------------------------------------- JsonResult DeleteTimingRewardById(int Rtid)
// auth (no session check in legacy; admin reward master write => protected)
router.all(`/admin/${C}/DeleteTimingRewardById{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Rtid = reqInt(req.p.Rtid, 'Rtid');
  // legacy concatenated Rtid into the SQL (int, so no injection); parameterised here
  await db.exec(DB, 'UPDATE tbl_rewardtiming SET active=0 , status=0 WHERE rtid=@Rtid', { Rtid });
  return res.json('');
}));

module.exports = router;
