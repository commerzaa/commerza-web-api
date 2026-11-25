'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\V4Admin\LoginController.cs
// The V4Admin sub-folder has NO namespace/Area => URL controller name is plain "Login" (/admin/Login/...).
// Database: affiliate (Db_Affiliate).
const crypto = require('crypto');
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const { mapRow, mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const GetIP = require('../../lib/admin/GetIP');
const TBL_COMPANYMASTER = require('../../lib/admin/TBL_COMPANYMASTER');
const Admin_Security_Key = require('../../lib/admin/Admin_Security_Key');
const {
  adminAuth, anonReq, adminStoreReq, loadAdminMenu, publicAdminUser, API_MENU_PROPS,
} = require('./_shared/adminSession');
const { findEmployee, establishAdminSession } = require('./_shared/adminLoginDb');

const router = express.Router();
const DB = 'affiliate';
const C = 'Login';
const LOGIN_VIEW = '~/Views/Login/Index.cshtml';
const ADMIN_LOGIN_VIEW = '~/Views/adminlogin/Index.cshtml';

// PORT-NOTE: `public static string IpAddress, CheckEmpIP, Responce, GetTime` were static fields SHARED BY ALL REQUESTS.
// Kept as module-level variables (same race: the POST Index passes the IpAddress last set by ANY GET Index / ForgotPassword).
let IpAddress = '';
let CheckEmpIP = '';
let Responce = '';
let GetTime = '';

const s = (v) => (v === null || v === undefined ? '' : String(v));
/** Convert.ToInt16(object): null => 0 */
const toInt16 = (v) => (v === undefined || v === null || v === '' ? 0 : parseInt(v, 10));
/** DateTime.Now.ToString("HH:mm:ss") */
function nowHHmmss() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
/**
 * Optional string action parameter with a C# default value: absent => default; present but empty => null
 * (MVC ConvertEmptyStringToNull), else the value.
 */
function optStr(req, name, def) {
  if (!req.p.has(name)) return def;
  const v = req.p[name];
  if (v === undefined) return def;
  if (v === null || v === '') return null;
  return String(v);
}

/** [Dbo].[USP_EMPIPADDRESS_CHECKED] @MODE,@EMPID,@IPADDRESS,@LOGINTIME,@RETOUTPUT OUT  => RETOUTPUT.ToString() */
async function empIpAddressChecked(MODE, EMPID, IPADDRESS, LOGINTIME) {
  const row = await db.procOne(DB, 'USP_EMPIPADDRESS_CHECKED', { MODE, EMPID, IPADDRESS, LOGINTIME });
  if (!row) return '';
  const k = Object.keys(row).find((x) => x.toLowerCase() === 'retoutput');
  const v = k === undefined ? row[Object.keys(row)[0]] : row[k];
  return s(v);
}

/** public void GetCompanyDetails() => ViewBag.CompanyName / ViewBag.logo */
async function GetCompanyDetails(ViewBag) {
  /* Get Company Details from here */
  const objCompanyMaster = await new TBL_COMPANYMASTER().CompanyMaster();
  ViewBag.CompanyName = objCompanyMaster.NAME;
  ViewBag.logo = objCompanyMaster.LOGO;
}

/** public void SaveLoginHistory(...) - Save Login History every time eather its fail or its success */
async function SaveLoginHistory(_pLoginID, _pPassword, _pVerificationCode, _pEmployeeEmail, _pEmployeeMobile, _pIPaddress, _pStatus) {
  await db.proc(DB, 'USP_SAVEADMINLOGINHISTORY', {
    LOGINID: _pLoginID, PASSWORD: _pPassword, VERIFICATIONCODE: _pVerificationCode, EMPLOYEEEMAIL: _pEmployeeEmail,
    EMPLOYEEMOBILE: _pEmployeeMobile, IPADDRESS: _pIPaddress, STATUS: _pStatus,
  });
}

/**
 * public void AllowAccountToLogin(string Vcode, string IpAddress) - When member going to enter on dashboard.
 * EmployeeDetails = (Employee_Master)Session["Admin_User"]; stores Session["Admin_User_Menu"] and Session["API_Menu"].
 * Returns { menu, apiMenu } (stored in sessionStore for the admin subject).
 */
async function AllowAccountToLogin(req, EmployeeDetails, Vcode, ip) {
  // Get Menu from user account
  const _objList = await loadAdminMenu(EmployeeDetails.Emp_ID);
  const sreq = adminStoreReq(EmployeeDetails, req);
  sessionStore.set(sreq, 'Admin_User_Menu', _objList);
  // API Menu bind
  const aPI_Menu = mapRows(await db.proc(DB, 'USP_APICMS_MENU_RIGHTS', { EmpID: EmployeeDetails.Emp_ID }), API_MENU_PROPS)
    .filter((a) => Number(a.Active) === 1);
  sessionStore.set(sreq, 'API_Menu', aPI_Menu);
  // Save Login history of admin
  await SaveLoginHistory(EmployeeDetails.Emp_LoginID, EmployeeDetails.Emp_Password, Vcode, EmployeeDetails.Emp_Email,
    EmployeeDetails.Emp_Mobile, ip, 'Success');
  return { menu: _objList, apiMenu: aPI_Menu };
}

/** public void BlockAccount(string _pLoginID) - Block the account incase 5 time wrong password trying to login */
async function BlockAccount(_pLoginID) {
  await db.proc(DB, 'USP_SCALERDATA', { Mode: 1, Identity: _pLoginID });
}

/** public void SaveUpdatePassword_History(int EmpId, string Password) */
async function SaveUpdatePassword_History(EmpId, Password) {
  await db.proc(DB, 'USP_UpdatePassword_History', { EMPID: EmpId, PASSWORD: Password });
}

/** Random 6 chars from "0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNOPQRSTUVWXYZ" */
function regeneratePassword() {
  const _allowedChars = '0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNOPQRSTUVWXYZ';
  let r = '';
  for (let i = 0; i < 6; i++) r += _allowedChars[crypto.randomInt(0, _allowedChars.length)];
  return r;
}

/** Fire-and-forget (legacy System.Threading.Thread). */
function background(fn) {
  Promise.resolve().then(fn).catch((e) => console.error('[admin/Login] background send failed:', e.message));
}

/**
 * Shared body of the two identical "re-generate password" blocks in ForgotPassword.
 * Returns null on success, or the ViewBag.ForgotPassMessage that ends the action.
 */
async function regenerateAndSend(DecryptEmp_id, EmpId) {
  const Emp_Details = await findEmployee({ empCode: DecryptEmp_id });
  const Repassword = regeneratePassword();
  const CompanyName = await db.scalar(DB, 'select name from tbl_companymaster limit 1', {});
  const objEmp = mapRow(await db.procOne(DB, 'USP_NEWREGISTERED_MEMBERDETAILS', { MODE: 1, EMP_ID: Emp_Details.Emp_Code }),
    ['Emp_ID', 'Emp_Code', 'Emp_LoginID', 'Emp_Password', 'Emp_Name', 'Emp_Mobile', 'Emp_Email']);
  const WelcomeEmail = mapRow(await db.queryOne(DB, 'select eid, email_content, email_send_status, email_subject from tbl_emailaction where eid = 1 limit 1', {}),
    ['EID', 'Email_Content', 'Email_Send_Status', 'Email_Subject']);
  const WelcomeSMS = mapRow(await db.queryOne(DB, 'select id, sms_send_status from tbl_smsaction where id = 1 limit 1', {}), ['ID', 'Sms_Send_Status']);
  // #region EMAIL
  if (Number(WelcomeEmail.Email_Send_Status) === 1) { // WelcomeEmail null => TypeError => rethrown (legacy catch { throw; })
    const DynamicMsg = 'Hello,' + s(Emp_Details.Emp_Name) + '<br/>Your Re-Generate Login Password: ' + Repassword + ' <br/><br/>Regards ' + s(CompanyName) + '';
    const to = objEmp.Emp_Email.toLowerCase();
    const subject = WelcomeEmail.Email_Subject;
    background(() => UtilityClass.SendEmailByApiSetting('', '', '', '', '', '', to, subject, DynamicMsg, null));
  } else {
    return 'Send Email Status Not Activate';
  }
  // SMS SECTION START
  if (Number(WelcomeSMS.Sms_Send_Status) === 1 && objEmp.Emp_Mobile !== '') {
    const messg = 'Hello,' + s(Emp_Details.Emp_Name) + '\nYour Re-Generate Login Password: ' + Repassword + '\n\nRegards ' + s(CompanyName) + '';
    const mobile = objEmp.Emp_Mobile;
    background(() => UtilityClass.SendSMSWithAPI(mobile, messg, '1'));
  } else {
    // PORT-NOTE: like the legacy code the e-mail with the new password was already queued, but the password is NOT updated here.
    return 'Send Mobile SMS Status Not Activate';
  }
  await SaveUpdatePassword_History(EmpId, await UtilityClass.Encryptword(Repassword));
  // SMS SECTION END
  return null;
}

// ---------------------------------------------------------------- Index(string tempurl = null)  (GET; any verb except POST)
// public
// route-config: "aminlogin" -> Login/Index
router.get([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/aminlogin'], asyncHandler(async (req, res) => {
  const tempurl = req.p.tempurl === undefined || req.p.tempurl === '' ? null : req.p.tempurl;
  let DcryEmpID = '';
  IpAddress = await GetIP.GetLocalIP(req);
  // (unused locals `p = Encryptword("500004")`, `s = Decryptword("<literal>")` omitted: no side effects)
  Responce = await empIpAddressChecked(2, 0, s(IpAddress).trim(), '');
  if (Responce === 'failed') {
    return res.json({ view: ADMIN_LOGIN_VIEW });
  }
  if (tempurl === null || tempurl === '') {
    return res.json({ view: ADMIN_LOGIN_VIEW });
  }
  DcryEmpID = await UtilityClass.Decryptword(tempurl);
  const ViewBag = { loginID: DcryEmpID, Title: 'Admin Login', TempUrl: tempurl };
  await GetCompanyDetails(ViewBag);
  return res.json({ view: LOGIN_VIEW, ...ViewBag });
}));

