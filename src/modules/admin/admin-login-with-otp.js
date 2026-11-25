'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\adminloginwithOTPController.cs (namespace Common.Controllers - URL unaffected)
// Database: affiliate (Db_Affiliate).
//
// OTP flow (Session -> sessionStore, pre-login keys are per client IP because there is no token yet):
//   countattent (attempts left, starts at 3), vcode (generated verification code), loginid, Password.
//   The verification code is NEVER returned and NEVER sent: the legacy action generated it, kept it in Session and
//   built (unused) "Access OTP : " / "Your verification code" strings but contained no SMS/mail call. Only
//   AppSettings["MasterCode"] (config.app.MasterCode) can satisfy VarifyOTP when the generated code is unknown.
const os = require('os');
const crypto = require('crypto');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Admin_Security_Key = require('../../lib/admin/Admin_Security_Key');
const {
  anonReq, abandonSession, errorInsert, loadAdminMenu, publicAdminUser,
} = require('./_shared/admin-session');
const {
  findEmployee, firstActiveBranch, branchType, saveEmployeeLastLogin, insertAdminLoginLog, establishAdminSession,
} = require('./_shared/admin-login-db');

const router = express.Router();
const DB = 'affiliate';
const C = 'adminloginwithOTP';
const ADMIN_LOGIN_VIEW = '~/Views/adminlogin/Index.cshtml';

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
const modelValid = (u) => u.loginID !== undefined && u.loginID !== null && String(u.loginID) !== ''
  && u.password !== undefined && u.password !== null && String(u.password) !== '';

/** Convert.ToInt16(object): null => 0 */
const toInt16 = (v) => (v === undefined || v === null || v === '' ? 0 : parseInt(v, 10));

/** C# NullReferenceException emulation for `Session["x"].ToString()` on a null value. */
function nre() { return new Error('Object reference not set to an instance of an object.'); }

/**
 * Dns.GetHostEntry(Dns.GetHostName()).AddressList[2] (the SERVER's 3rd address, not the client's) - legacy behaviour kept.
 * PORT-NOTE: the .NET AddressList order (IPv6 first, then IPv4) may differ from os.networkInterfaces() order.
 */
function hostIpAddress() {
  const addr = [];
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) for (const a of ifs[name] || []) if (!a.internal) addr.push(a.address);
  return addr.length > 2 ? String(addr[2]) : '';
}

/** GetLogoImage(): TBL_COMPANYMASTER where COMID == 1 -> logo[0].LOGO (throws when no row, like logo[0]). */
async function GetLogoImage() {
  const logo = await db.query(DB, 'select logo from tbl_companymaster where comid = 1', {});
  if (!logo.length) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.');
  return logo[0].logo;
}

// ---------------------------------------------------------------- Index() (GET)
// public
router.get([`/admin/${C}/Index{/:id}`, `/admin/${C}`], (req, res) => {
  res.json({ view: '~/Views/adminloginwithOTP/Index.cshtml' });
});

