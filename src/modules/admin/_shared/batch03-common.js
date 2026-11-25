'use strict';
/**
 * Private helpers of admin port batch03 (not a router; lives in _shared/ so src/modules/admin.js does not mount it).
 * Exports: col(row, name), str(v), toInt32(s), toDecimal(s), sv(v), nint(v), ndec(v), reqInt(v, name), nullRef(), NULLREF, toStr(v), tab(v),
 *          netFormat(d, fmt), netDateStr(d), nowStamp(), excelLink(url), pagePermissions(empId, url),
 *          tsvExport(opts), sendTsvBody(...)
 */
const fs = require('fs');
const path = require('path');
const db = require('../../../db');
const config = require('../../../config');
const { errorInsert } = require('./admin-session');

const DB = 'affiliate';
const NULLREF = 'Object reference not set to an instance of an object.';

/** case-insensitive column read (PostgreSQL returns lower-case columns) */
const col = (row, name) => {
  if (!row) return undefined;
  if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k === undefined ? undefined : row[k];
};
/** OutputParameter.Value.ToString() (DBNull/null => "") */
const str = (v) => (v === null || v === undefined ? '' : (v instanceof Date ? netDateStr(v) : String(v)));
/** MVC string binding: missing / empty => null (ConvertEmptyStringToNull) */
const sv = (v) => (v === undefined || v === null || v === '' ? null : String(v));
/** int?/long?/double? binding: missing / empty / invalid => null */
function nint(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
}
function ndec(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
/** non-nullable value-type binding: missing => MVC threw ArgumentException (500) */
function reqInt(v, name, type = 'System.Int32') {
  const n = type === 'System.Decimal' || type === 'System.Double' ? ndec(v) : nint(v);
  if (n === null) {
    const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type '${type}'`);
    e.status = 500;
    throw e;
  }
  return n;
}
/** Convert.ToInt32(string) / int.Parse: FormatException on non-integer text, null => 0 for Convert.ToInt32((string)null) */
function toInt32(s) {
  if (s === null || s === undefined) return 0;
  const t = String(s).trim();
  if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return parseInt(t, 10);
}
/** Convert.ToDecimal(string): FormatException on non-numeric text */
function toDecimal(s) {
  if (s === null || s === undefined) return 0;
  const t = String(s).trim();
  if (t === '' || !Number.isFinite(Number(t))) throw new Error('Input string was not in a correct format.');
  return Number(t);
}
function nullRef() { throw new Error(NULLREF); }
/** x.ToString() on a value that may be null => NullReferenceException */
function toStr(v) {
  if (v === null || v === undefined) nullRef();
  return v instanceof Date ? netDateStr(v) : String(v);
}
const tab = (v) => String(v).replace(/\t/g, '    '); // Regex.Replace(x, "\t", "    ")

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const p2 = (n) => String(n).padStart(2, '0');
/** DateTime.ToString(fmt) for the tokens used by the legacy code (dd, d, MMMM, MMM, MM, M, yyyy, yy, HH, H, hh, h, mm, ss, tt) */
function netFormat(d, fmt) {
  if (d === null || d === undefined) nullRef();
  const x = d instanceof Date ? d : new Date(d);
  const h12 = x.getHours() % 12 === 0 ? 12 : x.getHours() % 12;
  return fmt.replace(/yyyy|yy|MMMM|MMM|MM|M|dd|d|HH|H|hh|h|mm|ss|tt|fff/g, (t) => {
    switch (t) {
      case 'yyyy': return String(x.getFullYear());
      case 'yy': return p2(x.getFullYear() % 100);
      case 'MMMM': return MONTHS[x.getMonth()];
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
      case 'fff': return String(x.getMilliseconds()).padStart(3, '0');
      case 'tt': return x.getHours() < 12 ? 'AM' : 'PM';
      default: return t;
    }
  });
}
/** DateTime.ToString() with en-US culture */
const netDateStr = (d) => netFormat(d, 'M/d/yyyy h:mm:ss tt');
/** DateTime.Now.ToString("ddMMyyyyhhmmss") */
const nowStamp = () => netFormat(new Date(), 'ddMMyyyyhhmmss');

/** USP_EXCEL_LINK @url,@ISACTIVE out => Convert.ToInt32(v == "0" ? "0" : v) (DBNull => "" => FormatException, like legacy) */
async function excelLink(url) {
  const row = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const v = str(col(row, 'isactive'));
  const n = parseInt(v === '0' ? '0' : v, 10);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
}

/** USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out  => Convert.ToInt16(v == "" ? "0" : v) */
async function pagePermissions(empId, url) {
  const row = await db.procOne(DB, 'USP_GETEXCELPERMISIONSTATUS', { EMPID: empId, HERF: url });
  const e = str(col(row, 'excelstatus'));
  const i = str(col(row, 'isedit'));
  return { isactive: parseInt(e === '' ? '0' : e, 10), isedit: parseInt(i === '' ? '0' : i, 10) };
}

/**
 * Legacy "StreamWriter -> ~/AllExcelSheets/<sheet> ; copy to ~/DownloadedExcel/<Filename>.xls ; Response.Redirect" export.
 * opts: { req, res, sheet: 'All_Ticket_List.xls', attachName (content-disposition filename, default sheet), headers: [exact header strings
 *         incl. their trailing ' \t' / '\t'], rows, cells: async (item, w) => void (writes cell text, may throw like .ToString() on null),
 *         ViewBag (optional: receives filepath / error message like the legacy ViewBag.filepath), innerProc: PROCEDURENAME logged by the per-row catch, outerProc: PROCEDURENAME logged by the outer catch, closeOnRowError: true }
 * Returns true when the download was written to `res`.
 * PORT-NOTE: legacy Response.Redirect("~/AllExcelSheets/<sheet>") threw ThreadAbortException before File.Copy(filepath, filepath1),
 * so the DownloadedExcel copy never happened; the file is still written to <uploadDir>/AllExcelSheets and its content is sent directly.
 */
async function tsvExport(opts) {
  const { req, res, sheet, rows, cells, innerProc, outerProc } = opts;
  const headers = opts.headers || [];
  const closeOnRowError = opts.closeOnRowError !== false;
  try {
    const dir = path.join(config.uploadDir, 'AllExcelSheets');
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, sheet);
    if (opts.ViewBag) opts.ViewBag.filepath = filepath; // ViewBag.filepath = filepath (only some controllers)
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    let out = headers.join('');
    let closed = false; // StreamWriter closed by the per-row catch => every further write throws ObjectDisposedException
    for (const item of rows) {
      try {
        if (closed) throw new Error('Cannot write to a closed TextWriter.');
        out += '\n';
        await cells(item, (x) => { out += x; });
      } catch (ExpObj) {
        await errorInsert(req, ExpObj, innerProc);
        if (closeOnRowError) closed = true;
      }
    }
    fs.writeFileSync(filepath, out);
    if (opts.filename) {
      const dl = path.join(config.uploadDir, 'DownloadedExcel');
      fs.mkdirSync(dl, { recursive: true });
      const filepath1 = path.join(dl, `${opts.filename}.xls`);
      // legacy: if exists { File.Delete; File.Open(OpenOrCreate).Close() } => leaves an empty file
      if (fs.existsSync(filepath1)) { fs.unlinkSync(filepath1); fs.writeFileSync(filepath1, ''); }
    }
    res.set('Content-Type', 'application/force-download');
    res.set('Content-Disposition', `attachment; filename=${opts.attachName || sheet}`);
    res.send(out);
    return true;
  } catch (ExpObj) {
    if (res.headersSent) return true;
    await errorInsert(req, ExpObj, outerProc);
    if (opts.ViewBag) opts.ViewBag.filepath = ExpObj.message; // ViewBag.filepath = ExpObj.Message
    return false;
  }
}

module.exports = {
  DB, NULLREF, col, str, toInt32, toDecimal, sv, nint, ndec, reqInt, nullRef, toStr, tab, netFormat, netDateStr, nowStamp, excelLink, pagePermissions, tsvExport,
};