// ---------------------------------------------------------------- [HttpPost] Index(loginID, password, Vcode = "", AuthenticationCode = "", IsGoogleAuthenticated = "0", TempUrl = null)
// public (login: issues the JWT that replaces Session["Admin_User"])
// route-config: "aminlogin" -> Login/Index
router.post([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/aminlogin'], asyncHandler(async (req, res) => {
  const loginID = req.p.loginID === undefined || req.p.loginID === '' ? null : String(req.p.loginID);
  const password = req.p.password === undefined || req.p.password === '' ? null : String(req.p.password);
  const Vcode = optStr(req, 'Vcode', '');
  const AuthenticationCode = optStr(req, 'AuthenticationCode', '');
  let IsGoogleAuthenticated = optStr(req, 'IsGoogleAuthenticated', '0'); // eslint-disable-line no-unused-vars
  const TempUrl = optStr(req, 'TempUrl', null);
  const S = anonReq(req); // pre-login session
  const ViewBag = {};
  const view = () => res.json({ view: LOGIN_VIEW, ...ViewBag });

  let DecryptEmp_id = '';
  GetTime = nowHHmmss();
  if (password === null || password === '') {
    ViewBag.Message = 'Enter Password';
    return view();
  }
  if ((TempUrl === null || TempUrl === '') || (loginID === null || loginID === '')) {
    return res.json({ redirect: '~/Views/PageNotFound/Index.cshtml' });
  }
  DecryptEmp_id = await UtilityClass.Decryptword(TempUrl);
  if (loginID !== DecryptEmp_id) {
    ViewBag.Message = 'Invalid Employee Login Id';
    return view();
  }
  // Get Company Name and logo name from here
  await GetCompanyDetails(ViewBag);
  // (unused locals a1/b = Decryptword(<literals>) omitted: no side effects; literals not copied)

  // Get All details for perticular Employee from here (no Active filter)
  const EmployeeDetails = await findEmployee({ loginID });
  // PORT-NOTE: legacy read EmployeeDetails.Emp_ID BEFORE the null check => unknown login id = unhandled NullReferenceException (HTTP 500).
  if (EmployeeDetails === null) throw new Error('Object reference not set to an instance of an object.');
  const EmpId = EmployeeDetails.Emp_ID;
  if (EmployeeDetails !== null) {
    CheckEmpIP = await GetIP.GetLocalIP(req);
    if (EmpId > 0) {
      Responce = await empIpAddressChecked(1, EmployeeDetails.Emp_ID, s(CheckEmpIP).trim(), '');
      if (Responce === 'failed' || Responce === '') {
        ViewBag.Message = 'your IP address not match';
        return view();
      }
    }
    // If useraccount is already blocked;
    if (!EmployeeDetails.Active) {
      ViewBag.Message = 'It seems this account has been blocked. Please unblock your account by verifying your registered email with this account in-order to unblock your account!';
      return view();
    }
    if (sessionStore.get(S, 'FailCount') === undefined || sessionStore.get(S, 'FailCount') === null) {
      sessionStore.set(S, 'FailCount', 5);
    }
    if (toInt16(sessionStore.get(S, 'FailCount')) <= 0) {
      ViewBag.Message = 'Your account has been blocked. Please verify your registered email with this account in-order to unblock this account!';
      return view();
    }
    try {
      ViewBag.Password = password;
      ViewBag.LoginID = loginID;
      // If entered password is incorrect from user.
      const EncryptedPassword = await UtilityClass.Encryptword(password);
      // (unused local PASSWORD = Encryptword(<hard-coded literal>) omitted: no side effects; literal not copied)
      if (EmployeeDetails.Emp_Password !== EncryptedPassword) {
        ViewBag.Message = '';
        sessionStore.set(S, 'FailCount', toInt16(sessionStore.get(S, 'FailCount')) - 1);
        ViewBag.Message = 'Invalid Loginid or Password. You have' + sessionStore.get(S, 'FailCount') + ' Attempts Remaining for login.';
        let Status = 'Fail';
        if (toInt16(sessionStore.get(S, 'FailCount')) === 1) {
          // This function block the only when password is wrong.
          await BlockAccount(EmployeeDetails.Emp_LoginID);
          Status = 'Blocked';
        }
        // Save Login history of admin
        await SaveLoginHistory(EmployeeDetails.Emp_LoginID, EmployeeDetails.Emp_Password, Vcode, EmployeeDetails.Emp_Email,
          EmployeeDetails.Emp_Mobile, CheckEmpIP, Status);
        return view();
      }

      // Check Login Avaliable Timeing
      if (EmpId > 0) {
        Responce = await empIpAddressChecked(3, EmployeeDetails.Emp_ID, '', GetTime);
        if (Responce === 'failed') {
          ViewBag.Message = 'login for only your Login Avaliable Timeing';
          return view();
        }
      }
      // Authencation for google starts here
      const GAObj = await new Admin_Security_Key().Get_Security_Key(EmployeeDetails.Emp_ID);

      // If there is not any security apart from password the Go to dashboard from here
      if (GAObj === null || GAObj === undefined) {
        // Add All Employee details into session;  (Session["Admin_User"] = EmployeeDetails; LoginAs/IsStore stay unset)
        const { menu, apiMenu } = await AllowAccountToLogin(req, EmployeeDetails, Vcode, IpAddress);
        const token = establishAdminSession(req, res, EmployeeDetails, {});
        return res.json({ redirect: 'Dashboard/Index', token, Admin_User: publicAdminUser(EmployeeDetails), Admin_User_Menu: menu, API_Menu: apiMenu });
      }
      ViewBag.IsGoogleAuthenticated = '1';
      IsGoogleAuthenticated = '1';
      const Obj = new Admin_Security_Key();
      const ValidRandomNo = await Obj.Get_GA_Key(EmployeeDetails.Emp_ID);
      if (!(await new Admin_Security_Key().Check_GaKeyForEnableTime(EmployeeDetails.Emp_ID, ValidRandomNo, AuthenticationCode))) {
        if (AuthenticationCode !== '') {
          ViewBag.Message = 'Enter a valid GA Key Below!';
        }
        return view();
      }
      const { menu, apiMenu } = await AllowAccountToLogin(req, EmployeeDetails, Vcode, IpAddress);
      const token = establishAdminSession(req, res, EmployeeDetails, {});
      return res.json({ redirect: 'Dashboard/Index', token, Admin_User: publicAdminUser(EmployeeDetails), Admin_User_Menu: menu, API_Menu: apiMenu });
    } catch (Ex) {
      // legacy: catch (Exception Ex) { }  (swallowed)
    }
  } else {
    ViewBag.Message = 'Invalid Loginid or Password.';
    return view();
  }
  return view();
}));

