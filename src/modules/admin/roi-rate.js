'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ROIRate.cs (class ROIRateController, no namespace => /admin/ROIRate/...)
// Database: affiliate (Db_Affiliate). Procs USP_GETEXCELPERMISIONSTATUS, USP_ROIRATESETTING_RECORD_HISTORY, USP_ROIRATESETTING_RECORD,
// USP_EXCEL_DOWNLOAD_HISTORY, USP_ROI_SETTING; tables admin_security_key, settings, tbl_employee_master, tbl_branch_master.
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Admin_Security_Key = require('../../lib/admin/Admin_Security_Key');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  nStr, reqInt, reqDec, col, nullRef, nowStamp, netFormat, netDateString, excelHistory, writeXlsExport, cellStr, tab, dec2, jsonDenyGet,
} = require('./_shared/batch06-common');
const { inlinePerms } = require('./_shared/batch11-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'ROIRate';

/** public class RoiRateSetting */
const ROI_RATE_SETTING_PROPS = ['RMID', 'FROMBV', 'TOBV', 'DAILYRATE', 'TOTALDAYS', 'HOLDDAYS', 'LASTUPDATE', 'STATUS'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** Db._Settings.Where(a => a.caption == "ROI Setting OTP").Select(a => a.Active).FirstOrDefault() */
async function isOtpBypass() {
  const v = await db.scalar(DB, "select (active)::int as active from settings where caption = 'ROI Setting OTP' limit 1", {});
  return Number(v) === 1;
}

/** select isnull(Status,0) from Admin_Security_Key where Emp_Id=<Empid> and Status=1  (SqlQuery<bool>.FirstOrDefault()) */
async function isGaKeyActive(Empid) {
  const v = await db.scalar(DB, 'select coalesce((status)::int, 0) as status from admin_security_key where emp_id = @Empid and (status)::int = 1 limit 1',
    { Empid });
  return Number(v) === 1;
}

/** USP_ROI_SETTING @RMID,@FROMBV,@TOBV,@DAILYRATE,@TOTALDAYS,@HOLDDAYS,@LASTUPDATE,@MODIFYBY,@INTRESULT OUT => Convert.ToInt32(IntResult.Value).ToString() */
async function roiSetting(Rmid, Fbv, ToBv, DailyRate, TotalDays, HoldDays, userid) {
  const Date = netDateString(new Date()); // DateTime.Now.ToString()
  const row = await db.procOne(DB, 'USP_ROI_SETTING', {
    RMID: Rmid, FROMBV: Fbv, TOBV: ToBv, DAILYRATE: DailyRate, TOTALDAYS: TotalDays, HOLDDAYS: HoldDays, LASTUPDATE: Date, MODIFYBY: userid,
  });
  const v = col(row, 'INTRESULT');
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  return String(Math.round(Number(v)));
}

/** public void ExportReport() */
async function ExportReport(req, res, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'ROI_Rate_Setting_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const RoiSetting = mapRows(await db.proc(DB, 'USP_ROIRATESETTING_RECORD', {}), ROI_RATE_SETTING_PROPS);
  if (RoiSetting.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'ROI_Rate_Setting.xls', Filename, ViewBag, rows: RoiSetting,
      headers: ['S.No.', 'From Business Value', 'To Business Value', 'Daily Rate(%)', 'Total Days', 'Hold Days', 'Last Update'],
      innerProc: 'ROI_Rate_Setting', outerProc: 'USP_Overall_Earning',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'RMID')) + ' \t');
        w(tab(dec2(item.FROMBV)) + ' \t');
        w(tab(dec2(item.TOBV)) + ' \t');
        w(tab(dec2(item.DAILYRATE)) + ' \t');
        w(tab(cellStr(item, 'TOTALDAYS')) + ' \t');
        w(tab(cellStr(item, 'HOLDDAYS')) + ' \t');
        w(tab(netFormat(item.LASTUPDATE, 'dd MM yyyy')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/ROI-Rate" -> ROIRate/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/ROI-Rate{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  let btnexel = nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  try {
    const Employeeid = req.user.emp_id;
    if (btnexel === null) btnexel = '';
    // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out  (USP_EXCEL_LINK block is commented out in the legacy code)
    const p = await inlinePerms(Employeeid, url);
    ViewBag.isactive = p.isactive;
    ViewBag.isedit = p.isedit;
    if (btnexel === 'Export Excel') {
      const x = await ExportReport(req, res, ViewBag);
      if (x.sent) return undefined;
    }
    const RoiSetting = mapRows(await db.proc(DB, 'USP_ROIRATESETTING_RECORD_HISTORY', {}), ROI_RATE_SETTING_PROPS);
    const RoiRateSetting = mapRows(await db.proc(DB, 'USP_ROIRATESETTING_RECORD', {}), ROI_RATE_SETTING_PROPS);
    ViewBag.PackageDetails = RoiRateSetting;
    return res.json({ view: '~/Views/AdminPanel/ROIRate/Index.cshtml', Model: RoiSetting, ...ViewBag });
  } catch (Ex) {
    if (res.headersSent) return undefined;
    // catch => return View("~/Views/AdminPanel/ROIRate/Index.cshtml") (no model, no ErrorInsert)
    return res.json({ view: '~/Views/AdminPanel/ROIRate/Index.cshtml', Model: null, ...ViewBag });
  }
}));

