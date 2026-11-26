'use strict';
/**
 * Helpers shared by the batch-21 portal ports (UserPanel/Orders, CustomerPanel/Order_List, UserPanel/Proceed_To_Payment,
 * CustomerPanel/Change_Create_Invoice, CustomerPanel/MakePayment, IPNController). Not a router (lives in _shared/).
 * Exports: DB, NRE(), FormatError(), nullEntry(name, type), s(v), rep(str, a, b), toInt32(v), parseInt32(v), toInt64(v),
 *          outVal(rowOrRows, name), listParam(req, name), pget(obj, name), bindInt(req, name, method), bindDecimalStr(req, name),
 *          viewJson(res, view, model, ViewBag), urlReferrer(req), mapPath(virtualPath), fire(fn), netNow(), netShortDate(),
 *          Generatehash512(text), Generatetxnid(), RemotePost (class), multiResult(fn, params),
 *          decimal helpers: decParse(v), decFromNumber(n), decMul(a, b), decAdd(a, b), decRound(a, digits), decToString(a), decFormat00(a)
 */
const crypto = require('crypto');
const path = require('path');
const config = require('../../../config');
const db = require('../../../db');

const DB = 'shopping';

const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const FormatError = () => new Error('Input string was not in a correct format.');
const nullEntry = (name, type = 'System.Int32', method = '') => new Error(
  `The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type '${type}'${method ? ` for method '${method}'` : ''}. An optional parameter must be a reference type, a nullable type, or be declared as an optional parameter.`);
const s = (v) => (v === undefined || v === null ? '' : String(v));
/** C# string.Replace (all occurrences, null replacement => '') */
const rep = (str, a, b) => String(str).split(a).join(b === null || b === undefined ? '' : String(b));

/** Convert.ToInt32(object): null => 0, string must be an integer (FormatException otherwise) */
function toInt32(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') { if (!Number.isFinite(v)) throw FormatError(); return Math.round(v); }
  if (typeof v === 'bigint') return Number(v);
  const t = String(v).trim();
  if (!/^[+-]?\d+$/.test(t)) throw FormatError();
  return parseInt(t, 10);
}
/** Int32.Parse(string): null => ArgumentNullException */
function parseInt32(v) {
  if (v === null || v === undefined) throw new Error('Value cannot be null.\r\nParameter name: s');
  return toInt32(String(v));
}
const toInt64 = toInt32;

/** Value of an OUTPUT parameter (returned as a column of the first result row, case-insensitive). DBNull/absent => null */
function outVal(rows, name) {
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k === undefined || row[k] === undefined ? null : row[k];
}

/** case-insensitive property read */
function pget(o, name) {
  if (!o || typeof o !== 'object') return undefined;
  const k = Object.keys(o).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k === undefined ? undefined : o[k];
}

/**
 * MVC model binding of a List<T> action parameter (e.g. `List<CancelProductOrderStatusClass> param`):
 * JSON array body, `{ param: [...] }`, or form fields `param[0].OrderID` / `[0].OrderID`. Returns null when nothing binds
 * (MVC passed null => legacy NullReferenceException on param[0]).
 */
function listParam(req, name = 'param') {
  const b = req.body;
  if (Array.isArray(b)) return b;
  if (b && typeof b === 'object') {
    const direct = pget(b, name);
    if (Array.isArray(direct)) return direct;
    if (direct && typeof direct === 'object') {
      const keys = Object.keys(direct).filter((k) => /^\d+$/.test(k)).sort((x, y) => x - y);
      if (keys.length) return keys.map((k) => direct[k]);
    }
    const out = [];
    const re = new RegExp(`^(?:${name})?\\[(\\d+)\\]\\.(\\w+)$`, 'i');
    for (const k of Object.keys(b)) {
      const m = re.exec(k);
      if (m) { const i = Number(m[1]); out[i] = out[i] || {}; out[i][m[2]] = b[k]; }
    }
    if (out.length) return out;
  }
  return null;
}

