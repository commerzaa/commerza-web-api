'use strict';
/**
 * Helpers private to admin batch02 (ActivityTeamBonus ... All_Member_List_Paid). Not a router (lives in _shared/).
 * Exports: DB, nint, nstr, nlong, reqInt, toInt32, toDec, outStr, col, view, perms, inlinePerms, excelLink, fmtDate, netDateStr,
 *          n2, nowStamp, tab, cs, excelHistory, tsvDownload, nre, mapRows, mapRow
 */
const fs = require('fs');
const path = require('path');
const db = require('../../../db');
const config = require('../../../config');
const { mapRows, mapRow } = require('../../../utils/shape');
const { errorInsert, legacyUrl } = require('./adminSession');

const DB = 'affiliate';

/** NullReferenceException equivalent */
const nre = () => new Error('Object reference not set to an instance of an object.');

/** int? / long? model binding: missing, empty or invalid => null */
function nint(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}
const nlong = nint;

/** string model binding (ConvertEmptyStringToNull = true) */
const nstr = (v) => (v === undefined || v === null || v === '' ? null : String(v));

/** decimal? model binding */
function ndec(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** non-nullable int action parameter: MVC throws ArgumentException when missing/invalid */
function reqInt(v, name) {
  const n = nint(v);
  if (n === null) {
    const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Int32'`);
    e.status = 500;
    throw e;
  }
  return n;
}

/** Convert.ToInt32(string|object): null => 0, invalid => FormatException */
function toInt32(v) {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return Math.round(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
}

/** Convert.ToDecimal(string|object): null => 0, invalid => FormatException */
function toDec(v) {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (s === '' || !Number.isFinite(Number(s))) throw new Error('Input string was not in a correct format.');
  return Number(s);
}

/** OutputParameter.Value.ToString() (DBNull => "") */
const outStr = (v) => (v === null || v === undefined ? '' : String(v));

/** case-insensitive column read of a pg row */
function col(row, name) {
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k === undefined ? undefined : row[k];
}

/** return View(viewName, Model) => JSON with the view name, Model and every ViewBag value */
function view(res, viewName, Model, ViewBag) {
  const out = { view: viewName };
  if (Model !== undefined) out.Model = Model;
  return res.json({ ...out, ...(ViewBag || {}) });
}

/** CheckPermissions.GetPageActionPermission + GetExcelPermission (BAL) => ViewBag.isactive / isedit / excelactive */
async function perms(url, empId, ViewBag) {
  const CheckPermissions = require('../../../lib/admin/CheckPermissions');
  const p = await CheckPermissions.GetPageActionPermission(url, empId);
  ViewBag.isactive = p._opIsDownloadAllowed;
  ViewBag.isedit = p._opIsEditAllowed;
  ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
}

/** Inline USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out  (Convert.ToInt16(v == "" ? "0" : v)) */
async function inlinePerms(empId, url) {
  const row = await db.procOne(DB, 'USP_GETEXCELPERMISIONSTATUS', { EMPID: empId, HERF: url });
  const e = outStr(col(row, 'excelstatus'));
  const i = outStr(col(row, 'isedit'));
  return { isactive: toInt32(e === '' ? '0' : e), isedit: toInt32(i === '' ? '0' : i) };
}

/** Inline USP_EXCEL_LINK @url,@ISACTIVE out => Convert.ToInt32(v == "0" ? "0" : v) (DBNull => "" => FormatException, like legacy) */
async function excelLink(url) {
  const row = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const v = outStr(col(row, 'isactive'));
  return toInt32(v === '0' ? '0' : v);
}

const p2 = (n) => String(n).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** DateTime.ToString(pattern) for the patterns used by the legacy code (dd, d, MM, M, MMM, yyyy, yy, HH, H, hh, h, mm, ss, tt). Throws on null (non-nullable DateTime). */
function fmtDate(d, pattern) {
  if (d === null || d === undefined || d === '') throw nre();
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) throw new Error('String was not recognized as a valid DateTime.');
  const h12 = x.getHours() % 12 === 0 ? 12 : x.getHours() % 12;
  return pattern.replace(/yyyy|yy|MMM|MM|M|dd|d|HH|H|hh|h|mm|ss|tt|fff/g, (t) => {
    switch (t) {
      case 'yyyy': return String(x.getFullYear());
      case 'yy': return p2(x.getFullYear() % 100);
      case 'MMM': return MON[x.getMonth()];
      case 'MM': return p2(x.getMonth() + 1);
      case 'M': return String(x.getMonth() + 1);
      case 'dd': return p2(x.getDate());
      case 'd': return String(x.getDate());
      case 'HH': return p2(x.getHours());
      case 'H': return String(x.getHours());
      case 'hh': return p2(h12);
      case 'h': return String(h12);
      case 'mm': return p2(x.getMinutes());
      case 'ss': return p2(x.getSeconds());
      case 'tt': return x.getHours() < 12 ? 'AM' : 'PM';
      case 'fff': return String(x.getMilliseconds()).padStart(3, '0');
      default: return t;
    }
  });
}
/** DateTime.ToString() with the server culture (en-US: M/d/yyyy h:mm:ss tt) */
const netDateStr = (d) => fmtDate(d, 'M/d/yyyy h:mm:ss tt');

/** decimal.ToString("0.00") (throws on null like a non-nullable decimal from DBNull) */
function n2(v) {
  if (v === null || v === undefined) throw nre();
  return Number(v).toFixed(2);
}

/** DateTime.Now.ToString("ddMMyyyyhhmmss") */
const nowStamp = () => fmtDate(new Date(), 'ddMMyyyyhhmmss');

/** Regex.Replace(x, "\t", "    ") */
const tab = (v) => String(v).replace(/\t/g, '    ');

/** x.ToString() on a value that may be null (NullReferenceException like legacy) */
function cs(v) {
  if (v === null || v === undefined) throw nre();
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (v instanceof Date) return netDateStr(v);
  return String(v);
}

/** [USP_EXCEL_DOWNLOAD_HISTORY] @ID,@DOWNLOADEDFROM,@FILENAME,@MODE,@STRRESULT OUT */
async function excelHistory(userid, url, Filename, MODE = '1') {
  const row = await db.procOne(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE });
  return outStr(col(row, 'strresult'));
}