// ---------------------------------------------------------------- [HttpPost] Index(Admin_Users u, string Vcode, string AuthenticationCode, string IsGoogleAuthenticated)
// public (login: issues the JWT that replaces Session["Admin_User"])
router.post([`/admin/${C}/Index{/:id}`, `/admin/${C}`], asyncHandler(async (req, res) => {
  const u = bindAdminUsers(req);
  let Vcode = req.p.Vcode;
  let AuthenticationCode = req.p.AuthenticationCode;
  let IsGoogleAuthenticated = req.p.IsGoogleAuthenticated;
  const S = anonReq(req); // pre-login session (Session[...])
  const ViewBag = {};
  const view = () => res.json({ view: ADMIN_LOGIN_VIEW, ...ViewBag });
  const sessVcode = () => sessionStore.get(S, 'vcode');
  const ensureVcode = () => { if (sessVcode() === undefined || sessVcode() === null) sessionStore.set(S, 'vcode', ''); };
  const decAttempts = () => {
    sessionStore.set(S, 'countattent', toInt16(sessionStore.get(S, 'countattent')) - 1);
    ViewBag.Message = '' + sessionStore.get(S, 'countattent') + ' Attempts Remaining for login.';
  };

  const vvv = await findEmployee({ loginID: u.loginID, active: true });
  const IpAddress = hostIpAddress();

  if (sessionStore.get(S, 'countattent') === undefined || sessionStore.get(S, 'countattent') === null) {
    sessionStore.set(S, 'countattent', 3);
  }
  if (toInt16(sessionStore.get(S, 'countattent')) <= 0) {
    ViewBag.Message = 'Your Id Already Block Contect to Administrator!';
    return view();
  }

  // select Active from Tbl_Employee_Master with(nolock) where Emp_LoginID='...'  (SqlQuery<bool>.FirstOrDefault() => false when no row)
  const activeRow = await db.queryOne(DB, 'select active from tbl_employee_master where lower(emp_loginid) = lower(@id) limit 1', { id: u.loginID === undefined ? null : u.loginID });
  const active = activeRow ? !!activeRow.active : false;
  if (active === false) {
    ViewBag.Message = 'Your Id Already Block Contect to the Administrator!';
    return view();
  }
  if (toInt16(sessionStore.get(S, 'countattent')) === 1) {
    const psd = await UtilityClass.Encryptword(u.password);
    const vv = await findEmployee({ loginID: u.loginID, password: psd, active: true });
    if (vv === null) {
      if (toInt16(sessionStore.get(S, 'countattent')) === 1) {
        await db.exec(DB, 'update tbl_employee_master set active = false where lower(emp_loginid) = lower(@id)', { id: u.loginID });
        ensureVcode();
        await insertAdminLoginLog({
          EMPID: u.loginID, PASSWORDATTEMPT: await UtilityClass.Encryptword(u.password), OTP: String(sessVcode()),
          EMAIL: vvv.Emp_Email, MOBILE: vvv.Emp_Mobile, IPADDRESS: IpAddress, ISSUCCESS: 'Block',
        });
        ViewBag.Message = 'Your Id Already Block Contect to the Administrator!';
        sessionStore.set(S, 'countattent', null);
        return view();
      }
    }
  }

  try {
    ViewBag.logo = await GetLogoImage();
    let objs = { ActiveKey: 0 }; // new Admin_Security_Key() (non-null, ActiveKey = 0)
    let ActiveKey = 0;
    if (Vcode === undefined || Vcode === null) Vcode = '';
    if (Vcode !== null && Vcode !== '') {
      if (sessVcode() === undefined || sessVcode() === null) throw nre();
      if (String(sessVcode()) !== Vcode) {
        ViewBag.Message = 'Invalid Verification Code';
        return view();
      }
    }
    if (AuthenticationCode === undefined || AuthenticationCode === null) AuthenticationCode = '';
    if (IsGoogleAuthenticated === undefined || IsGoogleAuthenticated === null || IsGoogleAuthenticated === '') IsGoogleAuthenticated = '0';

    if (modelValid(u)) {
      const EncryptedPassword = await UtilityClass.Encryptword(u.password);
      const v = await findEmployee({ loginID: u.loginID, password: EncryptedPassword, active: true });
      // Authencation for google starts here
      if (v === null) throw nre(); // gaObj.Get_Security_Key(v.Emp_ID) with v == null
      const gaObj = await new Admin_Security_Key().Get_Security_Key(v.Emp_ID);
      if (gaObj === null || gaObj === undefined) {
        if (v !== null) {
          ViewBag.Password = u.password;
          ViewBag.LoginID = u.loginID;
          const row = await firstActiveBranch();
          if (row === null) throw nre();
          const brtid = row.brtid;
          if (brtid < 4) {
            const RowBranchType = await branchType(brtid);
            v.LoginAs = RowBranchType.BrType_Name;
            v.IsStore = RowBranchType.IsStore;
            v.Emp_LastLogin = await UtilityClass.GetCurrentDate();
            await saveEmployeeLastLogin(v);
            const _objList = await loadAdminMenu(v.Emp_ID);
            const token = establishAdminSession(req, res, v, { menu: _objList, cookie: 'Admin' });
            ensureVcode();
            await insertAdminLoginLog({
              EMPID: v.Emp_LoginID, PASSWORDATTEMPT: v.Emp_Password, OTP: String(sessVcode()), EMAIL: v.Emp_Email,
              MOBILE: v.Emp_Mobile, IPADDRESS: IpAddress, ISSUCCESS: 'Success',
            });
            sessionStore.set(S, 'vcode', null);
            sessionStore.set(S, 'countattent', null);
            return res.json({ redirect: 'Dashboard/Index', token, Admin_User: publicAdminUser(v), Admin_User_Menu: _objList });
          }
          // brtid >= 4: no else in legacy => falls through to the final View
        } else {
          ensureVcode();
          decAttempts();
          await insertAdminLoginLog({
            EMPID: u.loginID, PASSWORDATTEMPT: await UtilityClass.Encryptword(u.password), OTP: String(sessVcode()),
            EMAIL: v.Emp_Email, MOBILE: v.Emp_Mobile, IPADDRESS: IpAddress, ISSUCCESS: 'Faild',
          });
          return view();
        }
      } else if (v !== null) {
        ViewBag.Password = u.password;
        ViewBag.LoginID = u.loginID;
        const row = await firstActiveBranch();
        if (row !== null) {
          if (gaObj !== null && gaObj !== undefined) {
            ViewBag.IsGoogleAuthenticated = '1';
            IsGoogleAuthenticated = '1';
          } else {
            ViewBag.IsGoogleAuthenticated = '0';
            IsGoogleAuthenticated = '0';
          }
          if (IsGoogleAuthenticated !== '0') {
            objs = await new Admin_Security_Key().Get_Security_Key(v.Emp_ID);
          }
          if (objs !== null && objs !== undefined) {
            ActiveKey = objs.ActiveKey;
            if (Number(ActiveKey) === 2) {
              const obj_security = new Admin_Security_Key();
              objs = await obj_security.Get_Security_Key(v.Emp_ID);
              if (objs !== null && objs !== undefined) {
                const ValidRandomNo = await obj_security.Get_GA_Key(v.Emp_ID);
                if (!(await obj_security.Check_GaKeyForEnableTime(v.Emp_ID, ValidRandomNo, AuthenticationCode))) {
                  if (AuthenticationCode !== '') {
                    return view();
                  }
                } else {
                  const brtids = row.brtid;
                  const RowBranchType = await branchType(brtids);
                  v.LoginAs = RowBranchType.BrType_Name;
                  v.IsStore = RowBranchType.IsStore;
                  v.Emp_LastLogin = await UtilityClass.GetCurrentDate();
                  await saveEmployeeLastLogin(v);
                  const _objList = await loadAdminMenu(v.Emp_ID);
                  const token = establishAdminSession(req, res, v, { menu: _objList, cookie: 'Admin' });
                  sessionStore.set(S, 'countattent', null);
                  ensureVcode();
                  await insertAdminLoginLog({
                    EMPID: v.Emp_LoginID, PASSWORDATTEMPT: v.Emp_Password, OTP: String(sessVcode()), EMAIL: v.Emp_Email,
                    MOBILE: v.Emp_Mobile, IPADDRESS: IpAddress, ISSUCCESS: 'Success',
                  });
                  return res.json({ redirect: 'Dashboard/Index', token, Admin_User: publicAdminUser(v), Admin_User_Menu: _objList });
                }
              }
            }
          }
          const brtid = row.brtid;
          if (brtid < 4) {
            if (Vcode !== null && Vcode !== '') {
              if (sessVcode() === undefined || sessVcode() === null) throw nre();
              if (String(sessVcode()) === Vcode) {
                // Session["Admin_User"] = v  (this branch does NOT set LoginAs/IsStore, Emp_LastLogin or Admin_User_Menu)
                const token = establishAdminSession(req, res, v, {});
                await insertAdminLoginLog({
                  EMPID: v.Emp_LoginID, PASSWORDATTEMPT: v.Emp_Password, OTP: String(sessVcode()), EMAIL: v.Emp_Email,
                  MOBILE: v.Emp_Mobile, IPADDRESS: IpAddress, ISSUCCESS: 'Success',
                });
                sessionStore.set(S, 'countattent', null);
                return res.json({ redirect: 'Dashboard/Index', token, Admin_User: publicAdminUser(v) });
              }
            }
            const RowBranchType = await branchType(brtid);
            v.LoginAs = RowBranchType.BrType_Name;
            v.IsStore = RowBranchType.IsStore;
            v.Emp_LastLogin = await UtilityClass.GetCurrentDate();
            await saveEmployeeLastLogin(v);
            // _objList loaded but not stored in Session by the legacy code
            await loadAdminMenu(v.Emp_ID);
            // dynamic otp for login  (Message "Access OTP : " / subject "Your verification code" were never used / sent)
            const vcode = String(crypto.randomInt(10000, 999999)); // new Random().Next(10000, 999999)
            sessionStore.set(S, 'vcode', vcode);
            sessionStore.set(S, 'loginid', v.Emp_LoginID);
            sessionStore.set(S, 'Password', u.password);
            // falls through to the final View (OTP entry screen)
          } else {
            ensureVcode();
            decAttempts();
            await insertAdminLoginLog({
              EMPID: u.loginID, PASSWORDATTEMPT: await UtilityClass.Encryptword(u.password), OTP: String(sessVcode()),
              EMAIL: v.Emp_Email, MOBILE: v.Emp_Mobile, IPADDRESS: IpAddress, ISSUCCESS: 'Faild',
            });
            return view();
          }
        } else {
          ensureVcode();
          decAttempts();
          await insertAdminLoginLog({
            EMPID: u.loginID, PASSWORDATTEMPT: await UtilityClass.Encryptword(u.password), OTP: String(sessVcode()),
            EMAIL: v.Emp_Email, MOBILE: v.Emp_Mobile, IPADDRESS: IpAddress, ISSUCCESS: 'Faild',
          });
          return view();
        }
      } else {
        ensureVcode();
        decAttempts();
        await insertAdminLoginLog({
          EMPID: u.loginID, PASSWORDATTEMPT: await UtilityClass.Encryptword(u.password), OTP: String(sessVcode()),
          EMAIL: v.Emp_Email, MOBILE: v.Emp_Mobile, IPADDRESS: IpAddress, ISSUCCESS: 'Faild',
        });
        return view();
      }
    } else {
      ensureVcode();
      decAttempts();
      if (vvv === null) throw nre(); // vvv.Emp_Email inside the try => goes to the catch below (which throws again)
      await insertAdminLoginLog({
        EMPID: u.loginID, PASSWORDATTEMPT: await UtilityClass.Encryptword(u.password), OTP: String(sessVcode()),
        EMAIL: vvv.Emp_Email, MOBILE: vvv.Emp_Mobile, IPADDRESS: IpAddress, ISSUCCESS: 'Faild',
      });
      return view();
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Index');
    ensureVcode();
    decAttempts();
    // vvv == null here throws (outside any try) => HTTP 500 like the legacy unhandled NullReferenceException
    if (vvv === null) throw nre();
    await insertAdminLoginLog({
      EMPID: u.loginID, PASSWORDATTEMPT: await UtilityClass.Encryptword(u.password), OTP: String(sessVcode()),
      EMAIL: vvv.Emp_Email, MOBILE: vvv.Emp_Mobile, IPADDRESS: IpAddress, ISSUCCESS: 'Faild',
    });
    return view();
  }
  return view();
}));

// ---------------------------------------------------------------- [HttpPost] StoreIndex(Admin_Users u)
// public (login: issues the JWT)
router.post(`/admin/${C}/StoreIndex{/:id}`, asyncHandler(async (req, res) => {
  const u = bindAdminUsers(req);
  const fail = () => res.json({ redirect: 'Home/Index', TempData: { Error: 'Invalid User ID Or Password', AdminUsers: u } });
  try {
    if (modelValid(u)) {
      const EncryptedPassword = await UtilityClass.Encryptword(u.password);
      const v = await findEmployee({ loginID: u.loginID, password: EncryptedPassword, active: true });
      if (v !== null) {
        const row = await firstActiveBranch();
        if (row !== null) {
          const RowBranchType = await branchType(row.brtid);
          v.LoginAs = RowBranchType.BrType_Name;
          v.IsStore = RowBranchType.IsStore;
          v.Emp_LastLogin = await UtilityClass.GetCurrentDate();
          await saveEmployeeLastLogin(v);
          // Session["Admin_User"] = v;  menu list loaded but Session["Admin_User_Menu"] / cookie are commented out in the legacy code
          await loadAdminMenu(v.Emp_ID);
          const token = establishAdminSession(req, res, v, {});
          return res.json({ redirect: 'AdminPanel/Dashboard/Index', token, Admin_User: publicAdminUser(v) });
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
// public
// route-config: "SecureAdminLoginLogoutWithOTP/logout" -> adminloginwithOTP/Logout
router.all([`/admin/${C}/Logout{/:id}`, '/admin/SecureAdminLoginLogoutWithOTP/logout'], optionalAuth, (req, res) => {
  // Session["Admin_User"] = null => client drops the token
  // PORT-NOTE: legacy cleared only Admin_User (no Abandon); the token is the session, other keys are cleared too.
  abandonSession(req);
  res.json({ status: 'true', view: ADMIN_LOGIN_VIEW });
});

// ---------------------------------------------------------------- VarifyOTP() (GET)
// public
router.get(`/admin/${C}/VarifyOTP{/:id}`, (req, res) => {
  res.json({ view: '~/Views/adminloginwithOTP/Index.cshtml', Title: 'One Time Password' });
});

// ---------------------------------------------------------------- [HttpPost] VarifyOTP(Admin_Users u)
// public (OTP verification: issues the JWT on success)
router.post(`/admin/${C}/VarifyOTP{/:id}`, asyncHandler(async (req, res) => {
  const u = bindAdminUsers(req);
  const S = anonReq(req);
  const fail = (msg, withModel = true) => res.json({ view: 'AdminLoginWithOTP', Message: msg, ...(withModel ? { Model: u } : {}) });
  try {
    if (modelValid(u)) {
      const EncryptedPassword = await UtilityClass.Encryptword(u.password);
      const v = await findEmployee({ loginID: u.loginID, password: EncryptedPassword, active: true });
      if (v !== null) {
        const row = await firstActiveBranch();
        if (row !== null) {
          const brtid = row.brtid;
          if (brtid < 4) {
            const RowBranchType = await branchType(brtid);
            v.LoginAs = RowBranchType.BrType_Name;
            v.IsStore = RowBranchType.IsStore;
            v.Emp_LastLogin = await UtilityClass.GetCurrentDate();
            await saveEmployeeLastLogin(v);
            const _objList = await loadAdminMenu(v.Emp_ID);
            res.cookie('User', 'Admin', { expires: new Date(Date.now() + 60 * 60 * 1000) });
            // SECURITY PORT-NOTE: legacy set Session["Admin_User"] / Session["Admin_User_Menu"] HERE, i.e. BEFORE the
            // verification code was checked (a wrong/empty code still left the user logged in). The token is issued only
            // after the code check below succeeds.
            if (u.Vcode === undefined || u.Vcode === null) u.Vcode = '';
            if (u.Vcode === '') {
              return fail('Enter verification code. ', false);
            }
            if ((config.app.MasterCode || '') === u.Vcode) {
              sessionStore.set(S, 'vcode', u.Vcode);
            }
            const sv = sessionStore.get(S, 'vcode');
            if (sv === undefined || sv === null) throw nre();
            if (String(sv) !== u.Vcode) {
              return fail('Invalid verification code', false);
            }
            sessionStore.set(S, 'loginid', null);
            sessionStore.set(S, 'Password', null);
            const token = establishAdminSession(req, res, v, { menu: _objList });
            return res.json({ redirect: 'AdminPanel/Dashboard/Index', token, Admin_User: publicAdminUser(v), Admin_User_Menu: _objList });
          }
          return fail('Invalid User ID Or Password');
        }
        return fail('Invalid User ID Or Password');
      }
      return fail('Invalid User ID Or Password');
    }
    return fail('Invalid User ID Or Password');
  } catch (e) {
    return fail('Invalid User ID Or Password');
  }
}));

// ---------------------------------------------------------------- public string GetLogoImage()  (public method => routable MVC action)
// public
router.all(`/admin/${C}/GetLogoImage{/:id}`, asyncHandler(async (req, res) => {
  const logoImage = await GetLogoImage();
  res.type('text/html').send(logoImage === null || logoImage === undefined ? '' : String(logoImage));
}));

module.exports = router;
