'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Team_Building_Setting.cs (class Team_Building_SettingController => /admin/Team_Building_Setting/...)
// Database: affiliate (Db_Affiliate). Procs: USP_GETTEAMBUILDINGSETTINGLIST, USP_TEAM_BUILDING_SETTING.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const { DB, nStr, reqInt, reqDec, col } = require('./_shared/batch11-common');
const { viewRes } = require('./_shared/batch13-08-common');

const router = express.Router();
const C = 'Team_Building_Setting';

/** class Team_Building_Setting */
const TBS_PROPS = ['DRSID', 'LEVEL', 'FROMBV', 'TOBV', 'DIRECTPER', 'NOOFDIRECT', 'SEFTBV', 'DIRECTBV', 'WITHINDAYS', 'CLOSINGTYPE', 'WALLETTYPE',
  'ACTIVE', 'STATUS', 'CLOSINGTYPENAME', 'WALLETTYPENAME'];

// PORT-NOTE: `private static string url, url1` - static fields (set, never read).
let url = '';
let url1 = '';

// ---------------------------------------------------------------- ActionResult Index(string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/team-building-setting" -> Team_Building_Setting/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/team-building-setting'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  void url; void nStr(req.p.btnexel);
  const PackageBinarySetting = mapRows(await db.proc(DB, 'USP_GETTEAMBUILDINGSETTINGLIST', {}), TBS_PROPS);
  return viewRes(res, '~/Views/AdminPanel/Team_Building_Setting/Index.cshtml', PackageBinarySetting);
}));

// ---------------------------------------------------------------- JsonResult SubmitTeamBuildingSetting(int DRSID, int level, decimal FromBv, decimal ToBv, decimal DirectPer, int noofdirect, decimal directbv, int withinday, int closingtype, string closingtypename, int creditwallet, string creditwalletname, int status)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/SubmitTeamBuildingSetting{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  const DRSID = reqInt(p.DRSID, 'DRSID');
  const level = reqInt(p.level, 'level');
  const FromBv = reqDec(p.FromBv, 'FromBv');
  const ToBv = reqDec(p.ToBv, 'ToBv');
  const DirectPer = reqDec(p.DirectPer, 'DirectPer');
  const noofdirect = reqInt(p.noofdirect, 'noofdirect');
  const directbv = reqDec(p.directbv, 'directbv');
  const withinday = reqInt(p.withinday, 'withinday');
  const closingtype = reqInt(p.closingtype, 'closingtype');
  const closingtypename = nStr(p.closingtypename);
  const creditwallet = reqInt(p.creditwallet, 'creditwallet');
  const creditwalletname = nStr(p.creditwalletname);
  const status = reqInt(p.status, 'status');
  const Empid = req.user.emp_id;
  const MODIFYBY = Empid; void MODIFYBY;
  let Result = '';
  try {
    const row = await db.procOne(DB, 'USP_TEAM_BUILDING_SETTING', {
      DRSID, LEVEL: level, FROMBV: FromBv, TOBV: ToBv, DIRECTPER: DirectPer, NOOFDIRECT: noofdirect, DIRECTBV: directbv, WITHINDAY: withinday,
      CLOSINGTYPE: closingtype, CLOSINGTYPENAME: closingtypename, WALLETTYPE: creditwallet, WALLETTYPENAME: creditwalletname, STATUS: status,
      MODIFYBY: Empid,
    });
    const v = col(row, 'intresult');
    if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.'); // Convert.ToInt32(DBNull)
    Result = String(Math.round(Number(v)));
  } catch (ex) {
    // swallowed (legacy empty catch)
  }
  return res.json(Result);
}));

module.exports = router;
