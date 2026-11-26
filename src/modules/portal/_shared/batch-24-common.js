'use strict';
/**
 * Shared helpers for portal batch 24 (CustomerPanel: ReferralDashBoard, TransferToBank_mobile, SendEmailViaSelfAccount,
 * PurchasePackage, CustomerDashBoard, Wallet, SendBulkEmailToSystemUsersWithFiltration, Purchased_Voucher, UploadEmailData,
 * UploadMobileData, ReferralBonus, Purchased_Voucher_Receipt, PurchasedSMSPackage, PurchasedEmailPackage, PromoteReferral).
 * Not a router: lives in _shared/ so src/modules/portal.js does not mount it.
 * Exports: DB, NRE(), s(v), mvcStr(req, name), mvcStrDef(req, name, def), optInt(v), bindInt(v, name, type), bindDecimal(v, name),
 *          defDecimal(v, def), cvtDecimal(v), toInt32(v), cvtInt32Str(v), outCol(row, name), outInt(row, name), rep(str, a, b),
 *          trimChar(str, c), trimEndChar(str, c), trimStartChar(str, c), view(res, viewPath, Model, bag), background(fn),
 *          multerAny(), readExcelFirstTable(buffer, fileName), saveChallanImage(base64String, strValidFullName), csSubstringExt(str)
 */
const fs = require('fs');
const path = require('path');

const DB = 'shopping';

/** NullReferenceException */
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
/** obj.ToString() on DBNull/null => "" (Convert.ToString / ToStringOrEmpty) */
const s = (v) => (v === undefined || v === null ? '' : String(v));

/** MVC string parameter binding (missing => null, "" => null because of ConvertEmptyStringToNull). */
function mvcStr(req, name) {
  const v = req.p[name];
  if (v === undefined || v === null || v === '') return null;
  return String(v);
}
/**
 * MVC string parameter with a C# default value (`string x = ""`): ControllerActionInvoker returns `value ?? DefaultValue`,
 * so missing and posted "" (ConvertEmptyStringToNull => null) both give the default.
 */
function mvcStrDef(req, name, def) {
  const v = req.p[name];
  if (v === undefined || v === null || v === '') return def;
  return String(v);
}

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';
const FORMAT = () => new Error('Input string was not in a correct format.');

/** int? binding: missing/invalid => null */
function optInt(v) {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (!isBlank(v) && /^\s*[+-]?\d+\s*$/.test(String(v))) return parseInt(v, 10);
  return null;
}
/** non-nullable int/long binding: missing or invalid => ArgumentException of the action invoker (HTTP 500) */
function bindInt(v, name, type = 'System.Int32') {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (!isBlank(v) && /^\s*[+-]?\d+\s*$/.test(String(v))) return parseInt(v, 10);
  throw new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type '${type}'.`);
}
/** non-nullable decimal binding */
function bindDecimal(v, name) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (!isBlank(v) && /^\s*[-+]?(\d+\.?\d*|\.\d+)\s*$/.test(String(v))) return Number(v);
  throw new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Decimal'.`);
}
/** `decimal x = 0` binding: missing/invalid => default */
function defDecimal(v, def = 0) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (!isBlank(v) && /^\s*[-+]?(\d+\.?\d*|\.\d+)\s*$/.test(String(v))) return Number(v);
  return def;
}
/** Convert.ToDecimal(string): null => 0, otherwise must be a decimal number (FormatException) */
function cvtDecimal(v) {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return v;
  const t = String(v).trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) throw FORMAT();
  return Number(t);
}
/** Convert.ToInt32(object): null => 0, numbers banker's-rounded, strings must be integers */
function toInt32(v) {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') {
    const f = Math.floor(v); const d = v - f;
    if (d > 0.5) return f + 1;
    if (d < 0.5) return f;
    return f % 2 === 0 ? f : f + 1;
  }
  if (/^\s*[+-]?\d+\s*$/.test(String(v))) return parseInt(v, 10);
  throw FORMAT();
}
/** Convert.ToInt32(outParam.Value.ToString()): DBNull => "" => FormatException */
const cvtInt32Str = (v) => toInt32(s(v));

/** OUTPUT parameter of a ported proc = column of the first result row (case-insensitive); null when missing */
function outCol(rowOrRows, name) {
  const r = Array.isArray(rowOrRows) ? rowOrRows[0] : rowOrRows;
  if (!r) return null;
  const k = Object.keys(r).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k === undefined ? null : r[k];
}
/** int.Parse(spOutput.Value.ToString()). PORT-NOTE: a row-returning PG function has no OUT value without rows => 0. */
function outInt(rowOrRows, name) {
  const v = outCol(rowOrRows, name);
  if (v === null || v === undefined || v === '') return 0;
  return toInt32(typeof v === 'number' ? v : String(v));
}

/** C# string.Replace (all occurrences; null replacement => "") */
const rep = (str, a, b) => String(str).split(a).join(b === null || b === undefined ? '' : String(b));
const trimChar = (str, c) => { let a = 0; let b = str.length; while (a < b && str[a] === c) a++; while (b > a && str[b - 1] === c) b--; return str.slice(a, b); };
const trimEndChar = (str, c) => { let b = str.length; while (b > 0 && str[b - 1] === c) b--; return str.slice(0, b); };
const trimStartChar = (str, c) => { let a = 0; while (a < str.length && str[a] === c) a++; return str.slice(a); };

