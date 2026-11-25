'use strict';
// Shared helpers for portal batch 07 (ClusterofferShopingPortal CustomerPanel controllers Passcode .. SendEmailViaSelfAccount).
// Database: Db_Shopping => 'shopping'.
const fs = require('fs');
const path = require('path');
const config = require('../../../config');
const ps = require('./portal-session');

const DB = 'shopping';

const NRE = () => new TypeError('Object reference not set to an instance of an object.');

/** undefined => null (MVC string binding) */
const nStr = (v) => (v === undefined ? null : v);
/** C# obj.ToString() on a value that may be DBNull/null => "" */
const s = (v) => (v === null || v === undefined ? '' : String(v));
/** C# string.Replace (all occurrences, literal) */
const rep = (str, a, b) => String(str).split(a).join(b === null || b === undefined ? '' : String(b));
/** C# string.Trim(char) / TrimEnd(char) / TrimStart(char) */
const trimChar = (str, c) => { let a = 0; let b = str.length; while (a < b && str[a] === c) a++; while (b > a && str[b - 1] === c) b--; return str.slice(a, b); };
const trimEndChar = (str, c) => { let b = str.length; while (b > 0 && str[b - 1] === c) b--; return str.slice(0, b); };
const trimStartChar = (str, c) => { let a = 0; while (a < str.length && str[a] === c) a++; return str.slice(a); };

/** int.Parse / Convert.ToInt32(string) on a non-null value (FormatException / OverflowException). */
function parseInt32(v) {
  const t = String(v).trim();
  if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  const n = parseInt(t, 10);
  if (n > 2147483647 || n < -2147483648) throw new Error('Value was either too large or too small for an Int32.');
  return n;
}
/** Convert.ToInt32(string): null => 0 */
const cvtInt = (v) => (v === null || v === undefined ? 0 : (typeof v === 'number' ? Math.trunc(v) : parseInt32(v)));
/** Convert.ToDouble(string) */
function cvtDouble(v) {
  if (v === null || v === undefined) return 0;
  const t = String(v).trim();
  if (t === '' || Number.isNaN(Number(t))) throw new Error('Input string was not in a correct format.');
  return Number(t);
}
/** MVC binding of a non-nullable int action parameter (missing/invalid => ArgumentException from the action invoker). */
function reqInt(v, name, type = 'System.Int32') {
  if (v === undefined || v === null || String(v).trim() === '' || !/^[+-]?\d+$/.test(String(v).trim())) {
    throw new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type '${type}'.`);
  }
  return parseInt(String(v).trim(), 10);
}
/** MVC binding of a defaulted Int64/int parameter (`Int64 passCode = 0`): missing/invalid => default */
const defInt = (v, d) => (v === undefined || v === null || !/^[+-]?\d+$/.test(String(v).trim()) ? d : parseInt(String(v).trim(), 10));
/** MVC binding of int? (missing/invalid => null) */
const optInt = (v) => (v === undefined || v === null || !/^[+-]?\d+$/.test(String(v).trim()) ? null : parseInt(String(v).trim(), 10));

/** OUTPUT parameter value: PG functions return OUT params as columns of the (first) result row. Case-insensitive. */
function outCol(rowsOrRow, name) {
  const r = Array.isArray(rowsOrRow) ? rowsOrRow[0] : rowsOrRow;
  if (!r) return null;
  const k = Object.keys(r).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? null : r[k];
}
/** int.Parse(spOutput.Value.ToString()). PORT-NOTE: a row-returning PG function cannot return the OUT value with zero rows => 0. */
function outInt(rowsOrRow, name) {
  const v = outCol(rowsOrRow, name);
  if (v === null || v === undefined || v === '') return 0;
  return parseInt32(v);
}

/** ViewBag.masterpageshow from Session["LoginwithMobile"] */
const masterpageshow = (req) => (ps.sessionGet(req, 'LoginwithMobile') !== null ? 'MobileLogin' : '');

/** return View(path, Model) => JSON with the data the view would receive */
function view(res, viewPath, Model, ViewBag = {}, extra = {}) {
  return res.json({ view: viewPath, Model: Model === undefined ? null : Model, ...ViewBag, ...extra });
}

/** Server.MapPath("~/x/y") => <uploadDir>/x/y (never escapes uploadDir) */
function mapPath(p) {
  const rel = String(p || '').replace(/\\/g, '/').replace(/^~?\/*/, '').split('/').filter((x) => x && x !== '..' && x !== '.').join('/');
  return path.join(config.uploadDir, rel);
}

/** .NET Regex.Replace(x, @"[^\w\d]", repl) (Unicode \w) */
const replaceNonWord = (str, repl) => String(str).replace(/[^\p{L}\p{Mn}\p{Nd}\p{Pc}]/gu, repl);

/**
 * Challan image block of PayItForward.PayItForwardMethod / PurchasePackage.PurchaseKitOrPackage:
 * decode the base64 (optionally "data:image/x;base64," prefixed) string, delete an existing file, and when the payload is > 10 KB save a
 * half-size JPEG thumbnail (Image.GetThumbnailImage + Save(ImageFormat.Jpeg)), else save the image unchanged.
 * PORT-NOTE: System.Drawing -> sharp (lazy-required). Image.FromStream validation => sharp metadata (throws on non-image data).
 */
async function saveChallanImage(base64String, strValidFullName) {
  let b64 = String(base64String);
  if (b64.includes('base64,')) {
    const IndexNo1 = b64.indexOf(',') + 1;
    b64 = b64.substring(IndexNo1);
  }
  if (!/^[A-Za-z0-9+/\s]*={0,2}\s*$/.test(b64) || b64.replace(/\s/g, '').length % 4 !== 0) {
    throw new Error('The input is not a valid Base-64 string as it contains a non-base 64 character, more than two padding characters, or an illegal character among the padding characters.');
  }
  const b = Buffer.from(b64, 'base64');
  // eslint-disable-next-line global-require
  const sharp = require('sharp');
  let meta;
  try { meta = await sharp(b).metadata(); } catch (e) { throw new Error('Parameter is not valid.'); }
  const filesize = b.length / 1024;
  fs.mkdirSync(path.dirname(strValidFullName), { recursive: true });
  if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
  const scaleFactor = 0.5;
  const newWidth = Math.trunc(meta.width * scaleFactor);
  const newHeight = Math.trunc(meta.height * scaleFactor);
  if (filesize > 10) {
    const out = await sharp(b).resize(newWidth, newHeight, { fit: 'fill' }).jpeg().toBuffer();
    fs.writeFileSync(strValidFullName, out);
  } else {
    // img.Save(path) keeps the decoded image's raw format
    fs.writeFileSync(strValidFullName, b);
  }
}

module.exports = {
  DB, NRE, nStr, s, rep, trimChar, trimEndChar, trimStartChar, parseInt32, cvtInt, cvtDouble, reqInt, defInt, optInt,
  outCol, outInt, masterpageshow, view, mapPath, replaceNonWord, saveChallanImage,
};
