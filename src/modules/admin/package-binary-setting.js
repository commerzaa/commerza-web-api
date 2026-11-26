'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Package_Binary_Setting.cs (class Package_Binary_SettingController, no namespace
// => /admin/Package_Binary_Setting/...). Database: affiliate (Db_Affiliate). Procs USP_EXCEL_LINK, USP_GETEXCELPERMISIONSTATUS,
// USP_GETBINARYSETING_RECORD, USP_GETBINARYSETING_HISTORY, USP_EXCEL_DOWNLOAD_HISTORY, USP_BINARY_BUSINESS_SETTING;
// tables admin_security_key, tbl_employee_master, tbl_branch_master.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Admin_Security_Key = require('../../lib/admin/Admin_Security_Key');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  nStr, reqInt, reqDec, col, cellStr, tab, dec2, netFormat, netDateString, nowStamp, excelHistory, writeXlsExport, excelLink, inlinePerms, nullRef,
} = require('./_shared/batch11-common');
const { jsonDenyGet, listToString } = require('./_shared/batch06-common');
const { gaKeyActive, PACKAGE_BINARY_SETTING_PROPS } = require('./_shared/batch13-01-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Package_Binary_Setting';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** public List<PackageBinarySetting> BinarySettingHistory() - exceptions swallowed => empty list */
async function BinarySettingHistory() {
  let PackageBinarySetting = [];
  try {
    PackageBinarySetting = mapRows(await db.proc(DB, 'USP_GETBINARYSETING_HISTORY', {}), PACKAGE_BINARY_SETTING_PROPS);
  } catch (ex) { /* swallowed (legacy empty catch) */ }
  return PackageBinarySetting;
}

/** public void ExportReport() */
async function ExportReport(req, res, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Package_Binary_Setting_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const PackageBinarySetting = mapRows(await db.proc(DB, 'USP_GETBINARYSETING_RECORD', {}), PACKAGE_BINARY_SETTING_PROPS);
  if (PackageBinarySetting.length > 0) {
    let rownumber = 1;
    const Username = req.user.emp_name;
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Package_Binary_Setting.xls', Filename, rows: PackageBinarySetting,
      headers: ['S.No.', 'From Business Value', 'To Business Value', 'Binary Percentage(%)', 'Capping (%)', 'From Repurchase Business Value',
        'To Repurchase Business Value', 'Repurchase Bineary (%)', 'Modify By', 'Last Update'],
      innerProc: 'Package_Binary_Setting', outerProc: 'USP_Overall_Earning',
      cells: (item, w) => {
        w('\n');
        w(tab(String(rownumber)) + ' \t');
        w(tab(dec2(item.FROMBV)) + ' \t');
        w(tab(dec2(item.TOBV)) + ' \t');
        w(tab(dec2(item.BINARYPERCENTAGE)) + ' \t');
        w(tab(dec2(item.CAPPINGPERCENTAGE)) + ' \t');
        w(tab(dec2(item.FROMRBV)) + ' \t');
        w(tab(dec2(item.TORBV)) + ' \t');
        w(tab(dec2(item.RBINARYPERCENTAGE)) + ' \t');
        if (Username === null || Username === undefined) throw nullRef(); // Username.ToString()
        w(tab(String(Username)) + ' \t');
        w(tab(netFormat(item.MODIFYDATE, 'dd MMM yyyy')) + ' \t');
        rownumber += 1;
      },
    });
  }
  return { sent: false };
}