/** return View(viewPath, Model) => JSON with the view name, the model and every ViewBag/TempData value */
function view(res, viewPath, Model, bag = {}) {
  const out = { view: viewPath };
  if (Model !== undefined) out.Model = Model;
  return res.json(Object.assign(out, bag));
}

/** new Thread(delegate { ... }).Start(): fire-and-forget, errors only logged (they never reached the response) */
function background(fn) {
  setImmediate(() => { Promise.resolve().then(fn).catch((e) => console.error(e && e.message ? e.message : e)); });
}

/** multipart/form-data (HttpPostedFileBase) via multer memory storage; re-runs the ASP.NET-style binder for the text fields */
function multerAny() {
  const multer = require('multer'); // eslint-disable-line global-require
  const up = multer({ storage: multer.memoryStorage() }).any();
  return (req, res, next) => {
    const ct = String((req.headers && req.headers['content-type']) || '');
    if (!/multipart\/form-data/i.test(ct)) return next();
    return up(req, res, (err) => {
      if (err) return next(err);
      try { require('../../../middleware/params')(req, res, () => {}); } catch (_) { /* keep previous req.p */ } // eslint-disable-line global-require
      return next();
    });
  };
}

/**
 * ExcelReaderFactory.CreateBinaryReader / CreateOpenXmlReader + IsFirstRowAsColumnNames = true + AsDataSet().Tables[0]
 * => { columns: string[], rows: object[] } (row values: string / number / Date, empty cell => null like DBNull).
 * PORT-NOTE: ExcelDataReader (.NET) -> the `xlsx` (SheetJS) package, lazily required (NOT installed: the call throws
 * "Cannot find module 'xlsx'" until it is added). Reads both .xls (BIFF) and .xlsx. Empty header cells are named
 * "Column<n>" like ExcelDataReader does.
 */
function readExcelFirstTable(buffer) {
  const XLSX = require('xlsx'); // eslint-disable-line global-require
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = ws ? XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true }) : [];
  const header = aoa.length ? aoa[0] : [];
  const columns = [];
  for (let i = 0; i < header.length; i++) {
    const h = header[i] === null || header[i] === undefined || String(header[i]) === '' ? `Column${i + 1}` : String(header[i]);
    columns.push(h);
  }
  const rows = aoa.slice(1).map((r) => {
    const o = {};
    columns.forEach((c, i) => { o[c] = r[i] === undefined ? null : r[i]; });
    return o;
  });
  return { columns, rows };
}
/** DataRow[colName].ToString() (DataTable column lookup is case-insensitive; DBNull => "") */
function rowValue(row, colName) {
  const k = Object.keys(row).find((x) => x === colName) || Object.keys(row).find((x) => x.toLowerCase() === colName.toLowerCase());
  if (k === undefined) throw new Error(`Column '${colName}' does not belong to table .`);
  const v = row[k];
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

/**
 * C# `base64String.Substring(IndexOf("/") + 1, IndexOf(";") - (IndexOf("/") + 1))` (ImageExt of a data URL):
 * throws ArgumentOutOfRangeException like .NET when ";" is missing or before "/".
 */
function csSubstringExt(str) {
  const IndexNo = str.indexOf('/') + 1;
  const lastIndexNo = str.indexOf(';');
  const len = lastIndexNo - IndexNo;
  if (len < 0) throw new RangeError('Length cannot be less than zero.\r\nParameter name: length');
  return str.substr(IndexNo, len);
}

/**
 * Challan image block of PurchasePackage.PurchaseKitOrPackage: decode base64 (optional "data:...;base64," prefix), delete an
 * existing file, save a half-size JPEG thumbnail when > 10 KB, else save the image unchanged.
 * PORT-NOTE: System.Drawing -> optional `sharp` (lazy-required, NOT installed). Without sharp the decoded bytes are written
 * unchanged (no resize / re-encode, no Image.FromStream validation).
 */
async function saveChallanImage(base64String, strValidFullName) {
  let b64 = String(base64String);
  if (b64.includes('base64,')) {
    csSubstringExt(b64); // ImageExt (value unused)
    b64 = b64.substring(b64.indexOf(',') + 1);
  }
  if (!/^[A-Za-z0-9+/\s]*={0,2}\s*$/.test(b64) || b64.replace(/\s/g, '').length % 4 !== 0) {
    throw new Error('The input is not a valid Base-64 string as it contains a non-base 64 character, more than two padding characters, or an illegal character among the padding characters.');
  }
  const b = Buffer.from(b64, 'base64');
  let sharp = null;
  try { sharp = require('sharp'); } catch (_) { sharp = null; } // eslint-disable-line global-require
  let meta = null;
  if (sharp) {
    try { meta = await sharp(b).metadata(); } catch (e) { throw new Error('Parameter is not valid.'); }
  }
  const filesize = b.length / 1024;
  fs.mkdirSync(path.dirname(strValidFullName), { recursive: true });
  if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
  if (filesize > 10 && sharp && meta) {
    const out = await sharp(b).resize(Math.trunc(meta.width * 0.5), Math.trunc(meta.height * 0.5), { fit: 'fill' }).jpeg().toBuffer();
    fs.writeFileSync(strValidFullName, out);
  } else {
    fs.writeFileSync(strValidFullName, b);
  }
}

module.exports = {
  DB, NRE, s, mvcStr, mvcStrDef, optInt, bindInt, bindDecimal, defDecimal, cvtDecimal, toInt32, cvtInt32Str, outCol, outInt,
  rep, trimChar, trimEndChar, trimStartChar, view, background, multerAny, readExcelFirstTable, rowValue, csSubstringExt, saveChallanImage,
};
