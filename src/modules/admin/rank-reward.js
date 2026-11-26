'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Rank_Reward.cs (class Rank_RewardController => /admin/Rank_Reward/...)
// Database: affiliate (Db_Affiliate). Procs: USP_GETEXCELPERMISIONSTATUS, USP_GETWALLETTYPE, USP_GETALLRANKREWARD, USP_SUBMITDIRECT_RANKREWARD,
// USP_GETSINGLEREWARDBY_RANKID, USP_UPDATERANKREWARDBYID, USP_DELETEREWARDRANK_BYID.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const { DB, nStr, reqInt, reqDec, outInt, inlinePerms } = require('./_shared/batch12-common');
const { omitNull } = require('./_shared/batch13-03-common');

const router = express.Router();
const C = 'Rank_Reward';

/** class WalletTypeForDirectRankReward */
const WALLET_TYPE_PROPS = ['TWTID', 'WALLETTYPE'];
/** class GetAllRankReward */
const RANK_REWARD_PROPS = ['RRUID', 'RANKID', 'ROWNUMBER', 'REWARDNAME', 'RANKNAME', 'NOOFDIRECT', 'LEFTDIRECT', 'RIGHTDIRECT', 'TOTALBUSINESS',
  'LEFTBUSINESS', 'RIGHTBUSINESS', 'REWARDAMOUNT', 'ADMINCHARGE', 'TDS', 'WALLETTYPE', 'WALLETNAME', 'WITHINDAYS', 'DATE', 'ACTIVE', 'STATUS'];

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields.
let url = '';
let url1 = '';

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string datetype, string orderbydate, string SearchField,
//   string SearchValue, string VarifiedPanStatus, string fromDate, string toDate, string ddlStatus, string ddlchange, int? ddltype, int? page, string btnexel,
//   string downlinesearch, int? Side, string activationdate)   (all parameters are bound but unused by the legacy action)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/rank-reward" -> Rank_Reward/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/rank-reward{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  const p = await inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  const WalletTypeForDirectRankReward = mapRows(await db.proc(DB, 'USP_GETWALLETTYPE', {}), WALLET_TYPE_PROPS);
  const GetAllRankReward = mapRows(await db.proc(DB, 'USP_GETALLRANKREWARD', {}), RANK_REWARD_PROPS);
  ViewBag.AllReward = GetAllRankReward;
  return res.json({ view: '~/Views/AdminPanel/Rank_Reward/Index.cshtml', Model: WalletTypeForDirectRankReward, ...ViewBag });
}));

/** shared parameter binding of AddDirectRankReward / UpdateDirectRankReward (non-nullable int/decimal => binding error 500 when missing) */
function rewardParams(req) {
  return {
    RANKID: reqInt(req.p.Rankid, 'Rankid'),
    REWARDNAME: nStr(req.p.Rewadrname),
    NOOFDIRECT: reqInt(req.p.NoOfDirect, 'NoOfDirect'),
    LEFTDIRECT: reqInt(req.p.LeftDirect, 'LeftDirect'),
    RIGHTDIRECT: reqInt(req.p.RightDirct, 'RightDirct'),
    TOTALBUSINESS: reqDec(req.p.TotalBusines, 'TotalBusines'),
    LEFTBUSSINECT: reqDec(req.p.LeftBusiness, 'LeftBusiness'),
    RIGHTBUSSINESS: reqDec(req.p.RightBussiness, 'RightBussiness'),
    REWARDAMOUNT: reqDec(req.p.RewardAmt, 'RewardAmt'),
    ADMINCHARGEPER: reqDec(req.p.AdminCharge, 'AdminCharge'),
    TDSCHARGEPER: reqDec(req.p.TDSCharge, 'TDSCharge'),
    WALLETTYPE: reqInt(req.p.WalletType, 'WalletType'),
    WALLETNAME: nStr(req.p.WalletName),
    WITHINDAYS: reqInt(req.p.WithinDays, 'WithinDays'),
    ACTIVE: reqInt(req.p.Active, 'Active'),
  };
}

// ---------------------------------------------------------------- JsonResult AddDirectRankReward(int Rankid, string Rewadrname, int NoOfDirect, int LeftDirect,
//   int RightDirct, decimal TotalBusines, decimal LeftBusiness, decimal RightBussiness, decimal RewardAmt, decimal AdminCharge, decimal TDSCharge,
//   int WalletType, string WalletName, int WithinDays, int Active)
// auth (legacy had no session check; admin write operation => adminAuth)
router.all(`/admin/${C}/AddDirectRankReward{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const prm = rewardParams(req);
  // USP_SUBMITDIRECT_RANKREWARD @RANKID,@REWARDNAME,...,@ACTIVE,@INTRESULT OUT
  const row = await db.procOne(DB, 'USP_SUBMITDIRECT_RANKREWARD', omitNull(prm)); // (C# null strings are not sent => proc default)
  const Result = outInt(row, 'INTRESULT'); // Convert.ToInt32(spOutput.Value.ToString())
  return res.json(Result);
}));

// ---------------------------------------------------------------- JsonResult GetRewardByRankId(int RruId)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetRewardByRankId{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const RruId = reqInt(req.p.RruId, 'RruId');
  const GetAllRankReward = mapRows(await db.proc(DB, 'USP_GETSINGLEREWARDBY_RANKID', { RRUID: RruId }), RANK_REWARD_PROPS);
  return res.json(GetAllRankReward);
}));

// ---------------------------------------------------------------- JsonResult UpdateDirectRankReward(int Rruid, int Rankid, ... same as AddDirectRankReward)
// auth (legacy had no session check; admin write operation => adminAuth)
router.all(`/admin/${C}/UpdateDirectRankReward{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Rruid = reqInt(req.p.Rruid, 'Rruid');
  const prm = rewardParams(req);
  // USP_UPDATERANKREWARDBYID @RRUID,@RANKID,...,@ACTIVE,@INTRESULT OUT
  const row = await db.procOne(DB, 'USP_UPDATERANKREWARDBYID', omitNull({ RRUID: Rruid, ...prm }));
  const Result = outInt(row, 'INTRESULT');
  return res.json(Result);
}));

// ---------------------------------------------------------------- JsonResult DeleteRewardRankById(int Rruid)
// auth (legacy had no session check; admin write operation => adminAuth)
router.all(`/admin/${C}/DeleteRewardRankById{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Rruid = reqInt(req.p.Rruid, 'Rruid');
  await db.procOne(DB, 'USP_DELETEREWARDRANK_BYID', { RRUBID: Rruid }); // @RRUBID,@INTRESULT out (result ignored)
  return res.json('');
}));

module.exports = router;