// ---------------------------------------------------------------- public void ExportReport()
// auth (PORT-NOTE: public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, {});
  if (!x.sent) res.send(''); // void action => empty response
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
  const IsGaKeyActive = await isGaKeyActive(Empid);
  const IsOTPBypass = await isOtpBypass();
  if (IsGaKeyActive === false) {
    if (IsOTPBypass === true) {
      // new Thread(() => SendEmailByApiSetting(Username,"","","","","",EmailId,"Update ROI Rate",Message,null,"","")).Start()
      Promise.resolve()
        .then(() => UtilityClass.SendEmailByApiSetting(Username, '', '', '', '', '', EmailId, 'Update ROI Rate', Message, null, '', ''))
        .catch((e) => console.error('[admin] ROIRate OTP mail failed:', e.message));
      returnmessage = 'OTP SENT';
    } else {
      returnmessage = 'OTP BY PASS';
    }
  } else {
    returnmessage = 'Active Gakey';
  }
  return res.json(returnmessage);
}));

// ---------------------------------------------------------------- JsonResult UpdateOrAddRoiSetting(int Rmid, decimal Fbv, decimal ToBv, decimal DailyRate,
//   int TotalDays, int HoldDays, string Otp, string AuthenticationCode, string IsGoogleAuthenticated)
// auth (PORT-NOTE: legacy had no session check but dereferences Session["Admin_User"] => adminAuth)
router.all(`/admin/${C}/UpdateOrAddRoiSetting{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Rmid = reqInt(req.p.Rmid, 'Rmid');
  const Fbv = reqDec(req.p.Fbv, 'Fbv');
  const ToBv = reqDec(req.p.ToBv, 'ToBv');
  const DailyRate = reqDec(req.p.DailyRate, 'DailyRate');
  const TotalDays = reqInt(req.p.TotalDays, 'TotalDays');
  const HoldDays = reqInt(req.p.HoldDays, 'HoldDays');
  const Otp = nStr(req.p.Otp);
  let AuthenticationCode = nStr(req.p.AuthenticationCode);
  let IsGoogleAuthenticated = nStr(req.p.IsGoogleAuthenticated);
  if (AuthenticationCode === null) AuthenticationCode = '';
  if (IsGoogleAuthenticated === null || IsGoogleAuthenticated === '') IsGoogleAuthenticated = '0';
  let OutPutMessage = '';
  const ViewBag = {};
  const Empid = req.user.emp_id;
  try {
    if (AuthenticationCode !== '') {
      const loginID = req.user.emp_loginid;
      // Emp_Password is not in the token (SESSION.md): read it fresh.
      const password = await db.scalar(DB, 'select emp_password from tbl_employee_master where emp_id = @id', { id: Empid });
      const EncryptedPassword = password;
      // Db._Employee_Master.Where(a => a.Emp_LoginID.Equals(loginID) && a.Emp_Password.Equals(EncryptedPassword) && a.Active.Equals(true)).FirstOrDefault()
      const v = await db.queryOne(DB, `select emp_id as "Emp_ID" from tbl_employee_master
        where emp_loginid = @loginID and emp_password = @EncryptedPassword and (active)::int = 1 limit 1`, { loginID, EncryptedPassword });
      // Db._Branch_Master.Where(a => a.Active == true).FirstOrDefault()
      const row = await db.queryOne(DB, 'select brid from tbl_branch_master where (active)::int = 1 limit 1', {});
      const IsGoogleAuthenti = await isGaKeyActive(Empid);
      if (IsGoogleAuthenti === true) IsGoogleAuthenticated = '1';
      if (row !== null) {
        // Authencation for google starts here
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
          let ActiveKey = 0;
          objs = await objs.Get_Security_Key(Empid);
          if (objs !== null && objs !== undefined) {
            ActiveKey = Number(objs.ActiveKey);
            if (ActiveKey === 2) {
              if (!v) throw nullRef(); // v.Emp_ID
              objs = await objs.Get_Security_Key(v.Emp_ID);
              if (objs !== null && objs !== undefined) {
                objs = await objs.Get_Security_Key(v.Emp_ID);
                if (objs !== null && objs !== undefined) {
                  const ValidRandomNo = await objs.Get_GA_Key(v.Emp_ID);
                  if (!(await objs.Check_GaKeyForEnableTime(v.Emp_ID, ValidRandomNo, AuthenticationCode))) {
                    if (AuthenticationCode !== '') {
                      return jsonDenyGet(req, res, '3'); // Json("3") without AllowGet
                    }
                  }
                  // PORT-NOTE: legacy saves nothing when the GA code is valid (OutPutMessage stays "") - kept.
                } else {
                  const userid = req.user.emp_id;
                  OutPutMessage = await roiSetting(Rmid, Fbv, ToBv, DailyRate, TotalDays, HoldDays, userid);
                }
              }
            }
            return res.json(OutPutMessage);
          }
        }
      }
    } else {
      const IsOTPBypass = await isOtpBypass();
      if (IsOTPBypass !== true) {
        // PORT-NOTE: AppSettings["MasterCode"] => config.app.MasterCode; an unset/empty MasterCode never matches (legacy null == null matched).
        const MasterCode = config.app.MasterCode || '';
        if (MasterCode === '' || MasterCode !== Otp) {
          OutPutMessage = 'You have enterd wrong otp';
          return res.json(OutPutMessage);
        }
      } else {
        const s = sessionStore.get(req, 'SessionOTP');
        if (s === null || s === undefined) throw nullRef(); // Session["SessionOTP"].ToString()
        const ActualOtp = String(s);
        if (Otp !== ActualOtp) {
          OutPutMessage = '2';
          return jsonDenyGet(req, res, OutPutMessage); // Json(OutPutMessage) without AllowGet
        }
      }
      const userid = req.user.emp_id;
      OutPutMessage = await roiSetting(Rmid, Fbv, ToBv, DailyRate, TotalDays, HoldDays, userid);
    }
  } catch (ex) { /* swallowed (legacy empty catch) */ }
  return res.json(OutPutMessage);
}));

module.exports = router;