/** non-nullable int action parameter (missing => MVC ArgumentException, unparsable => same) */
function bindInt(req, name, method = '') {
  const v = req.p[name];
  if (v === undefined || v === null || String(v).trim() === '') throw nullEntry(name, 'System.Int32', method);
  const t = String(v).trim();
  if (!/^[+-]?\d+$/.test(t)) throw nullEntry(name, 'System.Int32', method);
  return parseInt(t, 10);
}

/** non-nullable decimal action parameter, returned as the .NET decimal string (scale kept: "10.50") */
function bindDecimalStr(req, name, method = '') {
  const v = req.p[name];
  if (v === undefined || v === null || String(v).trim() === '') throw nullEntry(name, 'System.Decimal', method);
  try { return decToString(decParse(v)); } catch (_) { throw nullEntry(name, 'System.Decimal', method); }
}

/** return View(view, model) => JSON with Model + ViewBag (ViewBag keys also at top level) */
function viewJson(res, view, model, ViewBag = {}, extra = {}) {
  const out = { view };
  if (model !== undefined) out.Model = model;
  out.ViewBag = ViewBag;
  Object.assign(out, ViewBag, extra);
  return res.json(out);
}

/** Convert.ToString(Request.UrlReferrer) */
const urlReferrer = (req) => s(req.get('referer') || req.get('referrer'));