// ---------------------------------------------------------------- ForgotPassword(AuthenticationCode = "", IsGoogleAuthenticated = "0", TempUrl = null)
// public (forgot password; legacy had no session check)
router.all(`/admin/${C}/ForgotPassword{/:id}`, asyncHandler(async (req, res) => {
  const AuthenticationCode = optStr(req, 'AuthenticationCode', '');
  let IsGoogleAuthenticated = optStr(req, 'IsGoogleAuthenticated', '0'); // eslint-disable-line no-unused-vars
  const TempUrl = optStr(req, 'TempUrl', null);
  const S = anonReq(req);
  const ViewBag = {};
  const view = (v = LOGIN_VIEW) => res.json({ view: v, ...ViewBag });

  let DecryptEmp_id = '';
  let DcryptCode = '';
  let Empcode = '';
  GetTime = nowHHmmss();
  // -----CHECK BLACKLICT IP ADDRESS
  IpAddress = await GetIP.GetLocalIP(req);
  Responce = await empIpAddressChecked(2, 0, s(IpAddress).trim(), '');
  if (Responce === 'failed') {
    return view(ADMIN_LOGIN_VIEW);
  }
  // try { ... } catch (Exception) { throw; }  => errors propagate (HTTP 500)
  if (TempUrl === null || TempUrl === '') {
    ViewBag.ForgotPassMessage = 'Invalid Login URl';
    return view();
  }
  DecryptEmp_id = await UtilityClass.Decryptword(TempUrl);
  const EmployeeDetails = await findEmployee({ empCode: DecryptEmp_id });
  if (EmployeeDetails !== null) {
    const EmpId = EmployeeDetails.Emp_ID;
    Empcode = EmployeeDetails.Emp_Code;
    CheckEmpIP = await GetIP.GetLocalIP(req);
    if (EmpId > 0) {
      // -------------CHECK USER ACCESS WHITELIST IP ADDRESS
      Responce = await empIpAddressChecked(1, EmployeeDetails.Emp_ID, s(CheckEmpIP).trim(), '');
      if (Responce === 'failed' || Responce === '') {
        ViewBag.Message = 'your IP address not match';
        return view();
      }
      // -------------CHECK LOGIN AVALIABLE TIMEING
      Responce = await empIpAddressChecked(3, EmployeeDetails.Emp_ID, '', GetTime);
      if (Responce === 'failed') {
        ViewBag.ForgotPassMessage = 'login for only your Login Avaliable Timeing';
        return view();
      }
      // ------------AUTHENCATION FOR GOOGLE STARTS HERE
      const GAObj = await new Admin_Security_Key().Get_Security_Key(EmployeeDetails.Emp_ID);
      if (GAObj !== null && GAObj !== undefined) {
        ViewBag.IsGoogleAuthenticated = '1';
        IsGoogleAuthenticated = '1';
        const Obj = new Admin_Security_Key();
        const ValidRandomNo = await Obj.Get_GA_Key(EmployeeDetails.Emp_ID);
        if (!(await new Admin_Security_Key().Check_GaKeyForEnableTime(EmployeeDetails.Emp_ID, ValidRandomNo, AuthenticationCode))) {
          if (AuthenticationCode !== '') {
            ViewBag.ForgotPassMessage = 'Enter a valid GA Key Below!';
          }
          return view();
        }
        if (EmpId > 0) {
          const msg = await regenerateAndSend(DecryptEmp_id, EmpId);
          if (msg !== null) { ViewBag.ForgotPassMessage = msg; return view(); }
        } else {
          ViewBag.ForgotPassMessage = 'Invalid Credential';
          return view();
        }
      } else if (EmpId > 0) {
        const msg = await regenerateAndSend(DecryptEmp_id, EmpId);
        if (msg !== null) { ViewBag.ForgotPassMessage = msg; return view(); }
      } else {
        ViewBag.ForgotPassMessage = 'Invalid Credential';
        return view();
      }
    } else {
      ViewBag.ForgotPassMessage = 'Invalid Credential';
      return view();
    }
  } else {
    ViewBag.ForgotPassMessage = 'Invalid Credential';
    return view();
  }
  sessionStore.set(S, 'FailCount', 5);
  DcryptCode = await UtilityClass.Encryptword(Empcode);
  ViewBag.SuccessMessage = 'Password Successfully Sent On Your Registered Mobile No & Email^' + s(DcryptCode);
  return view();
}));

