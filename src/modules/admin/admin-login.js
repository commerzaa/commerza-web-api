'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\adminloginController.cs (class AdminLoginController + filter AdminSessionExpire)
// Database: affiliate (Db_Affiliate). URL controller name: "AdminLogin" (MVC routing is case-insensitive, so /admin/adminlogin/... works too).
const express = require('express');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Admin_Security_Key = require('../../lib/admin/Admin_Security_Key');
const {
  isAdmin, anonReq, abandonSession, errorInsert, loadAdminMenu, publicAdminUser, AdminSessionExpire,
} = require('./_shared/admin-session');
const {
  findEmployee, firstActiveBranch, branchType, saveEmployeeLastLogin, establishAdminSession,
} = require('./_shared/admin-login-db');

const router = express.Router();
const DB = 'affiliate';
const C = 'AdminLogin';

/** Admin_Users model bound from the form (Models/Admin_Users - Copy.cs). */
function bindAdminUsers(req) {
  const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const pick = (k) => { const f = Object.keys(b).find((x) => x.toLowerCase() === k.toLowerCase()); return f === undefined ? req.p[k] : b[f]; };
  return {
    uid: pick('uid'), brid: pick('brid'), userName: pick('userName'), loginID: pick('loginID'), password: pick('password'),
    Tpassword: pick('Tpassword'), role: pick('role'), roleName: pick('roleName'), Vcode: pick('Vcode'),
    Emp_Email: pick('Emp_Email'), Emp_Mobile: pick('Emp_Mobile'),
  };
}
/** ModelState.IsValid: [Required] loginID and password (MVC binds "" as null => invalid). */
const modelValid = (u) => u.loginID !== undefined && u.loginID !== null && String(u.loginID) !== ''
  && u.password !== undefined && u.password !== null && String(u.password) !== '';

// ---------------------------------------------------------------- [HttpGet] Index()
// public
// route-config: "secure-admin-login-dhiDTo5ScKAHxD9kgDRERA" -> adminlogin/Index
router.get([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/secure-admin-login-dhiDTo5ScKAHxD9kgDRERA'], (req, res) => {
  res.json({ view: '~/Views/adminlogin/Index.cshtml', Title: 'Admin Login' });
});

// ---------------------------------------------------------------- [HttpPost] Index(Admin_Users u, string Vcode, string AuthenticationCode, string IsGoogleAuthenticated)
// public (login: issues the JWT that replaces Session["Admin_User"])
// route-config: "secure-admin-login-dhiDTo5ScKAHxD9kgDRERA" -> adminlogin/Index
router.post([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/secure-admin-login-dhiDTo5ScKAHxD9kgDRERA'], asyncHandler(async (req, res) => {
  const u = bindAdminUsers(req);
  let Vcode = req.p.Vcode;
  let AuthenticationCode = req.p.AuthenticationCode;
  let IsGoogleAuthenticated = req.p.IsGoogleAuthenticated;
  const ViewBag = {};
  const view = (extra = {}) => res.json({ view: '~/Views/adminlogin/Index.cshtml', Model: u, ...ViewBag, ...extra });
  try {
    if (Vcode === undefined || Vcode === null) Vcode = '';
    if (AuthenticationCode === undefined || AuthenticationCode === null) AuthenticationCode = '';
    if (IsGoogleAuthenticated === undefined || IsGoogleAuthenticated === null || IsGoogleAuthenticated === '') IsGoogleAuthenticated = '0';

    if (modelValid(u)) {
      const EncryptedPassword = await UtilityClass.Encryptword(u.password);
      const v = await findEmployee({ loginID: u.loginID, password: EncryptedPassword, active: true });
      if (v !== null) {
        ViewBag.Password = u.password;
        ViewBag.LoginID = u.loginID;
        const row = await firstActiveBranch();
        if (row !== null) {
          // Authencation for google starts here
          const gaObj = await new Admin_Security_Key().Get_Security_Key(v.Emp_ID);
          if (gaObj !== null && gaObj !== undefined) {
            ViewBag.IsGoogleAuthenticated = '1';
            IsGoogleAuthenticated = '1';
          } else {
            ViewBag.IsGoogleAuthenticated = '0';
            IsGoogleAuthenticated = '0';
          }
          if (IsGoogleAuthenticated !== '0') {
            const objs = await new Admin_Security_Key().Get_Security_Key(v.Emp_ID);
            if (objs !== null && objs !== undefined) {
              const ValidRandomNo = await new Admin_Security_Key().Get_GA_Key(v.Emp_ID);
              // PORT-NOTE: legacy passes IsGoogleAuthenticated ("1") as the 2FA code (AuthenticationCode is ignored) - kept as is.
              if (!(await new Admin_Security_Key().Check_GaKeyForEnableTime(v.Emp_ID, ValidRandomNo, IsGoogleAuthenticated))) {
                if (IsGoogleAuthenticated !== '') {
                  return res.json('Error^Invalid GA Key. Please enter a valid GA Key.');
                }
              }
            }
          }
          const brtid = row.brtid;
          if (brtid < 4) {
            const RowBranchType = await branchType(brtid);
            v.LoginAs = RowBranchType.BrType_Name; // null RowBranchType => TypeError => catch (legacy NullReferenceException)
            v.IsStore = RowBranchType.IsStore;
            v.Emp_LastLogin = await UtilityClass.GetCurrentDate();
            await saveEmployeeLastLogin(v);
            // Session["Admin_User"] = v; Session["Admin_User_Menu"] = Usp_PickAdminUserRights (Active == 1).Distinct()
            const _objList = await loadAdminMenu(v.Emp_ID);
            const token = establishAdminSession(req, res, v, { menu: _objList, cookie: 'Admin' });
            sessionStore.set(anonReq(req), 'vcode', null); // Session["vcode"] = null
            return res.json({
              redirect: 'adminloginwithOTP/Index', token, Admin_User: publicAdminUser(v), Admin_User_Menu: _objList,
            });
          }
          ViewBag.Message = 'Invalid User ID Or Password';
          return view();
        }
        ViewBag.Message = 'Invalid User ID Or Password';
        return view();
      }
      ViewBag.Message = 'Invalid User ID Or Password';
      return view();
    }
    ViewBag.Message = 'Invalid User ID Or Password';
    return view();
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Index');
    return view();
  }
}));

