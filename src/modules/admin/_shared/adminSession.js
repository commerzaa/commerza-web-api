'use strict';
/**
 * Shared admin-session helpers for the MLM_Adminpanel port (see SESSION.md in this folder).
 * Exports: ADMIN_USER_PROPS, ADMIN_MENU_PROPS, API_MENU_PROPS, adminTokenPayload(emp), issueAdminToken(emp, extra),
 *          adminAuth, AdminSessionExpire, isAdmin(req), getAdminUser(req), legacyUrl(req), loadAdminMenu(empId),
 *          getAdminMenu(req), parseCookies(req), anonReq(req), adminStoreReq(emp, req), abandonSession(req),
 *          errorInsert(req, err, procName), publicAdminUser(emp)
 * Not a router: lives in _shared/ so src/modules/admin.js does not mount it.
 */
const db = require('../../../db');
const { auth, requireType, signToken } = require('../../../middleware/auth');
const sessionStore = require('../../../utils/sessionStore');
const { mapRows } = require('../../../utils/shape');

const DB = 'affiliate';

/** Models/Employee_Master.cs properties (incl. NotMapped LoginAs / IsStore). */
const ADMIN_USER_PROPS = ['Emp_ID', 'Emp_Code', 'Emp_LoginID', 'Emp_Password', 'Emp_Name', 'Current_Balance', 'Emp_Email',
  'Emp_Mobile', 'Emp_PanNo', 'Emp_Image', 'TotalRoles', 'CreateDate', 'Emp_LastLogin', 'Active', 'isDelete', 'WHITELIST_IP',
  'LOGINAVALIABLE_FROMTIME', 'LOGINAVALIABLE_TOTIME', 'LOGINAVALIABLE_ALLWAYS', 'LoginAs', 'IsStore'];

/** Models/Admin_User_Menu.cs */
const ADMIN_MENU_PROPS = ['mid', 'mainMenuTitle', 'mainhref', 'aiClass', 'bClass', 'sid', 'subMenuTitle', 'subhref', 'isEdit',
  'HeaderClass', 'isDelete', 'Active', 'rid', 'MAINACTUALTITLE', 'SUBACTUALTITLE', 'MCID', 'CATGORYNAME'];

/** Controllers/AdminPanel/API_Reference.cs class API_Menu */
const API_MENU_PROPS = ['mid', 'mainMenuTitle', 'mainhref', 'aiClass', 'bClass', 'sid', 'subMenuTitle', 'subhref', 'isEdit',
  'HeaderClass', 'isDelete', 'Active', 'rid'];

/** Session["Admin_User"] (Employee_Master) -> JWT claims (lower-case keys). Emp_Password is deliberately excluded. */
function adminTokenPayload(emp) {
  const p = {};
  for (const k of ADMIN_USER_PROPS) {
    if (k === 'Emp_Password') continue;
    let v = emp ? emp[k] : undefined;
    if (v === undefined) v = null;
    p[k.toLowerCase()] = v instanceof Date ? v.toISOString() : v;
  }
  p.userType = 'admin';
  p.plid = p.emp_id; // sessionStore subject alias ONLY (not a member PLID) - see SESSION.md
  p.sub = p.emp_id === null || p.emp_id === undefined ? undefined : String(p.emp_id);
  if (p.sub === undefined) delete p.sub;
  return p;
}

function issueAdminToken(emp, extra = {}) {
  return signToken({ ...adminTokenPayload(emp), ...extra });
}

/** Replacement for `if (Session["Admin_User"] == null) ...` and the [AdminSessionExpire] filter. */
const adminAuth = [auth, requireType('admin')];
const AdminSessionExpire = adminAuth;

const isAdmin = (req) => !!(req.user && req.user.userType === 'admin');

/** (Employee_Master)Session["Admin_User"] rebuilt from the token (PascalCase, no password). */
function getAdminUser(req) {
  if (!isAdmin(req)) return null;
  const o = {};
  for (const k of ADMIN_USER_PROPS) {
    if (k === 'Emp_Password') continue;
    const v = req.user[k.toLowerCase()];
    o[k] = v === undefined ? null : v;
  }
  return o;
}

