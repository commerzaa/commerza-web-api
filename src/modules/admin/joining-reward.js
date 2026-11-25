'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Joining_Reward.cs (class Joining_RewardController => /admin/Joining_Reward/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch08-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Joining_Reward';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (as legacy).
let url = '';
let url1 = '';
// (private string regno = "" - declared, never used)

/** class JoiningReward */
const JOINING_REWARD_PROPS = ['RTSID', 'ROWNUMBER', 'REWARDNAME', 'NOOFDIRECT', 'LEFTDIRECT', 'RIGHTDIRECT', 'NOOFDOWNLINE', 'LEFTDOWNLINE',
  'RIGHTDOWNLINE', 'WITHINDAYS', 'ACHIVEREWARD', 'DATE', 'ACTIVE', 'STATUS'];
/** class WalletForJoinReward (declared in the C# file, not used by any action) */
// eslint-disable-next-line no-unused-vars
const WALLET_FOR_JOIN_REWARD_PROPS = ['TWTID', 'WALLETTYPE'];

/** Convert.ToInt16(x.Value.ToString() == "" ? "0" : x.Value.ToString()) */
const toInt16Out = (row, name) => { const s = B.outStr(row, name); return B.cvtInt(s === '' ? '0' : s); };

// ---------------------------------------------------------------- Index(int? dynamicpagging, string datetype, string orderbydate, string SearchField, string SearchValue, string VarifiedPanStatus, string fromDate, string toDate, string ddlStatus, string ddlchange, int? ddltype, int? page, string btnexel, string downlinesearch, int? Side, string activationdate)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/joining-reward" -> Joining_Reward/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/joining-reward'], adminAuth, asyncHandler(async (req, res) => {
  // (all action parameters are bound but unused by the legacy body)
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  const perm = await db.procOne(DB, 'USP_GETEXCELPERMISIONSTATUS', { EMPID: Employeeid, HERF: url });
  ViewBag.isactive = toInt16Out(perm, 'EXCELSTATUS');
  ViewBag.isedit = toInt16Out(perm, 'ISEDIT');
  const JoiningReward = mapRows(await db.proc(DB, 'USP_GETALLJOININGREWARD', {}), JOINING_REWARD_PROPS);
  return res.json({ view: '~/Views/AdminPanel/Joining_Reward/Index.cshtml', Model: JoiningReward, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult AddJoiningReward(string Rewadrname, int NoOfDirect, int LeftDirect, int RightDirct, int TotalDownLine, int LeftDownline, int RightDownLine, int WithinDays, string AchverReward, int Active)
// public (legacy had no session check - see security notes)
router.all(`/admin/${C}/AddJoiningReward{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  const row = await db.procOne(DB, 'USP_SUBMITDIRECT_JOININGREWARD', {
    RTSID: 0,
    REWARDNAME: B.nStr(p.Rewadrname),
    NOOFDIRECT: B.reqInt(p.NoOfDirect, 'NoOfDirect'),
    LEFTDIRECT: B.reqInt(p.LeftDirect, 'LeftDirect'),
    RIGHTDIRECT: B.reqInt(p.RightDirct, 'RightDirct'),
    TOTALDOWNLINE: B.reqInt(p.TotalDownLine, 'TotalDownLine'),
    LEFTDOWNLINE: B.reqInt(p.LeftDownline, 'LeftDownline'),
    RIGHTDOWNLINE: B.reqInt(p.RightDownLine, 'RightDownLine'),
    WITHINDAYS: B.reqInt(p.WithinDays, 'WithinDays'),
    ACHIVREWARD: B.nStr(p.AchverReward),
    ACTIVE: B.reqInt(p.Active, 'Active'),
    MODE: 1,
  });
  const Result = B.outInt(row, 'INTRESULT');
  return res.json(Result);
}));

// ---------------------------------------------------------------- JsonResult GetJoiningRewardByRankId(int Rtsid)
// public (legacy had no session check)
router.all(`/admin/${C}/GetJoiningRewardByRankId{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Rtsid = B.reqInt(req.p.Rtsid, 'Rtsid');
  const JoiningReward = mapRows(await db.proc(DB, 'USP_GETSINGLEJOININGREWARDBYID', { RTSID: Rtsid }), JOINING_REWARD_PROPS);
  return res.json(JoiningReward);
}));

// ---------------------------------------------------------------- JsonResult UpdateDirectJoiningReward(int Rtsids, string Rewadrname, int NoOfDirect, int LeftDirect, int RightDirct, int NoofDownLine, int LeftDownline, int RightDownline, string AchivReward, int WithinDays, int Active)
// public (legacy had no session check - see security notes)
router.all(`/admin/${C}/UpdateDirectJoiningReward{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  const row = await db.procOne(DB, 'USP_UPDATEJOININGREWARDBYID', {
    RTSID: B.reqInt(p.Rtsids, 'Rtsids'),
    REWARDNAME: B.nStr(p.Rewadrname),
    NOOFDIRECT: B.reqInt(p.NoOfDirect, 'NoOfDirect'),
    LEFTDIRECT: B.reqInt(p.LeftDirect, 'LeftDirect'),
    RIGHTDIRECT: B.reqInt(p.RightDirct, 'RightDirct'),
    NOOFDOWNLINE: B.reqInt(p.NoofDownLine, 'NoofDownLine'),
    LEFTDOWNLINE: B.reqInt(p.LeftDownline, 'LeftDownline'),
    RIGHTDOWNLINE: B.reqInt(p.RightDownline, 'RightDownline'),
    ACHIVEREWARD: B.nStr(p.AchivReward),
    WITHINDAYS: B.reqInt(p.WithinDays, 'WithinDays'),
    ACTIVE: B.reqInt(p.Active, 'Active'),
  });
  const Result = B.outInt(row, 'INTRESULT');
  return res.json(Result);
}));

// ---------------------------------------------------------------- JsonResult DeleteJoiningRewardRankById(int Rtsids)
// public (legacy had no session check - see security notes)
router.all(`/admin/${C}/DeleteJoiningRewardRankById{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Rtsids = B.reqInt(req.p.Rtsids, 'Rtsids');
  const row = await db.procOne(DB, 'USP_SUBMITDIRECT_JOININGREWARD', {
    RTSID: Rtsids, REWARDNAME: '', NOOFDIRECT: '0', LEFTDIRECT: '0', RIGHTDIRECT: '0', TOTALDOWNLINE: '0', LEFTDOWNLINE: '0',
    RIGHTDOWNLINE: '0', WITHINDAYS: '0', ACHIVREWARD: '', ACTIVE: '0', MODE: 2,
  });
  B.outInt(row, 'INTRESULT'); // int Result = Convert.ToInt32(spOutput.Value.ToString()) (unused, but throws on DBNull like legacy)
  return res.json('');
}));

module.exports = router;
