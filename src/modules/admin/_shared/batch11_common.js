'use strict';
/**
 * Helpers private to admin port batch11 (copied from batch10_common.js) (not a router; lives in _shared/ so src/modules/admin.js does not mount it).
 * Exports: DB, view(name), nInt(v), nDec(v), nStr(v), reqInt(v, name), col(row, name), str(v), cellStr(item, name), tab(v),
 *          nowStamp(), netFormat(date, fmt), netDateString(d), dec2(v), outInt(row, name), outStr(row, name),
 *          perms(req, url), excelHistory(userid, url, Filename), writeXlsExport(opts), errorView(req, res, err, procName),
 *          splitCsv(v), nullRef(), cvtInt(v), cvtDec(v), at(arr, i), reqDec(v, name), mapPath(x), decodeBase64Image(s),
 *          saveScaledImage(buf, fullPath), cleanName(v)
 */
const fs = require('fs');
const path = require('path');
const db = require('../../../db');
const config = require('../../../config');
const { errorInsert } = require('./adminSession');

const DB = 'affiliate';

const view = (name) => `~/Views/${name}`;

/** int? / long? model binding: missing / empty / invalid => null */
function nInt(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}
/** decimal? model binding */
function nDec(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
/** string model binding (MVC ConvertEmptyStringToNull => '' becomes null) */
function nStr(v) {
  if (v === undefined || v === null || v === '') return null;
  if (Array.isArray(v)) return v.join(',');
  return String(v);
}
/** non-nullable int action parameter: missing => ArgumentException (500) like MVC */
function reqInt(v, name) {
  const n = nInt(v);
  if (n === null) {
    const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Int32'`);
    e.status = 500;
    throw e;
  }
  return n;
}

const col = (row, name) => {
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k === undefined ? undefined : row[k];
};
/** OutputParameter.Value.ToString() (DBNull => "") */
const str = (v) => (v === null || v === undefined ? '' : (v instanceof Date ? netDateString(v) : String(v)));
const nullRef = () => new Error('Object reference not set to an instance of an object.');
/** item.X.ToString() (throws NullReferenceException on null, like the legacy model property) */
function cellStr(item, name) {
  const v = col(item, name);
  if (v === null || v === undefined) throw nullRef();
  return v instanceof Date ? netDateString(v) : String(v);
}
const tab = (v) => String(v).replace(/\t/g, '    '); // Regex.Replace(x, "\t", "    ")

const p2 = (n) => String(n).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Minimal .NET DateTime.ToString(fmt): dd d MMM MM M yyyy yy HH H hh h mm ss tt fff */
function netFormat(d, fmt) {
  if (d === null || d === undefined || d === '') throw nullRef();
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) throw new Error('String was not recognized as a valid DateTime.');
  const H = x.getHours();
  const h12 = H % 12 === 0 ? 12 : H % 12;
  const map = {
    yyyy: String(x.getFullYear()), yy: p2(x.getFullYear() % 100), MMM: MON[x.getMonth()], MM: p2(x.getMonth() + 1), M: String(x.getMonth() + 1),
    dd: p2(x.getDate()), d: String(x.getDate()), HH: p2(H), H: String(H), hh: p2(h12), h: String(h12), mm: p2(x.getMinutes()),
    ss: p2(x.getSeconds()), tt: H < 12 ? 'AM' : 'PM', fff: String(x.getMilliseconds()).padStart(3, '0'),
  };
  return fmt.replace(/yyyy|yy|MMM|MM|M|dd|d|HH|H|hh|h|mm|ss|tt|fff/g, (t) => map[t]);
}
/** DateTime.ToString() with the server culture.
 * PORT-NOTE: legacy server culture unknown; en-US "M/d/yyyy h:mm:ss tt" is used. */
