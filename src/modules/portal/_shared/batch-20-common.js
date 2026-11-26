'use strict';
/**
 * Shared helpers for portal batch 20 (Android / SSO login controllers: CustomerPanel/All_RechargeService_from_mobile,
 * CustomerPanel/Link_ForAnroid, Login_as_Mobile, Login_as_yourchoice, Login_as_sso, Logout).
 * Not a router: lives in _shared/ so src/modules/portal.js does not mount it.
 * Exports: DB, NRE, FormatErr, ci(obj, name), mvcStr(req, name, def), mvcInt32(req, name), mvcInt64(req, name), mvcOptInt(req, name, def),
 *          toInt32(v), toInt64(v), toDecimalNum(v), qs(req, name), appStrict(key), content(res, value), redirectJson(res, url, token),
 *          loginSession(req, ObjLogin), customerByClid(Clid)
 */
const db = require('../../../db');
const config = require('../../../config');
const ps = require('./portal-session');
const { toDecimalStr } = require('./batch-10-common');

const DB = 'shopping';
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const FormatErr = () => new Error('Input string was not in a correct format.');

/** case-insensitive property read (JavaScriptSerializer / EF materialisation are case-insensitive) */
function ci(obj, name) {
  if (obj === null || obj === undefined) return undefined;
  const k = Object.keys(obj).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k === undefined ? undefined : obj[k];
}

/** raw MVC value: route data first, then form / query string (req.p) */
function raw(req, name) {
  const rp = req.params || {};
  const rk = Object.keys(rp).find((k) => k.toLowerCase() === String(name).toLowerCase());
  if (rk !== undefined && rp[rk] !== undefined) return rp[rk];
  return req.p ? req.p[name] : undefined;
}

/** MVC string parameter: absent => C# default value `def`; present but empty/white-space => null (ConvertEmptyStringToNull). */
function mvcStr(req, name, def = null) {
  let v = raw(req, name);
  if (v === undefined) return def;
  if (v === null) return null;
  if (Array.isArray(v)) v = v.join(',');
  const s = String(v);
  return s.trim() === '' ? null : s;
}

function bindErr(name, type) {
  const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type '${type}'.`);
  e.status = 500;
  return e;
}
/** non-nullable `int` action parameter: missing / not an Int32 => ArgumentException before the action runs (HTTP 500) */
function mvcInt32(req, name) {
  const s = mvcStr(req, name);
  if (s === null || !/^\s*[+-]?\d+\s*$/.test(s)) throw bindErr(name, 'System.Int32');
  const n = parseInt(s, 10);
  if (n > 2147483647 || n < -2147483648) throw bindErr(name, 'System.Int32');
  return n;
}
/** non-nullable `Int64` action parameter */
function mvcInt64(req, name) {
  const s = mvcStr(req, name);
  if (s === null || !/^\s*[+-]?\d+\s*$/.test(s)) throw bindErr(name, 'System.Int64');
  const n = Number(s.trim());
  if (!Number.isSafeInteger(n)) throw bindErr(name, 'System.Int64');
  return n;
}
/** optional `int x = def` parameter: absent / not convertible => def */
function mvcOptInt(req, name, def) {
  const s = mvcStr(req, name);
  if (s === null || !/^\s*[+-]?\d+\s*$/.test(s)) return def;
  const n = parseInt(s, 10);
  return n > 2147483647 || n < -2147483648 ? def : n;
}

/** Convert.ToInt32(object): null => 0, number => rounded, string => Int32.Parse */
function toInt32(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Math.round(v);
  const t = String(v).trim();
  if (!/^[+-]?\d+$/.test(t)) throw FormatErr();
  const n = parseInt(t, 10);
  if (n > 2147483647 || n < -2147483648) throw new Error('Value was either too large or too small for an Int32.');
  return n;
}
/** Convert.ToInt64(object) */
function toInt64(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Math.round(v);
  const t = String(v).trim();
  if (!/^[+-]?\d+$/.test(t)) throw FormatErr();
  return Number(t);
}
/** Convert.ToDecimal(string) as a JS number for comparisons: null => 0, invalid => FormatException */
function toDecimalNum(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  return Number(toDecimalStr(v));
}

/** Request.QueryString[name] (case-insensitive, null when absent) */
function qs(req, name) {
  const v = ci(req.query || {}, name);
  if (v === undefined || v === null) return null;
  return Array.isArray(v) ? v.join(',') : String(v);
}

/** ConfigurationManager.AppSettings["key"].ToString(): missing key => NullReferenceException */
function appStrict(key) {
  const v = config.app ? config.app[key] : undefined;
  if (v === undefined || v === null) throw NRE();
  return String(v);
}

/** non-ActionResult (string) action => ContentResult */
function content(res, value) {
  res.type('text/html');
  return res.send(value === null || value === undefined ? '' : String(value));
}

/** Redirect / RedirectToAction => { redirect } (+ token when the action logged the customer in) */
function redirectJson(res, url, token) {
  const body = { redirect: url };
  if (token) body.token = token;
  return res.json(body);
}

/** Session["Plid"] = ObjLogin  => token (SESSION.md 4) or Session["Plid"] = null. Returns the token or undefined. */
function loginSession(req, ObjLogin) {
  if (ObjLogin) return ps.issueCustomerToken(ObjLogin, req);
  ps.sessionRemove(req, 'Plid');
  return undefined;
}

/** Db._Customer_Login.Where(a => a.CLID == Clid).FirstOrDefault() (only PHONE / PASSWORD are read by the callers) */
async function customerByClid(Clid) {
  const row = await db.queryOne(DB, 'select clid, phone, password from tbl_customerlogin where clid = @Clid limit 1', { Clid });
  if (!row) return null;
  return { CLID: row.clid, PHONE: row.phone === undefined ? null : row.phone, PASSWORD: row.password === undefined ? null : row.password };
}

module.exports = {
  DB, NRE, FormatErr, ci, mvcStr, mvcInt32, mvcInt64, mvcOptInt, toInt32, toInt64, toDecimalNum, qs, appStrict, content, redirectJson,
  loginSession, customerByClid,
};
