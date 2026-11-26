'use strict';
/**
 * Helpers private to admin port batch13-08 (not a router; lives in _shared/ so src/modules/admin.js does not mount it).
 * Exports: viewRes(res, view, Model, ViewBag, extra), dynPaging(), outStrictInt(rows, name), outStrictDec(rows, name),
 *          drStr(row, name), cvtInt32Obj(v), netLongDate(d), rnd(min, max), legacyBase64Bytes(base64String),
 *          loadImage(buf), saveImageAsIs(buf, fullPath), execSpRow(arrParam, spName), D100(col), rootLoginId(), fireAndForget(fn)
 */
const fs = require('fs');
const path = require('path');
const db = require('../../../db');
const config = require('../../../config');
const { DB, col, str, nullRef, decodeBase64Image, netFormat } = require('./batch11-common');

/** return View("<view>", Model) => JSON with the view name, the model and every ViewBag value */
function viewRes(res, view, Model, ViewBag = {}, extra = {}) {
  const out = { view };
  if (Model !== undefined) out.Model = Model;
  return res.json({ ...out, ...ViewBag, ...extra });
}

/** Convert.ToInt16(ConfigurationManager.AppSettings["DynamicPagging"]) (null => 0, invalid => FormatException, > Int16 => OverflowException) */
function dynPaging() {
  const value = config.app.DynamicPagging;
  if (value === undefined || value === null) return 0;
  const s = String(value).trim();
  if (!/^[-+]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  const n = parseInt(s, 10);
  if (n > 32767 || n < -32768) throw new Error('Value was either too large or too small for an Int16.');
  return n;
}

/** int.Parse(spOutput.Value.ToString()) without the "" => "0" guard (DBNull => FormatException).
 *  PORT-NOTE: with no result rows PG cannot return the OUT value => 0. */
function outStrictInt(rows, name) {
  if (!rows || rows.length === 0) return 0;
  const s = str(col(rows[0], name)).trim();
  if (!/^[-+]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
}
/** decimal.Parse(spOutput.Value.ToString()) (DBNull => FormatException). PORT-NOTE: no rows => 0. */
function outStrictDec(rows, name) {
  if (!rows || rows.length === 0) return 0;
  const s = str(col(rows[0], name)).trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) throw new Error('Input string was not in a correct format.');
  return Number(s);
}

/** DataRow["X"].ToString(): missing column => ArgumentException, DBNull => "", DateTime => DateTime.ToString() */
function drStr(row, name) {
  if (!row) throw new Error('There is no row at position 0.');
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k === undefined) throw new Error(`Column '${name}' does not belong to table .`);
  return str(row[k]);
}

/** Convert.ToInt32(object) on a DataRow value: DBNull => InvalidCastException, decimal => banker's rounding, string => Int32.Parse */
function cvtInt32Obj(v) {
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  if (typeof v === 'string' && !/^\s*[-+]?(\d+\.?\d*|\.\d+)\s*$/.test(v)) throw new Error('Input string was not in a correct format.');
  // pg numeric comes back as text: treated like the decimal column it was (Convert.ToInt32(decimal) => round half to even)
  const n = Number(v);
  const f = Math.floor(n);
  const diff = n - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** DateTime.Now.ToString("dddd MMMM dd yyyy hh:mm tt") (en-US) */
function netLongDate(d = new Date()) {
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${netFormat(d, 'dd yyyy hh:mm tt')}`;
}

/** new Random().Next(min, max) */
const rnd = (min, max) => min + Math.floor(Math.random() * (max - min));

/**
 * Legacy upload block: if (base64String.Contains("base64,")) { ImageExt = Substring(IndexOf("/")+1, IndexOf(";")-...); base64String = after ","; }
 * b = Convert.FromBase64String(base64String)
 */
function legacyBase64Bytes(base64String) {
  if (base64String === null || base64String === undefined) throw nullRef();
  let s = String(base64String);
  if (s.includes('base64,')) {
    const IndexNo = s.indexOf('/') + 1;
    const lastIndexNo = s.indexOf(';');
    if (lastIndexNo - IndexNo < 0) throw new Error('Length cannot be less than zero.\r\nParameter name: length');
    s = s.substring(s.indexOf(',') + 1);
  }
  return decodeBase64Image(s);
}

/** System.Drawing.Image.FromStream(ms) => { width, height } (throws "Parameter is not valid." on non-images).
 *  PORT-NOTE: System.Drawing replaced by sharp (lazy require). */
async function loadImage(buf) {
  const sharp = require('sharp');
  try {
    const meta = await sharp(buf).metadata();
    return { width: meta.width, height: meta.height, format: meta.format };
  } catch (e) {
    throw new Error('Parameter is not valid.');
  }
}

/** img.Save(strValidFullName) of an image loaded from a stream: GDI+ re-saves in the image's own raw format => original bytes. */
function saveImageAsIs(buf, fullPath) {
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, buf);
}

/** DataUtility.ExecuteSqlSP(param, sp) that also exposes the other OUT params (int.Parse(@intResult) like the lib). */
async function execSpRow(args, spName) {
  const row = await db.procOne(DB, spName, args);
  const v = str(col(row, 'intresult')).trim();
  if (!/^[-+]?\d+$/.test(v)) throw new Error('Input string was not in a correct format.');
  return { ret: parseInt(v, 10), row };
}

/** CONVERT(VARCHAR(30), x, 100) => "Mon dd yyyy hh:miAM" (day and hour space padded) */
const D100 = (c) => `(to_char(${c}, 'Mon') || ' ' || lpad(to_char(${c}, 'FMDD'), 2, ' ') || ' ' || to_char(${c}, 'YYYY') || ' ' || lpad(to_char(${c}, 'FMHH12'), 2, ' ') || ':' || to_char(${c}, 'MIAM'))`;

/** db._Member_Master.Where(a => a.regNo == 1).FirstOrDefault(); loginid = row == null ? "" : row.userName */
async function rootLoginId() {
  const row = await db.queryOne(DB, 'select username from member_master where regno = 1 limit 1', {});
  return row ? (col(row, 'username') === undefined ? null : col(row, 'username')) : '';
}

/** new Thread(delegate { ... }).Start() => fire-and-forget (errors only logged) */
function fireAndForget(fn) {
  Promise.resolve().then(fn).catch((e) => console.error('[admin] background thread failed:', e.message));
}

module.exports = {
  viewRes, dynPaging, outStrictInt, outStrictDec, drStr, cvtInt32Obj, netLongDate, rnd, legacyBase64Bytes, loadImage, saveImageAsIs,
  execSpRow, D100, rootLoginId, fireAndForget,
};