/**
 * The legacy "StreamWriter -> ~/AllExcelSheets/<xlsName> -> Response.Redirect" export body (tab separated .xls).
 * opts: { req, res, xlsName ('Growth_Leadership_Bonus.xls'), Filename (DownloadedExcel name without .xls), headers[] (written as "<h> \t"),
 *         rows[], cells(item, w) (writes each cell, may throw), innerProc, outerProc, ViewBag (filled with filepath) }
 * Returns { sent: true } when the download was sent, else { sent: false }.
 * PORT-NOTE: legacy Response.Redirect("~/AllExcelSheets/<xlsName>") threw ThreadAbortException (logged by the catch) BEFORE
 *   File.Copy(filepath, ~/DownloadedExcel/<Filename>.xls) - the copy never happened and is not made here. The file content is
 *   sent directly as the download (Content-Type application/force-download, same file name).
 */
async function tsvDownload(opts) {
  const { req, res, xlsName, Filename, headers, rows, cells, innerProc, outerProc } = opts;
  const ViewBag = opts.ViewBag || {};
  try {
    const dir = path.join(config.uploadDir, 'AllExcelSheets');
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, xlsName);
    ViewBag.filepath = filepath;
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    let out = headers.map((h) => `${h} \t`).join('');
    let closed = false; // StreamWriter closed by the inner catch => every later write throws
    for (const item of rows) {
      try {
        if (closed) throw new Error('Cannot write to a closed TextWriter.');
        out += '\n';
        await cells(item, (x) => { out += x; });
      } catch (ExpObj) {
        if (innerProc) await errorInsert(req, ExpObj, innerProc);
        closed = true; // wr.Close(): the loop goes on, every further item fails (and is logged) the same way
      }
    }
    fs.writeFileSync(filepath, out);
    const dl = path.join(config.uploadDir, 'DownloadedExcel');
    fs.mkdirSync(dl, { recursive: true });
    const filepath1 = path.join(dl, `${Filename}.xls`);
    if (fs.existsSync(filepath1)) fs.unlinkSync(filepath1);
    res.set('Content-Type', 'application/force-download');
    res.set('Content-Disposition', opts.disposition || `attachment; filename=${xlsName}`);
    res.send(out);
    return { sent: true };
  } catch (ExpObj) {
    if (outerProc) await errorInsert(req, ExpObj, outerProc);
    ViewBag.filepath = ExpObj.message;
    return { sent: false };
  }
}

/** "~" + Request.Url.AbsolutePath */
const tildeUrl = (req) => legacyUrl(req);

module.exports = {
  DB, nre, nint, nlong, nstr, ndec, reqInt, toInt32, toDec, outStr, col, view, perms, inlinePerms, excelLink, fmtDate, netDateStr,
  n2, nowStamp, tab, cs, excelHistory, tsvDownload, tildeUrl, mapRows, mapRow,
};