const netDateString = (d) => netFormat(d, 'M/d/yyyy h:mm:ss tt');
/** DateTime.Now.ToString("ddMMyyyyhhmmss") */
const nowStamp = () => netFormat(new Date(), 'ddMMyyyyhhmmss');
/** decimal.ToString("0.00") */
function dec2(v) {
  if (v === null || v === undefined) throw nullRef();
  return Number(v).toFixed(2);
}
/** Convert.ToInt32(spOutput.Value.ToString()) on an OUT param returned as a result column (DBNull/"" => FormatException) */
function outInt(row, name) {
  const s = str(col(row, name));
  const n = parseInt(s, 10);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
}
const outStr = (row, name) => str(col(row, name));
/** Convert.ToInt32(<decimal OUT param>.Value.ToString()): scale-0 decimal OUT => rounded integer string; DBNull => FormatException */
function decOutToInt(row, name) {
  const v = col(row, name);
  if (v === null || v === undefined || v === '') throw new Error('Input string was not in a correct format.');
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return Math.round(n);
}

/** CheckPermissions.GetPageActionPermission + GetExcelPermission => ViewBag.isactive / isedit / excelactive */
async function perms(empId, url) {
  const CheckPermissions = require('../../../lib/admin/CheckPermissions');
  const p = await CheckPermissions.GetPageActionPermission(url, empId);
  const out = { isactive: p._opIsDownloadAllowed, isedit: p._opIsEditAllowed };
  out.excelactive = await CheckPermissions.GetExcelPermission(url);
  return out;
}

/** [USP_EXCEL_DOWNLOAD_HISTORY] @ID,@DOWNLOADEDFROM,@FILENAME,@MODE,@STRRESULT OUT */
async function excelHistory(userid, url, Filename) {
  return db.procOne(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
}

/**
 * The legacy tab-separated ".xls" export (StreamWriter to ~/AllExcelSheets/<sheet>, Response.Redirect to it).
 * opts: { req, res, sheet ('Payit_Forward_List.xls'), headers: string[] (each written as "<h> \t"), rows, cells(item, w) (async ok),
 *         innerProc (ErrorInsert name of the per-row catch), outerProc (ErrorInsert name of the outer catch), ViewBag (receives filepath),
 *         downloadName (default sheet), headerSuffix (default ' \t') }
 * Returns { sent: true } when the download was written to `res`.
 */
async function writeXlsExport(opts) {
  const { req, res, sheet, headers, rows, cells, innerProc, outerProc, ViewBag = {}, rawHeaders } = opts;
  try {
    const dir = path.join(config.uploadDir, 'AllExcelSheets');
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, sheet);
    if (opts.setFilepath !== false) ViewBag.filepath = filepath; // (DateWiseLability never set it)
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    let out = rawHeaders !== undefined ? rawHeaders : headers.map((h) => `${h} \t`).join('');
    let closed = false; // StreamWriter closed by the inner catch => every later write throws ObjectDisposedException
    for (const item of rows) {
      try {
        if (closed) throw new Error('Cannot write to a closed TextWriter.');
        await cells(item, (x) => { out += x; }); // written piece by piece: partial lines are kept, like the StreamWriter
      } catch (ExpObj) {
        if (innerProc) await errorInsert(req, ExpObj, innerProc);
        closed = true;
      }
    }
    if (opts.trailer) { // rows written after the loop (a writer closed by the per-row catch makes them throw => outer catch)
      if (closed) throw new Error('Cannot write to a closed TextWriter.');
      await opts.trailer((x) => { out += x; });
    }
    fs.writeFileSync(filepath, out);
    // PORT-NOTE: legacy Response.Redirect("~/AllExcelSheets/<sheet>") aborted the request thread before File.Copy(...) to
    // ~/DownloadedExcel/<Filename>.xls, so that copy never happened (only the old copy was deleted); the content is sent directly.
    if (opts.Filename) {
      const dl = path.join(config.uploadDir, 'DownloadedExcel');
      fs.mkdirSync(dl, { recursive: true });
      const filepath1 = path.join(dl, `${opts.Filename}.xls`);
      if (fs.existsSync(filepath1)) fs.unlinkSync(filepath1);
    }
    res.set('Content-Type', 'application/force-download');
    res.set('Content-Disposition', `attachment; filename=${opts.downloadName || sheet}`);
    res.send(out);
    return { sent: true };
  } catch (ExpObj) {
    if (res.headersSent) return { sent: true };
    if (outerProc) await errorInsert(req, ExpObj, outerProc);
    ViewBag.filepath = ExpObj.message;
    return { sent: false };
  }
}