// ---------------------------------------------------------------- [HttpPost] StoreIndex(Admin_Users u)
// public (login: issues the JWT)
router.post(`/admin/${C}/StoreIndex{/:id}`, asyncHandler(async (req, res) => {
  const u = bindAdminUsers(req);
  const fail = () => res.json({ redirect: 'Home/Index', TempData: { Error: 'Invalid User ID Or Password', AdminUsers: u } });
  try {
    if (modelValid(u)) {
      // PORT-NOTE / SECURITY: legacy matches ONLY on Emp_Password == the RAW (not encrypted) password and ignores loginID - kept as is.
      const v = await findEmployee({ password: u.password, active: true });
      if (v !== null) {
        const row = await firstActiveBranch();
        if (row !== null) {
          const RowBranchType = await branchType(row.brtid);
          v.LoginAs = RowBranchType.BrType_Name;
          v.IsStore = RowBranchType.IsStore;
          v.Emp_LastLogin = await UtilityClass.GetCurrentDate();
          await saveEmployeeLastLogin(v);
          // Usp_PickAdminUserRights .Where(Active == 1).ToList() (no Distinct here - no-op anyway)
          const _objList = await loadAdminMenu(v.Emp_ID);
          const token = establishAdminSession(req, res, v, { menu: _objList, cookie: 'Store' });
          return res.json({ redirect: 'AdminPanel/Dashboard/Index', token, Admin_User: publicAdminUser(v), Admin_User_Menu: _objList });
        }
        return fail();
      }
      return fail();
    }
    return fail();
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'StoreIndex');
    return fail();
  }
}));

// ---------------------------------------------------------------- Logout()
// public (legacy had no session check; uses the admin token when present)
// route-config: "secure-admin-login-dhiDTo5ScKAHxD9kgDRERA/logout" -> adminlogin/Logout
router.all([`/admin/${C}/Logout{/:id}`, '/admin/secure-admin-login-dhiDTo5ScKAHxD9kgDRERA/logout'], optionalAuth, asyncHandler(async (req, res) => {
  let DcryptCode = '';
  if (isAdmin(req)) {
    const EmpCode = req.user.emp_code;
    DcryptCode = await UtilityClass.Encryptword(EmpCode);
    // update ADMINLOGINLOG set LOGINOUTDATETIME=DATEDIFF(MINUTE,LOGINDATETIME,dbo.FUN_GETCURRENTDATE()) where ALLOGID=(select max(ALLOGID) ... EMPID=<Emp_LoginID>)
    await db.exec(DB, "update adminloginlog set loginoutdatetime = ((extract(epoch from (date_trunc('minute', fun_getcurrentdate()) - date_trunc('minute', logindatetime))) / 60)::bigint)::text "
      + 'where allogid = (select max(allogid) from adminloginlog where empid = @empid)', { empid: req.user.emp_loginid });
  }
  // Session["Admin_User"] = null; Session["vcode"] = null; Session.Abandon();  => the client drops the token
  abandonSession(req);
  res.json({ status: 'true', redirect: `Login/Index?tempurl=${encodeURIComponent(DcryptCode === null || DcryptCode === undefined ? '' : DcryptCode)}` });
}));

module.exports = router;
// The legacy ActionFilterAttribute AdminSessionExpire (redirect "~/Home" when Session["Admin_User"] is null) is the adminAuth middleware.
module.exports.AdminSessionExpire = AdminSessionExpire;
