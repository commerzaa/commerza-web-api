'use strict';
/**
 * Shared helpers for portal batch 05 (CustomerPanel merchant pages). Not a router.
 * Exports: NRE(), FormatError(), nullEntry(name, type), str(v), isNull(v),
 *          toInt32(v), toInt64(v), toDecimal(v), bindInt(req, name, type), bindNullableInt(req, name),
 *          toStringOrEmpty(v), csReplace(s, a, b), mapPath(folder), viewJson(res, view, model, ViewBag)
 */
const path = require('path');
const config = require('../../../config');

/** NullReferenceException */
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
/** FormatException (Convert.ToInt32 / int.Parse) */
const FormatError = () => new Error('Input string was not in a correct format.');
/** MVC model binding: missing value for a non-nullable action parameter. */
const nullEntry = (name, type = 'System.Int32') => new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type '${type}'`);

const isNull = (v) => v === undefined || v === null;
const str = (v) => (isNull(v) ? '' : String(v));

/** Convert.ToInt32(object): null -> 0, numeric string -> int, else FormatException. */
function toInt32(v) {
  if (isNull(v)) return 0;
  if (typeof v === 'number') return Math.round(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  const t = String(v).trim();
  if (!/^[+-]?\d+$/.test(t)) throw FormatError();
  return parseInt(t, 10);
}
const toInt64 = toInt32;

/** Convert.ToDecimal(object): null -> 0, else number or FormatException. */
function toDecimal(v) {
  if (isNull(v)) return 0;
  if (typeof v === 'number') return v;
  const t = String(v).trim();
  if (t === '' || Number.isNaN(Number(t))) throw FormatError();
  return Number(t);
}

/** Non-nullable int action parameter (MVC default model binder): absent/unparseable -> ArgumentException. */
function bindInt(req, name, type = 'System.Int32') {
  const v = req.p[name];
  if (isNull(v) || String(v).trim() === '') throw nullEntry(name, type);
  const t = String(v).trim();
  if (!/^[+-]?\d+$/.test(t)) throw nullEntry(name, type);
  return parseInt(t, 10);
}

/** int? action parameter: absent/unparseable -> null. */
function bindNullableInt(req, name) {
  const v = req.p[name];
  if (isNull(v) || String(v).trim() === '') return null;
  const t = String(v).trim();
  return /^[+-]?\d+$/.test(t) ? parseInt(t, 10) : null;
}

/** Extension ToStringOrEmpty(): null -> "", else ToString(). */
const toStringOrEmpty = (v) => (isNull(v) ? '' : String(v));

/** C# string.Replace (all occurrences, literal). */
const csReplace = (s, a, b) => String(s).split(a).join(isNull(b) ? '' : String(b));

/** Server.MapPath("~/X/Y") -> <config.uploadDir>/X/Y */
function mapPath(folder) {
  return path.join(config.uploadDir || 'uploads', String(folder || '').replace(/^~?[\\/]*/, ''));
}

/** return View(view, model) with ViewBag values (MVC guide: ViewBag keys also at top level). */
function viewJson(res, view, model, ViewBag = {}) {
  const out = { view };
  if (model !== undefined) out.Model = model;
  out.ViewBag = ViewBag;
  Object.assign(out, ViewBag);
  return res.json(out);
}

module.exports = {
  NRE, FormatError, nullEntry, str, isNull, toInt32, toInt64, toDecimal, bindInt, bindNullableInt,
  toStringOrEmpty, csReplace, mapPath, viewJson,
};
