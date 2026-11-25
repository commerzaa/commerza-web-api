'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Shopper_Reward_Setting.cs (class Shopper_Reward_SettingController => /admin/Shopper_Reward_Setting/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch13-06-common');

const router = express.Router();
const { DB } = B;
const C = 'Shopper_Reward_Setting';

// PORT-NOTE: `private static string url, url1` - static fields (written by Index, never read).
let url = '';
let url1 = '';

/** class Shopper_Reward_Setting */
const PROPS = ['DRSID', 'FROMBV', 'TOBV', 'FROMSELFPONT', 'TOSELFPOINT', 'MINIMUMSHOPPING', 'DIRECTPER', 'NOOFDIRECT', 'SEFTBV', 'CLOSINGTYPE',
  'WALLETTYPE', 'ACTIVE', 'STATUS', 'CLOSINGTYPENAME', 'WALLETTYPENAME'];

// ---------------------------------------------------------------- Index(string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/shopper-reward-setting" -> Shopper_Reward_Setting/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/shopper-reward-setting'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  void url;
  const PackageBinarySetting = mapRows(await db.proc(DB, 'USP_GETSHOPPINGREWARDLIST', {}), PROPS);
  return res.json({ view: '~/Views/AdminPanel/Shopper_Reward_Setting/Index.cshtml', Model: PackageBinarySetting });
}));

// ---------------------------------------------------------------- JsonResult SubmitBunusRewardSetting(int DRSID, decimal DirectPer, decimal Frombv, decimal Tobv,
//   decimal Fromselfpoint, decimal Toselfpoint, decimal Minimumshopping, int noofdirect, int closingtype, string closingtypename, int creditwallet,
//   string creditwalletname, int status)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/SubmitBunusRewardSetting{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  // non-nullable value-type parameters: missing => model-binding exception (500)
  const DRSID = B.reqInt(req.p.DRSID, 'DRSID');
  const DirectPer = B.reqDec(req.p.DirectPer, 'DirectPer');
  const Frombv = B.reqDec(req.p.Frombv, 'Frombv');
  const Tobv = B.reqDec(req.p.Tobv, 'Tobv');
  const Fromselfpoint = B.reqDec(req.p.Fromselfpoint, 'Fromselfpoint');
  const Toselfpoint = B.reqDec(req.p.Toselfpoint, 'Toselfpoint');
  const Minimumshopping = B.reqDec(req.p.Minimumshopping, 'Minimumshopping');
  const noofdirect = B.reqInt(req.p.noofdirect, 'noofdirect');
  const closingtype = B.reqInt(req.p.closingtype, 'closingtype');
  const closingtypename = B.nStr(req.p.closingtypename);
  const creditwallet = B.reqInt(req.p.creditwallet, 'creditwallet');
  const creditwalletname = B.nStr(req.p.creditwalletname);
  const status = B.reqInt(req.p.status, 'status');
  const Empid = req.user.emp_id;
  const MODIFYBY = Empid; void MODIFYBY;
  let Result = '';
  try {
    const p = B.need({
      DRSID, DIRECTPER: DirectPer, FROMBV: Frombv, TOBV: Tobv, FROMSELFPOINT: Fromselfpoint, TOSELFPOINT: Toselfpoint, MINSHOPPING: Minimumshopping,
      NOOFDIRECT: noofdirect, CLOSINGTYPE: closingtype, CLOSINGTYPENAME: closingtypename, WALLETTYPE: creditwallet, WALLETTYPENAME: creditwalletname,
      STATUS: status, MODIFYBY: Empid,
    });
    const row = await db.procOne(DB, 'USP_MINIMUMSHOPPING_SETTING', p);
    const v = B.col(row, 'intresult');
    if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.'); // Convert.ToInt32(DBNull)
    Result = String(B.cvtInt(v));
  } catch (ex) {
    // empty catch (legacy)
  }
  return res.json(Result);
}));

module.exports = router;
