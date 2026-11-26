'use strict';
/**
 * Shared helpers for portal batch 02 (CommonController, ContactUs, COOKIE_POLICY, CustomerPanel Account..All_News_Show).
 * Not a router: lives in _shared/ so src/modules/portal.js does not mount it.
 * Exports: DB, NRE, need, s, nz, rep, pick, outv, bindInt, bindDouble, bindDecimal, optInt, toInt32, toInt64, toDouble, toDecimal,
 *          masterpageshow, view, keepTempData, mapPath, loadSharp, ImageUploadMasterMethod, dataSetGetXml, fire, ddMMyyyy
 */
const fs = require('fs');
const path = require('path');
const config = require('../../../config');
const ps = require('./portal-session');

const DB = 'shopping';

/** NullReferenceException */
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
/** string.Method() on a possibly-null C# string: throws NRE like the legacy code. */
const need = (v) => { if (v === undefined || v === null) throw NRE(); return String(v); };
/** Convert.ToString / ToStringOrEmpty */
const s = (v) => (v === undefined || v === null ? '' : String(v));
const nz = (v) => (v === undefined || v === null ? '' : v);
/** string.Replace(k, v) (all occurrences, null value => "") */
const rep = (str, k, v) => String(str).split(k).join(s(v));
/** case-insensitive column pick */
const pick = (r, name) => {
  if (!r) return undefined;
  const k = Object.keys(r).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k === undefined ? undefined : r[k];
};
/** OUT parameter (column of the first result row of a proc call); missing => null (SqlParameter.Value DBNull) */
const outv = (rows, name) => {
  const r = Array.isArray(rows) ? rows[0] : rows;
  const v = pick(r, name);
  return v === undefined ? null : v;
};

const FORMAT = () => new Error('Input string was not in a correct format.');
const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

/** MVC binding of a non-nullable simple parameter (int/long): missing or not convertible => ArgumentException (HTTP 500 in legacy). */
function bindInt(v, name, type = 'System.Int32') {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (!isBlank(v) && /^\s*[+-]?\d+\s*$/.test(String(v))) return parseInt(v, 10);
  throw new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type '${type}'.`);
}
/** MVC binding of a non-nullable double */
function bindDouble(v, name) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (!isBlank(v) && Number.isFinite(Number(v))) return Number(v);
  throw new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Double'.`);
}
/** MVC binding of `decimal x = def` (optional parameter): missing/invalid => default */
function bindDecimal(v, def = 0) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (!isBlank(v) && Number.isFinite(Number(v))) return Number(v);
  return def;
}
/** MVC binding of int? : missing/invalid => null */
function optInt(v) {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (!isBlank(v) && /^\s*[+-]?\d+\s*$/.test(String(v))) return parseInt(v, 10);
  return null;
}
/** Convert.ToInt32(object): null => 0, numbers rounded (banker's rounding), strings must be integers */
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
const toInt64 = toInt32;
/** Convert.ToDouble / Convert.ToDecimal(object): null => 0, invalid string => FormatException */
function toDouble(v) {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return v;
  if (isBlank(v) || !Number.isFinite(Number(v))) throw FORMAT();
  return Number(v);
}
const toDecimal = toDouble;

/** if (Session["LoginwithMobile"] != null) ViewBag.masterpageshow = "MobileLogin"; else "" */
const masterpageshow = (req) => (ps.sessionGet(req, 'LoginwithMobile') !== null ? 'MobileLogin' : '');

/** return View(viewPath, Model) => JSON with the view name, the model and every ViewBag/TempData value */
function view(res, viewPath, Model, bag = {}) {
  const out = { view: viewPath };
  if (Model !== undefined) out.Model = Model;
  return res.json(Object.assign(out, bag));
}

/** TempData.Keep() for the given keys (values already read in this request are put back) */
function keepTempData(req, keys) {
  for (const k of keys) {
    const v = ps.tempDataPeek(req, k);
    if (v !== null && v !== undefined) ps.tempDataSet(req, k, v);
  }
}

