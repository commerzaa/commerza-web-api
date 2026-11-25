'use strict';
// Shared helpers for portal batch 06 (CustomerPanel: MLMWallet .. PassbookController). Database: Db_Shopping => 'shopping'.
const ps = require('./portal-session');

const DB = 'shopping';

/** value of an OUT parameter returned as a column of the single result row (case-insensitive; falls back to the first column) */
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k !== undefined) return row[k];
  const first = Object.keys(row)[0];
  return first === undefined ? null : row[first];
}

/**
 * int.Parse(@TOTALCOUNT OUT .Value.ToString()) for a paging procedure whose OUT value is returned as a column of every row.
 * No rows (or no such column) => 0 (the legacy OUT value of an empty page).
 */
function outTotal(rows, name) {
  const r = rows && rows[0];
  if (!r) return 0;
  const k = Object.keys(r).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k === undefined || r[k] === null || r[k] === undefined) return 0;
  return parseInt(String(r[k]), 10) || 0;
}

/** first column of a row (SqlQuery<scalar>().FirstOrDefault()) */
const firstCol = (row) => (row ? row[Object.keys(row)[0]] : null);

/** .ToString() on a possibly-null value: legacy NullReferenceException */
function str(v) {
  if (v === null || v === undefined) throw nre();
  return String(v);
}
/** ToStringOrEmpty() */
const s = (v) => (v === null || v === undefined ? '' : String(v));

function nre() {
  return new Error('Object reference not set to an instance of an object.');
}

/** int.Parse(x.ToString()) on an OUT parameter: DBNull.ToString() = "" => FormatException */
function intParse(v) {
  const t = v === null || v === undefined ? '' : String(v).trim();
  if (!/^[-+]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return parseInt(t, 10);
}

/** int? / long? binding from a request value (null when missing or not an integer, like MVC model binding) */
function nInt(v) {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  if (t === '' || !/^[-+]?\d+$/.test(t)) return null;
  return parseInt(t, 10);
}
/** string binding: undefined => null */
const nStr = (v) => (v === undefined || v === null ? null : String(v));

/** Convert.ToInt32(double) (banker's rounding) */
function toInt32(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error('Input string was not in a correct format.');
  const f = Math.floor(n);
  const d = n - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/** Convert.ToDecimal / Convert.ToDouble on a string (FormatException on bad input, null => 0) */
function toNumber(v) {
  if (v === null || v === undefined) return 0;
  const t = String(v).trim();
  if (t === '' || Number.isNaN(Number(t))) throw new Error('Input string was not in a correct format.');
  return Number(t);
}

/** ViewBag.masterpageshow from Session["LoginwithMobile"] */
function masterpageshow(req) {
  return ps.sessionGet(req, 'LoginwithMobile') !== null && ps.sessionGet(req, 'LoginwithMobile') !== undefined ? 'MobileLogin' : '';
}

/** return View(path, Model) => JSON with everything the view receives */
function view(res, viewPath, Model, ViewBag = {}, extra = {}) {
  const body = { view: viewPath, ViewBag, ...ViewBag, ...extra };
  if (Model !== undefined) body.Model = Model;
  return res.json(body);
}

/**
 * MVC action whose return type is not an ActionResult (string / List<T>): MVC wraps it in a ContentResult
 * (Convert.ToString(value)) - a null value becomes an EmptyResult.
 */
function content(res, value) {
  if (value === null || value === undefined) return res.status(200).end();
  return res.type('text/html').send(String(value));
}

/** `if (Session["Plid"] == null) return "<text>";` / `return null;` in a non-ActionResult action (Content, not JSON) */
function customerContentOr(text) {
  return [...ps.portalSession, (req, res, next) => {
    if (ps.isCustomer(req)) return next();
    return content(res, text);
  }];
}

/** DateTime.Now.ToShortDateString() (en-IN style d/M/yyyy as on the legacy server: dd-MM-yyyy is not assumed) */
function shortDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** DateTime.ToString("dd-MM-yyyy") */
const ddMMyyyy = shortDate;

/** fire-and-forget (legacy background Thread): never awaits, errors swallowed and logged */
function background(fn) {
  setImmediate(() => {
    Promise.resolve().then(fn).catch((e) => console.error('[portal batch-06 background]', e && e.message));
  });
}

module.exports = {
  DB, outVal, outTotal, firstCol, str, s, nre, intParse, nInt, nStr, toInt32, toNumber, masterpageshow, view, content,
  customerContentOr, shortDate, ddMMyyyy, background,
};