// ---------------------------------------------------------------- public void GetCompanyDetails()  (public method => routable MVC action)
// public (read-only company name/logo; legacy returned an empty body - the values are returned here)
router.all(`/admin/${C}/GetCompanyDetails{/:id}`, asyncHandler(async (req, res) => {
  const ViewBag = {};
  await GetCompanyDetails(ViewBag);
  res.json(ViewBag);
}));

// ---------------------------------------------------------------- public void SaveLoginHistory(...)  (routable in legacy, anonymous!)
// auth (SECURITY PORT-NOTE: legacy exposed this helper anonymously; restricted to a logged-in admin)
router.all(`/admin/${C}/SaveLoginHistory{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await SaveLoginHistory(req.p._pLoginID, req.p._pPassword, req.p._pVerificationCode, req.p._pEmployeeEmail,
    req.p._pEmployeeMobile, req.p._pIPaddress, req.p._pStatus);
  res.send('');
}));

// ---------------------------------------------------------------- public void AllowAccountToLogin(string Vcode, string IpAddress)
// auth (legacy read Session["Admin_User"]; without a session it threw NullReferenceException)
router.all(`/admin/${C}/AllowAccountToLogin{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const emp = await findEmployee({ loginID: req.user.emp_loginid });
  // Employee_Master in Session (password is not in the token - re-read from tbl_employee_master; token values win otherwise)
  const EmployeeDetails = { ...(emp || {}), Emp_ID: req.user.emp_id, Emp_LoginID: req.user.emp_loginid, Emp_Email: req.user.emp_email, Emp_Mobile: req.user.emp_mobile };
  await AllowAccountToLogin(req, EmployeeDetails, req.p.Vcode, req.p.IpAddress);
  res.send('');
}));

// ---------------------------------------------------------------- public void BlockAccount(string _pLoginID)
// auth (SECURITY PORT-NOTE: legacy exposed this helper anonymously; restricted to a logged-in admin)
router.all(`/admin/${C}/BlockAccount{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await BlockAccount(req.p._pLoginID);
  res.send('');
}));

// ---------------------------------------------------------------- public void SaveUpdatePassword_History(int EmpId, string Password)
// auth (SECURITY PORT-NOTE: legacy exposed this helper anonymously; restricted to a logged-in admin)
router.all(`/admin/${C}/SaveUpdatePassword_History{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const EmpId = parseInt(req.p.EmpId, 10);
  if (Number.isNaN(EmpId)) {
    return res.status(500).json({ message: "The parameters dictionary contains a null entry for parameter 'EmpId' of non-nullable type 'System.Int32'" });
  }
  await SaveUpdatePassword_History(EmpId, req.p.Password);
  return res.send('');
}));

module.exports = router;
