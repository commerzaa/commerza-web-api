'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Direct_Bonus_Setting.cs (class Direct_Bonus_SettingController, no namespace => /Direct_Bonus_Setting/...)
// Database: affiliate (Db_Affiliate). Procs USP_GETDIRECTBONUSSETTINGLIST, USP_GETBINARYSETING_HISTORY, USP_DIRECT_BONUS_SETTING; table admin_security_key.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const { nStr, reqInt, reqDec, col, nullRef, listToString } = require('./_shared/batch06-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Direct_Bonus_Setting';

/** public class Direct_Bonus_Setting */
const DIRECT_BONUS_SETTING_PROPS = ['DRSID', 'FROMBV', 'TOBV', 'DIRECTPER', 'NOOFDIRECT', 'SEFTBV', 'DIRECTBV', 'WITHINDAYS', 'CLOSINGTYPE',
  'WALLETTYPE', 'ACTIVE', 'STATUS', 'CLOSINGTYPENAME', 'WALLETTYPENAME'];
/** Package_Binary_Setting.cs class PackageBinarySetting */
const PACKAGE_BINARY_SETTING_PROPS = ['BBSID', 'FROMBV', 'TOBV', 'BINARYPERCENTAGE', 'FROMRBV', 'TORBV', 'RBINARYPERCENTAGE', 'CAPPINGPERCENTAGE',
  'MODIFYBY', 'MODIFYDATE'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (written by Index, never read elsewhere).
let url = ''; // eslint-disable-line no-unused-vars
let url1 = '';

/** public List<PackageBinarySetting> BinarySettingHistory() - exceptions swallowed => empty list */
async function BinarySettingHistory() {
  let PackageBinarySetting = [];
  try {
    PackageBinarySetting = mapRows(await db.proc(DB, 'USP_GETBINARYSETING_HISTORY', {}), PACKAGE_BINARY_SETTING_PROPS);
  } catch (ex) { /* swallowed (legacy empty catch) */ }
  return PackageBinarySetting;
}

// ---------------------------------------------------------------- ActionResult Index(string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin")). btnexel is unused by the legacy action.
// route-config: "AdminPanel/direct-bonus-setting" -> Direct_Bonus_Setting/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/direct-bonus-setting'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const PackageBinarySetting = mapRows(await db.proc(DB, 'USP_GETDIRECTBONUSSETTINGLIST', {}), DIRECT_BONUS_SETTING_PROPS);
  const BinaryHistory = await BinarySettingHistory();
  res.json({ view: '~/Views/AdminPanel/Direct_Bonus_Setting/Index.cshtml', Model: PackageBinarySetting, BinaryHistory });
}));