/** Server.MapPath(x) => config.uploadDir/<x without leading ~ / ./ ../ and slashes> */
function mapPath(p) {
  const rel = s(p).replace(/\\/g, '/').replace(/^~?\/*/, '').replace(/^(\.\.?\/)+/, '');
  const full = path.resolve(config.uploadDir, rel);
  const root = path.resolve(config.uploadDir);
  // PORT-NOTE (security): Server.MapPath rejected paths above the application root; traversal outside uploadDir is refused here.
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error(`Cannot use a leading .. to exit above the top directory.`);
  return full;
}

/** optional `sharp` package (NOT installed): lazily required, null when missing */
function loadSharp() {
  try { return require('sharp'); } catch (e) { return null; } // eslint-disable-line global-require
}

/** Image.FromStream(ms) validation ("Parameter is not valid." for non-images) - only possible with sharp */
async function assertImage(sharp, bytes) {
  if (!sharp) return null;
  try { return await sharp(bytes).metadata(); } catch (e) { throw new Error('Parameter is not valid.'); }
}

/**
 * AddTicketController.ImageUploadMasterMethod(string ImageBase64Code, string SavePaths, string IdForAppend) (also used by AddFund).
 * PORT-NOTE: System.Drawing re-encode (files > 10 KB are re-saved as JPEG at scale 1) uses the optional `sharp` package;
 * without it the decoded bytes are written unchanged. The target folder is created when missing.
 */
async function ImageUploadMasterMethod(ImageBase64Code, SavePaths, IdForAppend) {
  let RealImageName = '';
  if (need(ImageBase64Code).trim() !== '') {
    let Base64String = '';
    if (ImageBase64Code !== '') {
      Base64String = ImageBase64Code;
      let Image = String(100000 + Math.floor(Math.random() * 900000)); // Random.Next(100000, 1000000)
      Image = Image.trim();
      Image = Image.split('&amp;').join('And');
      Image = Image.split('&').join(' And ');
      Image = Image.replace(/[^\w\d]/g, '');
      Image = Image.split(' ').join('-');
      RealImageName = Image + '-' + IdForAppend + '.jpg';
    } else {
      RealImageName = ' ';
    }
    const dir = mapPath(SavePaths);
    const StrValidFullNameAndPath = path.join(dir, RealImageName);
    if (Base64String.includes('base64,')) {
      Base64String = Base64String.substring(Base64String.indexOf(',') + 1);
      const ByteArray = Buffer.from(Base64String, 'base64');
      const sharp = loadSharp();
      await assertImage(sharp, ByteArray);
      const filesize = ByteArray.length / 1024;
      if (fs.existsSync(StrValidFullNameAndPath)) fs.unlinkSync(StrValidFullNameAndPath);
      fs.mkdirSync(dir, { recursive: true });
      if (filesize > 10 && sharp) {
        await sharp(ByteArray).jpeg().toFile(StrValidFullNameAndPath);
      } else {
        fs.writeFileSync(StrValidFullNameAndPath, ByteArray);
      }
    } else {
      RealImageName = ImageBase64Code.replace(/^\/+/, '');
    }
  }
  return RealImageName;
}

const xmlEsc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** DataSet.GetXml() of a one-table DataSet (DataSetName "NewDataSet"; NULL columns are omitted like ADO.NET does) */
function dataSetGetXml(tableName, rows, props) {
  if (!rows || !rows.length) return '<NewDataSet />';
  let xml = '<NewDataSet>\r\n';
  for (const r of rows) {
    xml += `  <${tableName}>\r\n`;
    for (const k of Object.keys(r)) {
      const v = r[k];
      if (v === null || v === undefined) continue;
      const name = (props || []).find((c) => c.toLowerCase() === k.toLowerCase()) || k;
      xml += `    <${name}>${xmlEsc(v instanceof Date ? v.toISOString() : v)}</${name}>\r\n`;
    }
    xml += `  </${tableName}>\r\n`;
  }
  return xml + '</NewDataSet>';
}

/** new Thread(delegate { ... }).Start(): fire-and-forget, errors logged */
function fire(fn) {
  Promise.resolve().then(fn).catch((e) => console.error(e && e.message ? e.message : e));
}

/** DateTime.Now.ToString("dd-MM-yyyy") */
function ddMMyyyy(d = new Date()) {
  const p2 = (n) => String(n).padStart(2, '0');
  return p2(d.getDate()) + '-' + p2(d.getMonth() + 1) + '-' + d.getFullYear();
}

module.exports = {
  DB, NRE, need, s, nz, rep, pick, outv, bindInt, bindDouble, bindDecimal, optInt, toInt32, toInt64, toDouble, toDecimal,
  masterpageshow, view, keepTempData, mapPath, loadSharp, ImageUploadMasterMethod, dataSetGetXml, fire, ddMMyyyy,
};