/** Employee_Master object for a JSON response (Emp_Password removed). */
function publicAdminUser(emp) {
  if (!emp) return null;
  const o = { ...emp };
  delete o.Emp_Password;
  return o;
}

/** "~" + Request.Url.AbsolutePath as the legacy app saw it (our '/admin' mount prefix removed). */
function legacyUrl(req) {
  const p = (req.originalUrl || req.url || '').split('?')[0];
  return '~' + (p.replace(/^\/admin(?=\/|$)/i, '') || '/');
}

/** Usp_PickAdminUserRights @EmpID  .Where(aum => aum.Active == 1).Distinct()  (Distinct on class refs = no-op). */
async function loadAdminMenu(empId) {
  const rows = mapRows(await db.proc(DB, 'Usp_PickAdminUserRights', { EmpID: empId }), ADMIN_MENU_PROPS);
  return rows.filter((a) => Number(a.Active) === 1);
}

/** Session["Admin_User_Menu"] (sessionStore, reloaded from the DB if the in-memory store lost it). */
async function getAdminMenu(req) {
  let menu = sessionStore.get(req, 'Admin_User_Menu');
  if (menu === undefined && isAdmin(req) && req.user.emp_id !== undefined && req.user.emp_id !== null) {
    menu = await loadAdminMenu(req.user.emp_id);
    sessionStore.set(req, 'Admin_User_Menu', menu);
  }
  return menu === undefined ? null : menu;
}

/** Minimal cookie parser (cookie-parser is not installed). */
function parseCookies(req) {
  const out = {};
  const h = req.headers && req.headers.cookie;
  if (!h) return out;
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    let v = part.slice(i + 1).trim();
    try { v = decodeURIComponent(v); } catch (_) { /* keep raw */ }
    if (!(k in out)) out[k] = v;
  }
  return out;
}

/** A request-like object without the JWT user => sessionStore subject of the pre-login (anonymous, per-IP) session. */
const anonReq = (req) => ({ ip: req.ip });

/** A request-like object for the admin who is being logged in now (sessionStore subject of the token about to be issued). */
const adminStoreReq = (emp, req) => ({ ip: req.ip, user: adminTokenPayload(emp) });

/** Session.Abandon(): clears every login-owned key for the admin subject and the anonymous (pre-login) subject. */
const SESSION_KEYS = ['Admin_User_Menu', 'API_Menu', 'vcode', 'countattent', 'loginid', 'Password', 'FailCount', 'SessionOTP',
  'GAKey', '2FACode', 'TYPE', 'DATE', 'FIMID', 'PrevURL', 'OrderStatus', 'OrderPaymentStatus', 'name', 'regno', 'RefNo', 'MySession',
  'adminMasterLeftMenu', 'Latitude', 'longitude'];
function abandonSession(req) {
  for (const r of [req, anonReq(req)]) for (const k of SESSION_KEYS) sessionStore.set(r, k, null);
}

/** Legacy "#region For ErrorInsert" block: DataUtility.ErrorInsert(code, ex.Message, PROCEDURENAME, line, Request.Url.AbsolutePath). */
async function errorInsert(req, err, procName) {
  try {
    const DataUtility = require('../../../lib/admin/DataUtility');
    const code = (err && typeof err.errno === 'number') ? err.errno : 0; // Win32Exception.ErrorCode equivalent (normally 0)
    const m = err && err.stack ? /:(\d+):\d+\)?\s*$/m.exec(err.stack.split('\n')[1] || '') : null;
    const line = m ? Number(m[1]) : 0;
    await new DataUtility().ErrorInsert(code, err ? err.message : '', procName, line, legacyUrl(req).slice(1));
  } catch (e) {
    console.error('[admin] ErrorInsert failed:', e.message);
  }
}

module.exports = {
  ADMIN_USER_PROPS, ADMIN_MENU_PROPS, API_MENU_PROPS, adminTokenPayload, issueAdminToken, adminAuth, AdminSessionExpire,
  isAdmin, getAdminUser, legacyUrl, loadAdminMenu, getAdminMenu, parseCookies, anonReq, adminStoreReq, abandonSession, errorInsert,
  publicAdminUser,
};
