'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Bonus_Reward_Setting.cs (class Bonus_Reward_SettingController => /admin/Bonus_Reward_Setting/...)
// Database: affiliate (Db_Affiliate). Model class Bonus_Reward_Setting (same file) => SETTING_PROPS.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const { outVal, sp, reqNum, netDefault } = require('./_shared/batch04B_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Bonus_Reward_Setting';

const SETTING_PROPS = ['DRSID', 'DIRECTPER', 'NOOFDIRECT', 'SEFTBV', 'CLOSINGTYPE', 'WALLETTYPE', 'ACTIVE', 'STATUS', 'CLOSINGTYPENAME', 'WALLETTYPENAME'];

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields (written, never read here).
let url = ''; // eslint-disable-line no-unused-vars
let url1 = '';

// ---------------------------------------------------------------- ActionResult Index(string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/bonus-reward-setting" -> Bonus_Reward_Setting/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/bonus-reward-setting{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  sp(req, 'btnexel'); // bound, unused
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  // USP_GETBONUSREWARDSETTINGLIST
  const PackageBinarySetting = mapRows(await db.proc(DB, 'USP_GETBONUSREWARDSETTINGLIST', {}), SETTING_PROPS);
  res.json({ view: '~/Views/AdminPanel/Bonus_Reward_Setting/Index.cshtml', Model: PackageBinarySetting });
}));

// ---------------------------------------------------------------- JsonResult SubmitBunusRewardSetting(int DRSID, decimal DirectPer, int noofdirect, int closingtype, string closingtypename, int creditwallet, string creditwalletname, int status)
// auth (reads Session["Admin_User"] outside the try)
router.all(`/admin/${C}/SubmitBunusRewardSetting{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const DRSID = reqNum(req, 'DRSID');
  const DirectPer = reqNum(req, 'DirectPer', 'System.Decimal');
  const noofdirect = reqNum(req, 'noofdirect');
  const closingtype = reqNum(req, 'closingtype');
  const closingtypename = sp(req, 'closingtypename');
  const creditwallet = reqNum(req, 'creditwallet');
  const creditwalletname = sp(req, 'creditwalletname');
  const status = reqNum(req, 'status');
  const Empid = req.user.emp_id;
  let Result = '';
  try {
    const Date_ = netDefault(new Date()); // eslint-disable-line no-unused-vars
    // USP_BONUSREWARD_SETTING @DRSID,@DIRECTPER,@NOOFDIRECT,@CLOSINGTYPE,@CLOSINGTYPENAME,@WALLETTYPE,@WALLETTYPENAME,@STATUS,@MODIFYBY,@INTRESULT out
    const rows = await db.proc(DB, 'USP_BONUSREWARD_SETTING', {
      DRSID, DIRECTPER: DirectPer, NOOFDIRECT: noofdirect, CLOSINGTYPE: closingtype, CLOSINGTYPENAME: closingtypename, WALLETTYPE: creditwallet,
      WALLETTYPENAME: creditwalletname, STATUS: status, MODIFYBY: Empid,
    });
    const v = outVal(rows, 'INTRESULT');
    if (v === null || v === '') throw new Error('Object cannot be cast from DBNull to other types.'); // Convert.ToInt32(DBNull)
    Result = String(Math.round(Number(v)));
  } catch (ex) {
    // legacy empty catch
  }
  res.json(Result);
}));

module.exports = router;