/** catch block: "#region For ErrorInsert" + return View("~/Views/PageNotFound/Index.cshtml") */
async function errorView(req, res, err, procName) {
  if (res.headersSent) return undefined;
  await errorInsert(req, err, procName);
  return res.json({ view: '~/Views/PageNotFound/Index.cshtml' });
}

/** Convert.ToInt32(string) / Convert.ToInt64(string): null => 0, invalid => FormatException */
function cvtInt(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Math.round(v);
  const s = String(v).trim();
  if (!/^[-+]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
}
/** Convert.ToDecimal(string): null => 0, invalid => FormatException */
function cvtDec(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseFloat(s);
}
/** non-nullable decimal action parameter: missing / invalid => model binding error (500) like MVC */
function reqDec(v, name) {
  const n = nDec(v);
  if (n === null) {
    const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Decimal'`);
    e.status = 500;
    throw e;
  }
  return n;
}

/** Server.MapPath(x) => config.uploadDir/<x without ~ and leading slashes> */
function mapPath(x) {
  return path.join(config.uploadDir, String(x === null || x === undefined ? '' : x).replace(/^~/, '').replace(/^[\\/]+/, ''));
}

/** Convert.FromBase64String after stripping a "data:...;base64," prefix (throws FormatException on invalid input) */
function decodeBase64Image(base64String) {
  let s = String(base64String);
  if (s.includes('base64,')) s = s.substring(s.indexOf(',') + 1);
  const t = s.replace(/\s/g, '');
  if (t.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(t)) {
    throw new Error('The input is not a valid Base-64 string as it contains a non-base 64 character, more than two padding characters, or an illegal character among the padding characters.');
  }
  return Buffer.from(t, 'base64');
}

/**
 * Legacy System.Drawing upload block: Image.FromStream(b); if filesize > 10 KB => GetThumbnailImage(newWidth,newHeight) saved as JPEG
 * (300px box keeping the scaled ratio, see C# "radio" maths), else img.Save(path) (original bytes/format).
 * PORT-NOTE: System.Drawing replaced by sharp (lazy require).
 */
async function saveScaledImage(b, strValidFullName) {
  const sharp = require('sharp');
  const meta = await sharp(b).metadata(); // Image.FromStream (throws on invalid image)
  const filesize = b.length / 1024;
  const W = meta.width; const H = meta.height;
  let newWidth = 0; let newHeight = 0;
  const scaleFactor = 0.5;
  let newWidth1 = Math.trunc(W * scaleFactor);
  let newHeight1 = Math.trunc(H * scaleFactor);
  const radio = newWidth1 / newHeight1;
  fs.mkdirSync(path.dirname(strValidFullName), { recursive: true });
  if (filesize > 10) {
    newWidth = 300; newHeight = 300;
    if (radio === 1) {
      newWidth1 = W * scaleFactor; if (newWidth1 > 300) newWidth1 = 300;
      newHeight1 = H * scaleFactor; if (newHeight1 > 300) newHeight1 = 300;
      newHeight = Math.trunc(newHeight1); newWidth = Math.trunc(newWidth1);
    }
    if (radio < 1) { newHeight = 300; newWidth1 = 300; newWidth1 *= radio; newWidth = Math.trunc(newWidth1); }
    if (radio > 1) { newWidth = 300; newHeight1 = 300; newHeight1 /= radio; newHeight = Math.trunc(newHeight1); }
    if (radio === 1) { newWidth = 300; newHeight = 300; }
    const jpeg = await sharp(b).resize(Math.max(newWidth, 1), Math.max(newHeight, 1), { fit: 'fill' }).jpeg().toBuffer();
    fs.writeFileSync(strValidFullName, jpeg);
  } else {
    fs.writeFileSync(strValidFullName, b);
  }
}

/** ProfileImage cleaning used by the legacy upload blocks */
function cleanName(v) {
  if (v === null || v === undefined) throw nullRef();
  let s = String(v).trim();
  s = s.split('&amp;').join('And');
  s = s.split('&').join(' And ');
  s = s.replace(/[^\w\d]/g, '');
  return s.replace(/ /g, '-');
}

/** array[i] with IndexOutOfRangeException */
function at(arr, i) {
  if (!arr || i >= arr.length || i < 0) throw new Error('Index was outside the bounds of the array.');
  return arr[i];
}

/** string.Split(',') of a bound value (null => NullReferenceException) */
function splitCsv(v, sep = ',') {
  if (v === null || v === undefined) throw nullRef();
  return String(v).split(sep);
}

module.exports = {
  DB, view, nInt, nDec, nStr, reqInt, col, str, cellStr, tab, nowStamp, netFormat, netDateString, dec2, outInt, outStr, perms,
  excelHistory, writeXlsExport, errorView, splitCsv, nullRef, cvtInt, cvtDec, at, reqDec, mapPath,
  decodeBase64Image, saveScaledImage, cleanName, decOutToInt,
};

/** OUTPUT parameter of a row-returning proc (the PG function repeats it as a column of every row); no row => '' */
const outOf = (rows, name) => str(col(rows && rows[0], name));
/** int.Parse(spOutput.Value.ToString()) on a row-returning proc. PORT-NOTE: with no rows PG cannot return the OUT value => 0. */
function outIntOf(rows, name) {
  const s = outOf(rows, name);
  if (s === '') return 0;
  const n = parseInt(s, 10);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
}
/** SqlQuery<T>(...).FirstOrDefault() for a scalar T: first column of the first row (null when no row) */
const firstCol = (rows) => (rows && rows[0] ? rows[0][Object.keys(rows[0])[0]] : null);
/** standard string action-parameter read with "null => ''" defaulting */
const s0 = (v) => { const x = nStr(v); return x === null ? '' : x; };

module.exports.outOf = outOf;
module.exports.outIntOf = outIntOf;
module.exports.firstCol = firstCol;
module.exports.s0 = s0;

/** Inline USP_EXCEL_LINK @url,@ISACTIVE out => Convert.ToInt32(v == "0" ? "0" : v) (DBNull => "" => FormatException, like legacy) */
async function excelLink(url) {
  const row = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  return cvtIntStrict(outStr(row, 'isactive'));
}
/** Inline USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out => Convert.ToInt16(v == "" ? "0" : v) */
async function inlinePerms(empId, url) {
  const row = await db.procOne(DB, 'USP_GETEXCELPERMISIONSTATUS', { EMPID: empId, HERF: url });
  const e = outStr(row, 'excelstatus');
  const i = outStr(row, 'isedit');
  return { isactive: cvtIntStrict(e === '' ? '0' : e), isedit: cvtIntStrict(i === '' ? '0' : i) };
}
/** Convert.ToInt32(string) where "" => FormatException */
function cvtIntStrict(s) {
  const t = String(s).trim();
  if (!/^[-+]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return parseInt(t, 10);
}
module.exports.excelLink = excelLink;
module.exports.inlinePerms = inlinePerms;
module.exports.cvtIntStrict = cvtIntStrict;

/** non-nullable Int64 action parameter */
function reqLong(v, name) {
  const n = nInt(v);
  if (n === null) {
    const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Int64'`);
    e.status = 500;
    throw e;
  }
  return n;
}
module.exports.reqLong = reqLong;

/** int.Parse(<decimal OUT param>.Value.ToString()) on a row-returning proc. PORT-NOTE: ADO.NET decimal OUT params without Scale come back
 *  rounded to scale 0 (so int.Parse succeeded); no rows => PG cannot return the OUT value => 0. */
function decOutIntOf(rows, name) {
  const v = col(rows && rows[0], name);
  if (v === undefined) return 0;
  if (v === null || v === '') throw new Error('Input string was not in a correct format.');
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return Math.round(n);
}
/** string.Trim() on a bound string (null => NullReferenceException) */
function trimS(v) {
  if (v === null || v === undefined) throw nullRef();
  return String(v).trim();
}
/** bool action parameter (non-nullable): "true"/"false" (case-insensitive) */
module.exports.decOutIntOf = decOutIntOf;
module.exports.trimS = trimS;