/** USP_BINARY_BUSINESS_SETTING call of SubmitBinarySetting.
 *  PORT-NOTE: the legacy text "USP_BINARY_BUSINESS_SETTING @BBSID,@FROMBV,@TOBV,@BINARYPERCENTAGE,@FROMRBV,@TORBV,@RBINARYPERCENTAGE,
 *  @CAPPINGPERCENTAGE,@MODIFYBY,@MODIFYDATE,@INTRESULT out" passes its values POSITIONALLY. The procedure in the schema dump is declared
 *  (@BBSID,@FROMBV,@TOBV,@BINARYPERCENTAGE,@FROMRBV,@TORBV,@RBINARYPERCENTAGE,@BINARYCAPPINGLIMITS,@RBINARYCAPPINGLIMITS,@MODIFYBY,@MODIFYDATE,
 *  @INTRESULT out), so SQL Server bound Capping -> @BINARYCAPPINGLIMITS, Empid -> @RBINARYCAPPINGLIMITS, the date text -> @MODIFYBY (int) and
 *  the OUTPUT parameter -> @MODIFYDATE (not OUTPUT) => the call always raised an error, swallowed by the action's empty catch (Result "").
 *  The same positional binding is reproduced here by name (the date text in the int @MODIFYBY fails the same way). */
async function binaryBusinessSetting(Bbbsid, FromBv, ToBv, BinaryPercentae, FrBv, Torbv, RepurchageBinaryper, Capping, Empid, DateText) {
  const row = await db.procOne(DB, 'USP_BINARY_BUSINESS_SETTING', {
    BBSID: Bbbsid, FROMBV: FromBv, TOBV: ToBv, BINARYPERCENTAGE: BinaryPercentae, FROMRBV: FrBv, TORBV: Torbv, RBINARYPERCENTAGE: RepurchageBinaryper,
    BINARYCAPPINGLIMITS: Capping, RBINARYCAPPINGLIMITS: Empid, MODIFYBY: DateText,
  });
  const v = col(row, 'INTRESULT');
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.'); // Convert.ToInt32(DBNull)
  return String(Math.round(Number(v)));
}

// ---------------------------------------------------------------- ActionResult Index(string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Package-Binary-Setting" -> Package_Binary_Setting/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Package-Binary-Setting{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  let btnexel = nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  ViewBag.excelactive = await excelLink(url);
  if (btnexel === null) btnexel = '';
  const p = await inlinePerms(Employeeid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag);
    if (r.sent) return undefined; // Response.End()
  }
  const PackageBinarySetting = mapRows(await db.proc(DB, 'USP_GETBINARYSETING_RECORD', {}), PACKAGE_BINARY_SETTING_PROPS);
  ViewBag.BinaryHistory = await BinarySettingHistory();
  return res.json({ view: '~/Views/AdminPanel/Package_Binary_Setting/Index.cshtml', Model: PackageBinarySetting, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport()
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {});
  if (!r.sent) res.send(''); // void action => empty response
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
    return jsonDenyGet(req, res, 'Invalid^You need to update your Emailid'); // Json(...) without AllowGet
  }
  const IsGaKeyActive = await gaKeyActive(Empid);
  if (IsGaKeyActive === false) {
    // new Thread(() => SendEmailByApiSetting(Username,"","","","","",EmailId,"Package Setting",Message,null,"","")).Start()
    Promise.resolve()
      .then(() => UtilityClass.SendEmailByApiSetting(Username, '', '', '', '', '', EmailId, 'Package Setting', Message, null, '', ''))
      .catch((e) => console.error('[admin] Package_Binary_Setting OTP mail failed:', e.message));
    returnmessage = 'OTP SENT';
  } else {
    returnmessage = 'Active Gakey';
  }
  return res.json(returnmessage);
}));

