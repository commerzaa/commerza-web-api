'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Beta_LoginController.cs (no namespace => URL /Beta_Login/...)
// Database: affiliate (Db_Affiliate). The RouteConfig entry "secure-admin-login-random-url" for this controller is commented out.
const express = require('express');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const {
  abandonSession, errorInsert, loadAdminMenu, publicAdminUser, parseCookies,
} = require('./_shared/adminSession');
const {
  findEmployee, firstActiveBranch, branchType, saveEmployeeLastLogin, establishAdminSession,
} = require('./_shared/adminLoginDb');

const router = express.Router();
const C = 'Beta_Login';
const BETA_VIEW = '~/Views/AdminPanel/Beta_Login/Index.cshtml';

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

// ---------------------------------------------------------------- Index() (GET)
// public
router.get([`/admin/${C}/Index{/:id}`, `/admin/${C}`], (req, res) => {
  const referrer = req.get('referer') || req.get('referrer');
  if (referrer) {
    const cookies = parseCookies(req);
    if (cookies.User !== undefined) {
      if (String(cookies.User) !== '' && String(cookies.User) === 'Store') {
        return res.json({ redirect: 'Beta_Login/StoreIndex' });
      }
      return res.json({ view: BETA_VIEW });
    }
  } else {
    return res.json({ view: BETA_VIEW, Title: 'Beta Login' });
  }
  return res.json({ view: BETA_VIEW, Title: 'Beta Login' });
});

// ---------------------------------------------------------------- [HttpPost] Index(Admin_Users u)
// public (login: issues the JWT)
router.post([`/admin/${C}/Index{/:id}`, `/admin/${C}`], asyncHandler(async (req, res) => {
  const u = bindAdminUsers(req);
  const view = (name, withModel) => res.json({ view: name, Message: 'Invalid User ID Or Password', ...(withModel ? { Model: u } : {}) });
  try {
    if (modelValid(u)) {
      u.password = await UtilityClass.Encryptword(u.password); // the echoed Model carries the encrypted password, like the legacy view
      const v = await findEmployee({ loginID: u.loginID, password: u.password, active: true });
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
            const token = establishAdminSession(req, res, v, { menu: _objList, cookie: 'Admin' });
            return res.json({ redirect: 'Dashboard/Index', token, Admin_User: publicAdminUser(v), Admin_User_Menu: _objList });
          }
          return view('Index', true);
        }
        return view('Index', true);
      }
      return view(BETA_VIEW, false);
    }
    return view('Index', true);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Index');
    return view('Index', true);
  }
}));

// ---------------------------------------------------------------- [HttpPost] StoreIndex(Admin_Users u)
// public (login: issues the JWT)
router.post(`/admin/${C}/StoreIndex{/:id}`, asyncHandler(async (req, res) => {
  const u = bindAdminUsers(req);
  const fail = () => res.json({ redirect: 'Home/Index', TempData: { Error: 'Invalid User ID Or Password', AdminUsers: u } });
  try {
    if (modelValid(u)) {
      u.password = await UtilityClass.Encryptword(u.password);
      // PORT-NOTE / SECURITY: legacy matches on the (encrypted) password ONLY, loginID is ignored - kept as is.
      const v = await findEmployee({ password: u.password, active: true });
      if (v !== null) {
        const row = await firstActiveBranch();
        if (row !== null) {
          const RowBranchType = await branchType(row.brtid);
          v.LoginAs = RowBranchType.BrType_Name;
          v.IsStore = RowBranchType.IsStore;
          v.Emp_LastLogin = await UtilityClass.GetCurrentDate();
          await saveEmployeeLastLogin(v);
          const _objList = await loadAdminMenu(v.Emp_ID); // .ToList() without Distinct (no-op difference)
          const token = establishAdminSession(req, res, v, { menu: _objList, cookie: 'Store' });
          return res.json({ redirect: 'Dashboard/Index', token, Admin_User: publicAdminUser(v), Admin_User_Menu: _objList });
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
router.all(`/admin/${C}/Logout{/:id}`, optionalAuth, (req, res) => {
  // Session["Admin_User"] = null; Session["vcode"] = null; Session.Abandon();  => client drops the token
  abandonSession(req);
  res.json({ status: 'true', view: '~/Views/adminlogin/Index.cshtml' });
});

module.exports = router;
