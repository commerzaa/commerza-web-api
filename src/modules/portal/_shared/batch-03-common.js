'use strict';
/**
 * Helpers shared by the batch-03 portal controller ports (ClusterofferShopingPortal Controllers/CustomerPanel).
 * Not a router (lives in _shared/).
 * Exports: DB, VIEW, csErr(name, message), nullRef(), mvcStr(req, name), mvcIntN(req, name), mvcInt(req, name),
 *          mvcBool(req, name), toInt32(v), toInt64(v), toDecimal(v), toStr(v), mapPath(virtualPath),
 *          multiResult(fn, params), outOf(rows, name), csNowLong(), redirect(res, url, extra)
 */
const path = require('path');
const config = require('../../../config');
const db = require('../../../db');

const DB = 'shopping';

/** Error with a .NET exception type name (keeps the legacy message text). */
function csErr(name, message) {
  const e = new Error(message);
  e.name = name;
  return e;
}
const nullRef = () => { throw csErr('NullReferenceException', 'Object reference not set to an instance of an object.'); };

/** MVC binding of a `string` action parameter (route value, then form/query via req.p): missing => null. */
function mvcStr(req, name) {
  const rp = req.params || {};
  const rk = Object.keys(rp).find((k) => k.toLowerCase() === String(name).toLowerCase());
  const v = rk !== undefined && rp[rk] !== undefined ? rp[rk] : req.p[name];
  if (v === undefined || v === null) return null;
  return Array.isArray(v) ? v.join(',') : String(v);
}

const INT_RE = /^\s*[+-]?\d+\s*$/;
/** MVC binding of `int?`: missing / empty / not an int => null. */
function mvcIntN(req, name) {
  const v = mvcStr(req, name);
  if (v === null || !INT_RE.test(v)) return null;
  const n = parseInt(v, 10);
  return Number.isSafeInteger(n) ? n : null;
}
/** MVC binding of a non-nullable `int` / `Int64`: missing or invalid => ArgumentException (legacy HTTP 500 before the action ran). */
function mvcInt(req, name) {
  const n = mvcIntN(req, name);
  if (n === null) {
    throw csErr('ArgumentException', `The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Int32'.`);
  }
  return n;
}
/** MVC binding of a non-nullable `bool` ("true"/"false", checkbox "true,false" => true). */
function mvcBool(req, name) {
  const raw = req.p[name];
  const v = Array.isArray(raw) ? String(raw[0]) : (raw === undefined || raw === null ? null : String(raw).split(',')[0]);
  if (v !== null && /^\s*true\s*$/i.test(v)) return true;
  if (v !== null && /^\s*false\s*$/i.test(v)) return false;
  if (raw === true) return true;
  if (raw === false) return false;
  throw csErr('ArgumentException', `The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Boolean'.`);
}

/** Convert.ToInt32(object): null => 0, numbers rounded half-to-even, invalid strings => FormatException. */
function toInt32(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') {
    const f = Math.floor(v); const d = v - f;
    if (d > 0.5 || (d === 0.5 && f % 2 !== 0)) return f + 1;
    return f;
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  const s = String(v);
  if (!INT_RE.test(s)) throw csErr('FormatException', 'Input string was not in a correct format.');
  return parseInt(s, 10);
}
const toInt64 = toInt32;
/** Convert.ToDecimal(string): null => 0, invalid => FormatException. */
function toDecimal(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/,/g, '');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) throw csErr('FormatException', 'Input string was not in a correct format.');
  return Number(s);
}
/** Convert.ToString(object): null => "" */
const toStr = (v) => (v === null || v === undefined ? '' : String(v));

/** Server.MapPath("~/X") / ("/X") / ("../X") => <config.uploadDir>/X */
function mapPath(virtualPath) {
  const rel = String(virtualPath || '').replace(/\\/g, '/').replace(/^~?\/*/, '').replace(/^(\.\.?\/)+/, '');
  return path.join(config.uploadDir, rel);
}

/**
 * EF ObjectContext.Translate over a multi-result-set proc (reader.NextResult()).
 * PORT-NOTE: PostgreSQL functions return ONE result set. The function is executed directly and, when the driver returns several
 * results (multi-statement), every set is kept; otherwise the single set is returned as table 0. Adapt if the migrated function
 * exposes the sets differently (e.g. refcursors).
 */
async function multiResult(fn, params) {
  const keys = Object.keys(params);
  const args = keys.map((k, i) => `"${k.toLowerCase()}" => $${i + 1}`).join(', ');
  const r = await db.getPool(DB).query(`select * from ${fn.toLowerCase()}(${args})`, keys.map((k) => (params[k] === undefined ? null : params[k])));
  if (Array.isArray(r)) return r.map((x) => x.rows);
  return [r.rows];
}

/** Value of an OUTPUT parameter (column of the first result row, case-insensitive). undefined when absent. */
function outOf(rows, name) {
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? undefined : row[k];
}

/** DateTime.Now.ToString("dddd MMMM dd yyyy hh:mm tt") */
function csNowLong(d = new Date()) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const z = (n) => String(n).padStart(2, '0');
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${z(d.getDate())} ${d.getFullYear()} ${z(h12)}:${z(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** RedirectToAction / Redirect => 200 JSON { redirect } (MVC guide 1). */
function redirect(res, url, extra) {
  return res.json({ redirect: url, ...(extra || {}) });
}

module.exports = {
  DB, csErr, nullRef, mvcStr, mvcIntN, mvcInt, mvcBool, toInt32, toInt64, toDecimal, toStr, mapPath, multiResult, outOf, csNowLong, redirect,
};