// ---------------------------------------------------------------- JsonResult SubmitBinarySetting(int Bbbsid, decimal FromBv, decimal ToBv, decimal BinaryPercentae,
//   decimal Capping, decimal FrBv, decimal Torbv, decimal RepurchageBinaryper, string Otp, string AuthenticationCode, string IsGoogleAuthenticated)
// auth (PORT-NOTE: legacy had no session check but dereferences Session["Admin_User"] => adminAuth)
router.all(`/admin/${C}/SubmitBinarySetting{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Bbbsid = reqInt(req.p.Bbbsid, 'Bbbsid');
  const FromBv = reqDec(req.p.FromBv, 'FromBv');
  const ToBv = reqDec(req.p.ToBv, 'ToBv');
  const BinaryPercentae = reqDec(req.p.BinaryPercentae, 'BinaryPercentae');
  const Capping = reqDec(req.p.Capping, 'Capping');
  const FrBv = reqDec(req.p.FrBv, 'FrBv');
  const Torbv = reqDec(req.p.Torbv, 'Torbv');
  const RepurchageBinaryper = reqDec(req.p.RepurchageBinaryper, 'RepurchageBinaryper');
  const Otp = nStr(req.p.Otp);
  let AuthenticationCode = nStr(req.p.AuthenticationCode);
  let IsGoogleAuthenticated = nStr(req.p.IsGoogleAuthenticated);
  if (AuthenticationCode === null) AuthenticationCode = '';
  if (IsGoogleAuthenticated === null || IsGoogleAuthenticated === '') IsGoogleAuthenticated = '0';
  const Empid = req.user.emp_id;
  const MODIFYBY = Empid; // eslint-disable-line no-unused-vars
  const ViewBag = {}; // ViewBag.IsGoogleAuthenticated is set but never returned by the JsonResult
  let Result = '';
  try {
    if (AuthenticationCode !== '') {
      const loginID = req.user.emp_loginid;
      // Emp_Password is not in the token (SESSION.md): read fresh
      const password = await db.scalar(DB, 'select emp_password from tbl_employee_master where emp_id = @id', { id: Empid });
      const EncryptedPassword = password;
      // db._Employee_Master.Where(a => a.Emp_LoginID.Equals(loginID) && a.Emp_Password.Equals(EncryptedPassword) && a.Active.Equals(true)).FirstOrDefault()
      const v = await db.queryOne(DB, `select emp_id from tbl_employee_master
        where emp_loginid = @loginID and emp_password = @EncryptedPassword and active::int = 1 limit 1`, { loginID, EncryptedPassword });
      const row = await db.queryOne(DB, 'select brid from tbl_branch_master where active::int = 1 limit 1', {});
      const IsGoogleAuthenti = await gaKeyActive(Empid);
      if (IsGoogleAuthenti === true) IsGoogleAuthenticated = '1';
      if (row !== null) {
        let gaObj = new Admin_Security_Key();
        gaObj = await gaObj.Get_Security_Key(Empid);
        if (gaObj !== null && gaObj !== undefined) {
          ViewBag.IsGoogleAuthenticated = '1';
          IsGoogleAuthenticated = '1';
        } else {
          ViewBag.IsGoogleAuthenticated = '0';
          IsGoogleAuthenticated = '0';
        }
        if (IsGoogleAuthenticated !== '0') {
          let objs = new Admin_Security_Key();
          objs = await objs.Get_Security_Key(Empid);
          if (objs !== null && objs !== undefined) {
            if (v === null) throw nullRef(); // v.Emp_ID
            const vEmpId = v.emp_id;
            objs = await new Admin_Security_Key().Get_Security_Key(vEmpId);
            if (objs !== null && objs !== undefined) {
              const keyObj = new Admin_Security_Key();
              const ValidRandomNo = await keyObj.Get_GA_Key(vEmpId);
              if (!(await keyObj.Check_GaKeyForEnableTime(vEmpId, ValidRandomNo, AuthenticationCode))) {
                if (AuthenticationCode !== '') {
                  return jsonDenyGet(req, res, '3'); // Json("3") without AllowGet
                }
              } else {
                const DateText = netDateString(new Date()); // string Date = DateTime.Now.ToString()
                Result = await binaryBusinessSetting(Bbbsid, FromBv, ToBv, BinaryPercentae, FrBv, Torbv, RepurchageBinaryper, Capping, Empid, DateText);
              }
            }
          }
        }
      }
    } else {
      const so = sessionStore.get(req, 'SessionOTP');
      if (so === null || so === undefined) throw nullRef(); // Session["SessionOTP"].ToString()
      const ActualOtp = String(so);
      if (Otp === ActualOtp) {
        const DateText = netDateString(new Date()); // string Date = DateTime.Now.ToString()
        Result = await binaryBusinessSetting(Bbbsid, FromBv, ToBv, BinaryPercentae, FrBv, Torbv, RepurchageBinaryper, Capping, Empid, DateText);
      } else {
        Result = '2';
      }
    }
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