// ---------------------------------------------------------------- JsonResult GenerateOTP()
// auth (PORT-NOTE: legacy had no session check but dereferences Session["Admin_User"] => adminAuth)
router.all(`/admin/${C}/GenerateOTP{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  sessionStore.set(req, 'SessionOTP', OTP); // Session["SessionOTP"] = OTP
  const Username = req.user.emp_name;
  const Message = 'Dear ' + Username + ' your otp is:' + OTP + '';
  const EmailId = req.user.emp_email;
  const Empid = req.user.emp_id;
  const email = EmailId;
  if (email === null || email === undefined) throw nullRef(); // Regex.Match(null) => ArgumentNullException
  const match = /^([\w.-]+)@([\w-]+)((\.(\w){2,3})+)$/.test(email);
  if (!match) {
    // return Json("Invalid^You need to update your Emailid")  (DenyGet)
    if (String(req.method).toUpperCase() === 'GET') {
      return res.status(500).json({ message: 'This request has been blocked because sensitive information could be disclosed to third party web sites when this is used in a GET request. To allow GET requests, set JsonRequestBehavior to AllowGet.' });
    }
    return res.json('Invalid^You need to update your Emailid');
  }
  // select isnull(Status,0) from Admin_Security_Key where Emp_Id=<Empid> and Status=1   (FirstOrDefault<bool>)
  const st = await db.scalar(DB, 'select coalesce(status, false) from admin_security_key where emp_id = @Empid and status = true limit 1', { Empid });
  const IsGaKeyActive = st === null || st === undefined ? false : !!st;
  if (IsGaKeyActive === false) {
    // new Thread(() => SendEmailByApiSetting(Username,"","","","","",EmailId,"Package Setting",Message,null,"","")).Start()
    Promise.resolve()
      .then(() => UtilityClass.SendEmailByApiSetting(Username, '', '', '', '', '', EmailId, 'Package Setting', Message, null, '', ''))
      .catch((e) => console.error('[admin] Direct_Bonus_Setting OTP mail failed:', e.message));
    returnmessage = 'OTP SENT';
  } else {
    returnmessage = 'Active Gakey';
  }
  return res.json(returnmessage);
}));

// ---------------------------------------------------------------- JsonResult SubmitDirectSetting(int DRSID, decimal FromBv, decimal ToBv, decimal DirectPer,
//   int noofdirect, decimal directbv, int withinday, int closingtype, string closingtypename, int creditwallet, string creditwalletname, int status)
// auth (PORT-NOTE: legacy had no session check but dereferences Session["Admin_User"] => adminAuth)
router.all(`/admin/${C}/SubmitDirectSetting{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const DRSID = reqInt(req.p.DRSID, 'DRSID');
  const FromBv = reqDec(req.p.FromBv, 'FromBv');
  const ToBv = reqDec(req.p.ToBv, 'ToBv');
  const DirectPer = reqDec(req.p.DirectPer, 'DirectPer');
  const noofdirect = reqInt(req.p.noofdirect, 'noofdirect');
  const directbv = reqDec(req.p.directbv, 'directbv');
  const withinday = reqInt(req.p.withinday, 'withinday');
  const closingtype = reqInt(req.p.closingtype, 'closingtype');
  const closingtypename = nStr(req.p.closingtypename);
  const creditwallet = reqInt(req.p.creditwallet, 'creditwallet');
  const creditwalletname = nStr(req.p.creditwalletname);
  const status = reqInt(req.p.status, 'status');
  const Empid = req.user.emp_id;
  const MODIFYBY = Empid; // eslint-disable-line no-unused-vars
  let Result = '';
  try {
    // USP_DIRECT_BONUS_SETTING @DRSID,@FROMBV,@TOBV,@DIRECTPER,@NOOFDIRECT,@DIRECTBV,@WITHINDAY,@CLOSINGTYPE,@CLOSINGTYPENAME,@WALLETTYPE,
    //   @WALLETTYPENAME,@STATUS,@MODIFYBY,@INTRESULT out
    const row = await db.procOne(DB, 'USP_DIRECT_BONUS_SETTING', {
      DRSID, FROMBV: FromBv, TOBV: ToBv, DIRECTPER: DirectPer, NOOFDIRECT: noofdirect, DIRECTBV: directbv, WITHINDAY: withinday,
      CLOSINGTYPE: closingtype, CLOSINGTYPENAME: closingtypename, WALLETTYPE: creditwallet, WALLETTYPENAME: creditwalletname, STATUS: status,
      MODIFYBY: Empid,
    });
    const v = col(row, 'INTRESULT');
    if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
    Result = String(Math.round(Number(v)));
  } catch (ex) { /* swallowed (legacy empty catch) */ }
  return res.json(Result);
}));

// ---------------------------------------------------------------- public List<PackageBinarySetting> BinarySettingHistory()
// auth (PORT-NOTE: public method => routable in legacy; admin data => adminAuth)
// PORT-NOTE: a public non-ActionResult method is an MVC action whose result is ContentResult(value.ToString()), i.e. the type name.
router.all(`/admin/${C}/BinarySettingHistory{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await BinarySettingHistory();
  res.type('text/html').send(listToString('PackageBinarySetting'));
}));

module.exports = router;
