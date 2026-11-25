'use strict';
/**
 * Helpers private to admin port batch08 (part C: Investment_History, Invoices, IWalletBulkUploader, Joining_Reward, keyword_add, Kyc_Request).
 * Not a router (lives in _shared/).
 * Exports: tdSet(req,k,v), tdPeek(req,k), tdGet(req,k) (TempData), ticks(), cvtLongObj(v), cellReq(row,k), cvtStrObj(v), qsGet(req,name)
 */
const sessionStore = require('../../../utils/sessionStore');

// PORT-NOTE: TempData values live in sessionStore key 'TempData' (per admin, same layout as batch04A_common); tdGet() removes the value
// like a TempData read (MVC kept it until the end of the request; reads in the same request see the same value through tdPeek()).
function tdSet(req, k, v) {
  const o = { ...(sessionStore.get(req, 'TempData') || {}) };
  if (v === null || v === undefined) delete o[k]; else o[k] = v;
  sessionStore.set(req, 'TempData', o);
}
function tdPeek(req, k) {
  const o = sessionStore.get(req, 'TempData') || {};
  return o[k] === undefined ? null : o[k];
}
function tdGet(req, k) {
  const v = tdPeek(req, k);
  if (v !== null) tdSet(req, k, null);
  return v;
}

/** DateTime.Now.Ticks.ToString() */
const ticks = () => (BigInt(Date.now()) * 10000n + 621355968000000000n).toString();

/** Convert.ToInt64(object): DBNull => InvalidCastException ; string => Int64.Parse ; double => banker's rounding */
function cvtLongObj(v) {
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  if (typeof v === 'number') { const f = Math.floor(v); const d = v - f; return d === 0.5 ? (f % 2 === 0 ? f : f + 1) : Math.round(v); }
  const t = String(v).trim();
  if (!/^[-+]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return parseInt(t, 10);
}
/** DataRow[col]: ArgumentException when the column does not exist */
function cellReq(row, k) {
  if (!row || !Object.prototype.hasOwnProperty.call(row, k)) throw new Error(`Column '${k}' does not belong to table .`);
  return row[k];
}
/** Convert.ToString(object) / DataRow value .ToString() (DBNull => "") */
const cvtStrObj = (v) => (v === null || v === undefined ? '' : String(v));

/** Request.QueryString[name] (case-insensitive key lookup; undefined when absent) */
function qsGet(req, name) {
  const q = req.query || {};
  const k = Object.keys(q).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k === undefined) return undefined;
  const v = q[k];
  return Array.isArray(v) ? v.join(',') : v;
}

module.exports = { tdSet, tdPeek, tdGet, ticks, cvtLongObj, cellReq, cvtStrObj, qsGet };
