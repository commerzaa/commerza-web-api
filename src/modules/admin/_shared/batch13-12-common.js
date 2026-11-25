'use strict';
/**
 * Helpers private to admin port batch13-12 (not a router; lives in _shared/ so src/modules/admin.js does not mount it).
 * Re-exports everything of ./batch11-common plus:
 *   dynPaging(), cvtDecObj(v), cvtIntBanker(dec), decOutOf(rows, name), decOutStrict(rows, name), intOutStrict(rows, name),
 *   cvtDateTime(s), dtIdx(row, i), tdPeek(req, k), tdSet(req, k, v), tdGet(req, k), upload(), reqFile(req, name), ticks(), serverIp(),
 *   safeMapPath(x)
 */
const path = require('path');
const config = require('../../../config');
const sessionStore = require('../../../utils/sessionStore');
const B = require('./batch11-common');
const { upload, reqFile, ticks, serverIp } = require('./batch04-b-common');

const FORMAT = () => new Error('Input string was not in a correct format.');

/** Convert.ToInt16(ConfigurationManager.AppSettings["DynamicPagging"]) (missing key => null => 0) */
function dynPaging() {
  const v = config.app.DynamicPagging;
  return v === undefined || v === null || v === '' ? 0 : B.cvtInt(v);
}

/** Convert.ToDecimal(object): DBNull => InvalidCastException */
function cvtDecObj(v) {
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  const n = Number(v);
  if (Number.isNaN(n)) throw FORMAT();
  return n;
}

/** Convert.ToInt32(decimal): banker's rounding (MidpointRounding.ToEven) */
function cvtIntBanker(d) {
  const x = Number(d);
  const f = Math.floor(x);
  const diff = x - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/** Convert.ToDecimal(p.Value.ToString() == "" ? "0" : p.Value.ToString()) on an OUT param returned as a result column.
 *  PORT-NOTE: with no rows PG cannot return the OUT value => 0. */
function decOutOf(rows, name) {
  const s = B.outOf(rows, name);
  if (s === '') return 0;
  return B.cvtDec(s);
}
/** decimal.Parse / Convert.ToDecimal(p.Value.ToString()) (DBNull => "" => FormatException). No rows => 0 (PORT-NOTE as above). */
function decOutStrict(rows, name) {
  if (!rows || !rows[0]) return 0;
  const s = B.outOf(rows, name);
  if (s === '') throw FORMAT();
  return B.cvtDec(s);
}
/** int.Parse(p.Value.ToString()) (DBNull => FormatException). No rows => 0 (PORT-NOTE as above). */
function intOutStrict(rows, name) {
  if (!rows || !rows[0]) return 0;
  const s = B.outOf(rows, name);
  if (!/^\s*[-+]?\d+\s*$/.test(s)) throw FORMAT();
  return parseInt(s, 10);
}

/** Convert.ToDateTime(string): null => DateTime.MinValue, invalid => FormatException. Returns a SQL timestamp literal. */
function cvtDateTime(s) {
  if (s === null || s === undefined) return '0001-01-01 00:00:00';
  const d = new Date(String(s));
  if (Number.isNaN(d.getTime())) throw new Error('String was not recognized as a valid DateTime.');
  return B.netFormat(d, 'yyyy-MM-dd HH:mm:ss');
}

/** DataRow[i] (ordinal access) .ToString(): DBNull => ""; missing ordinal => IndexOutOfRangeException */
function dtIdx(row, i) {
  const vals = Object.values(row || {});
  if (i < 0 || i >= vals.length) throw new Error(`Cannot find column ${i}.`);
  const v = vals[i];
  return v === null || v === undefined ? '' : (v instanceof Date ? B.netDateString(v) : String(v));
}

/** TempData (kept in sessionStore under 'TempData'; Peek does not remove, Get removes) */
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

/** HostingEnvironment.MapPath(x): throws (like the HttpException of MapPath) when the path leaves the application root */
function safeMapPath(x) {
  const root = path.resolve(config.uploadDir);
  const p = path.resolve(B.mapPath(x));
  if (p !== root && !p.startsWith(root + path.sep)) throw new Error(`Cannot use a leading .. to exit above the top directory.`);
  return p;
}

module.exports = {
  ...B, dynPaging, cvtDecObj, cvtIntBanker, decOutOf, decOutStrict, intOutStrict, cvtDateTime, dtIdx, tdSet, tdPeek, tdGet,
  upload, reqFile, ticks, serverIp, safeMapPath,
};