/** Server.MapPath("~/x") => config.uploadDir/x (traversal outside uploadDir refused) */
function mapPath(p) {
  const rel = s(p).replace(/\\/g, '/').replace(/^~?\/*/, '').replace(/^(\.\.?\/)+/, '');
  const root = path.resolve(config.uploadDir || 'uploads');
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error('Cannot use a leading .. to exit above the top directory.');
  return full;
}

/** new Thread(delegate { ... }).Start() => fire-and-forget (errors logged only) */
function fire(fn) {
  Promise.resolve().then(fn).catch((e) => console.error(e));
}

const pad2 = (n) => String(n).padStart(2, '0');
/** DateTime.Now.ToString() (en-US: M/d/yyyy h:mm:ss tt) */
function netNow(d = new Date()) {
  let h = d.getHours();
  const tt = h >= 12 ? 'PM' : 'AM';
  h %= 12; if (h === 0) h = 12;
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${h}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())} ${tt}`;
}
/** DateTime.Now.ToShortDateString() (en-US: M/d/yyyy) */
function netShortDate(d = new Date()) {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

/** public string Generatehash512(string text): SHA512 of the UTF-8 bytes, lower-case hex */
function Generatehash512(text) {
  if (text === null || text === undefined) throw new Error('String reference not set to an instance of a String.\r\nParameter name: s');
  return crypto.createHash('sha512').update(Buffer.from(String(text), 'utf8')).digest('hex');
}

/** public string Generatetxnid(): legacy hashed rnd.ToString() (the type name "System.Random") + DateTime.Now */
function Generatetxnid() {
  // PORT-NOTE: DateTime.Now formatting depends on the server culture; en-US format used.
  const strHash = Generatehash512('System.Random' + netNow());
  return strHash.substring(0, 20);
}

/** public class RemotePost { FormName = "form1", Method = "post", Url = "", Add(name, value), Post() } */
class RemotePost {
  constructor() {
    this.FormName = 'form1';
    this.Method = 'post';
    this.Url = '';
    this.Inputs = []; // NameValueCollection: Add with an existing key appends ",value"
  }

  Add(name, value) {
    const e = this.Inputs.find((x) => x[0].toLowerCase() === String(name).toLowerCase());
    if (e) {
      if (value !== null && value !== undefined) e[1] = e[1] === null ? String(value) : `${e[1]},${value}`;
    } else this.Inputs.push([String(name), value === null || value === undefined ? null : String(value)]);
  }

  /** Response.Clear(); Response.Write(...); Response.End() => the auto-submit HTML page */
  Post(res) {
    let h = '<html><head>';
    h += `</head><body onload="document.${this.FormName}.submit()">`;
    h += `<form name="${this.FormName}" method="${this.Method}" action="${this.Url}" >`;
    for (const [k, v] of this.Inputs) h += `<input name="${k}" type="hidden" value="${v === null ? '' : v}">`;
    h += '</form>';
    h += '</body></html>';
    return res.status(200).type('html').send(h);
  }
}

/**
 * EF ObjectContext.Translate over a multi-result-set proc (reader.NextResult()).
 * PORT-NOTE: PostgreSQL functions return ONE result set; when the driver returns several results every set is kept,
 * otherwise the single set is table 0 (later sets empty). Adapt if the migrated function exposes refcursors.
 */
async function multiResult(fn, params) {
  const keys = Object.keys(params);
  const args = keys.map((k, i) => `"${k.toLowerCase()}" => $${i + 1}`).join(', ');
  const r = await db.getPool(DB).query(`select * from ${fn.toLowerCase()}(${args})`, keys.map((k) => (params[k] === undefined ? null : params[k])));
  if (Array.isArray(r)) return r.map((x) => x.rows);
  return [r.rows];
}

// ---------------------------------------------------------------- System.Decimal emulation (scale preserved like .NET)
/** Convert.ToDecimal(string) (NumberStyles.Number): null => 0; "10.50" keeps scale 2 */
function decParse(v) {
  if (v === null || v === undefined) return { i: 0n, s: 0 };
  if (typeof v === 'number') return decFromNumber(v);
  if (typeof v === 'object' && typeof v.i === 'bigint') return v;
  const t = String(v).trim().replace(/,/g, '');
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(t);
  if (!m || (m[2] === '' && !m[3])) throw FormatError();
  const frac = m[3] || '';
  let i = BigInt((m[2] || '0') + frac);
  if (m[1] === '-') i = -i;
  return { i, s: frac.length };
}
function decFromNumber(n) {
  if (!Number.isFinite(n)) throw FormatError();
  let t = String(n);
  if (/e/i.test(t)) t = n.toFixed(20).replace(/0+$/, '').replace(/\.$/, '');
  return decParse(t);
}
const pow10 = (k) => 10n ** BigInt(k);
const decMul = (a, b) => ({ i: a.i * b.i, s: a.s + b.s });
function decAdd(a, b) {
  const sc = Math.max(a.s, b.s);
  return { i: a.i * pow10(sc - a.s) + b.i * pow10(sc - b.s), s: sc };
}
/** Math.Round(decimal, digits) - MidpointRounding.ToEven; scale reduced, never padded */
function decRound(a, digits, awayFromZero = false) {
  if (a.s <= digits) return a;
  const f = pow10(a.s - digits);
  const neg = a.i < 0n;
  const abs = neg ? -a.i : a.i;
  let q = abs / f;
  const r2 = (abs % f) * 2n;
  if (r2 > f || (r2 === f && (awayFromZero || q % 2n === 1n))) q += 1n;
  return { i: neg ? -q : q, s: digits };
}
/** decimal.ToString() */
function decToString(a) {
  const neg = a.i < 0n;
  let d = (neg ? -a.i : a.i).toString();
  if (a.s > 0) {
    d = d.padStart(a.s + 1, '0');
    d = `${d.slice(0, d.length - a.s)}.${d.slice(d.length - a.s)}`;
  }
  return (neg && /[1-9]/.test(d) ? '-' : '') + d;
}
/** decimal.ToString("0.00") (AwayFromZero, padded to 2 decimals) */
function decFormat00(a) {
  let r = decRound(a, 2, true);
  if (r.s < 2) r = { i: r.i * pow10(2 - r.s), s: 2 };
  return decToString(r);
}

module.exports = {
  DB, NRE, FormatError, nullEntry, s, rep, toInt32, parseInt32, toInt64, outVal, listParam, pget, bindInt, bindDecimalStr,
  viewJson, urlReferrer, mapPath, fire, netNow, netShortDate, Generatehash512, Generatetxnid, RemotePost, multiResult,
  decParse, decFromNumber, decMul, decAdd, decRound, decToString, decFormat00,
};
