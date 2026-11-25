'use strict';
/**
 * Private helpers of admin batch04 part B (Change_sponsor .. CommissionWallet_M_M). Not a router (lives in _shared/).
 * Exports: col(row,name), str(v), sp(req,name), ip(req,name), dp(req,name), outVal(rows,name), NRE(), pagePerm(req,url),
 *          excelActive(url), fmtDate(d, fmt), nowStamp(), tab(v), toInt32(v), sendTsv(res, fileName, text)
 */
const CheckPermissions = require('../../../lib/admin/CheckPermissions');

/** case-insensitive column read (PostgreSQL lower-cases names) */
const col = (row, name) => {
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k === undefined ? undefined : row[k];
};
/** object.ToString() with DBNull => "" */
const str = (v) => (v === null || v === undefined ? '' : String(v));
/** string action parameter (MVC binding: missing => null; empty form value => null as MVC ConvertEmptyStringToNull) */
const sp = (req, name) => { const v = req.p[name]; return v === undefined || v === null || v === '' ? null : String(v); };
/** int? action parameter */
const ip = (req, name) => {
  const v = req.p[name];
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};
/** decimal? / double? action parameter */
const dp = (req, name) => {
  const v = req.p[name];
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};
/** OUTPUT parameter of a proc = column of the first result row (lib convention); missing => null */
const outVal = (rows, name) => {
  const r = Array.isArray(rows) ? rows[0] : rows;
  const v = col(r, name);
  return v === undefined ? null : v;
};
/** NullReferenceException equivalent */
const NRE = () => new Error('Object reference not set to an instance of an object.');
/** Convert.ToInt32(string) (FormatException on bad input) */
const toInt32 = (v) => {
  if (typeof v === 'number') return Math.round(v);
  const s = str(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
};

/** CheckPermissions.GetPageActionPermission(url, Empid, out dl, out edit) => {isactive, isedit} */
async function pagePerm(req, url) {
  const r = await CheckPermissions.GetPageActionPermission(url, req.user.emp_id);
  return { isactive: r._opIsDownloadAllowed, isedit: r._opIsEditAllowed };
}
const excelActive = (url) => CheckPermissions.GetExcelPermission(url);

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n) => String(n).padStart(2, '0');
/** .NET DateTime.ToString(fmt) for the tokens used by the legacy code: dd MM MMM yyyy hh HH mm ss tt */
function fmtDate(d, fmt) {
  if (d === null || d === undefined) throw NRE();
  const x = d instanceof Date ? d : new Date(d);
  const h12 = x.getHours() % 12 === 0 ? 12 : x.getHours() % 12;
  return fmt.replace(/yyyy|MMM|MM|M|dd|d|hh|h|HH|H|mm|ss|tt/g, (t) => ({
    yyyy: String(x.getFullYear()), MMM: MON[x.getMonth()], MM: p2(x.getMonth() + 1), M: String(x.getMonth() + 1), dd: p2(x.getDate()),
    d: String(x.getDate()), hh: p2(h12), h: String(h12), HH: p2(x.getHours()), H: String(x.getHours()), mm: p2(x.getMinutes()),
    ss: p2(x.getSeconds()), tt: x.getHours() < 12 ? 'AM' : 'PM',
  })[t]);
}
/** DateTime.ToString() with the en-US culture of the legacy server ("M/d/yyyy h:mm:ss tt") */
const netDefault = (d) => fmtDate(d, 'M/d/yyyy h:mm:ss tt');
/** x.ToString() that throws NullReferenceException on null (legacy `item.X.ToString()`) */
const ts = (v) => { if (v === null || v === undefined) throw NRE(); return v instanceof Date ? netDefault(v) : String(v); };
/** Request.QueryString["name"] (case-insensitive, null when absent) */
const qs = (req, name) => {
  const k = Object.keys(req.query || {}).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k === undefined) return null;
  const v = req.query[k];
  return Array.isArray(v) ? v.join(',') : String(v);
};
/** DateTime.Now.ToString("ddMMyyyyhhmmss") */
const nowStamp = () => fmtDate(new Date(), 'ddMMyyyyhhmmss');
/** Regex.Replace(x, "\t", "    ") */
const tab = (v) => str(v).replace(/\t/g, '    ');

/** Response.AddHeader("content-disposition","attachment;filename=..."); Response.ContentType="application/vnd.ms-excel"; Write(text) */
function sendTsv(res, fileName, text, contentType = 'application/vnd.ms-excel') {
  res.set('Content-Type', contentType);
  res.set('Content-Disposition', `attachment;filename=${fileName}`);
  return res.send(text);
}

/**
 * The legacy "ExportReport" body (StreamWriter to ~/AllExcelSheets/<sheet>.xls, Response.Redirect to it).
 * opts: { req, res, rows, sheet, headers[] (already including the trailing " 	"), row(item, w) (writes cells, may throw),
 *         procName (ErrorInsert name), ViewBag (object to fill: filepath), downloadName? (default `${sheet}.xls`),
 *         noCatch? (no outer catch in legacy: errors propagate),
 *         itemProcName? (legacy per-row try/catch: ErrorInsert(itemProcName) + writer closed, the download still happens),
 *         contentType? (default application/force-download), lineSep? (default "\n") }
 * Returns true when the download was sent. On an exception: ErrorInsert(procName) + ViewBag.filepath = message, nothing sent.
 * PORT-NOTE: Response.Redirect("~/AllExcelSheets/x.xls") threw ThreadAbortException (caught + logged) before File.Copy to
 * ~/DownloadedExcel/<Filename>.xls, so that copy never happened in legacy; it is not made here. The file content is sent directly.
 */
async function exportXls(opts) {
  const fs = require('fs');
  const path = require('path');
  const config = require('../../../config');
  const { errorInsert } = require('./admin-session');
  const { req, res, rows, sheet, headers, row, procName, ViewBag } = opts;
  if (!rows || rows.length === 0) return false;
  try {
    const dir = path.join(config.uploadDir, 'AllExcelSheets');
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, `${sheet}.xls`);
    if (ViewBag) ViewBag.filepath = filepath;
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    let out = headers.join('');
    const sep = opts.lineSep === undefined ? '\n' : opts.lineSep;
    let closed = false; // legacy per-row catch closed the StreamWriter => every later write throws ObjectDisposedException
    for (const item of rows) {
      if (!opts.itemProcName) {
        out += sep;
        await row(item, (x) => { out += x; });
        continue;
      }
      try {
        if (closed) throw new Error('Cannot write to a closed TextWriter.');
        out += sep;
        await row(item, (x) => { out += x; });
      } catch (ExpObj) {
        await errorInsert(req, ExpObj, opts.itemProcName);
        closed = true;
      }
    }
    fs.writeFileSync(filepath, out);
    res.set('Content-Type', opts.contentType || 'application/force-download');
    res.set('Content-Disposition', `attachment; filename=${opts.downloadName || `${sheet}.xls`}`);
    res.send(out);
    return true;
  } catch (ExpObj) {
    if (opts.noCatch) throw ExpObj; // legacy outer try/catch commented out => unhandled (500)
    await errorInsert(req, ExpObj, procName);
    if (ViewBag) ViewBag.filepath = ExpObj.message;
    return false;
  }
}

module.exports = {
  col, str, sp, ip, dp, outVal, NRE, toInt32, pagePerm, excelActive, fmtDate, netDefault, ts, qs, nowStamp, tab, sendTsv, exportXls,
};

/** non-nullable int/long/decimal action parameter: missing/invalid => MVC threw ArgumentException (500) */
function reqNum(req, name, type = 'System.Int32') {
  const v = req.p[name];
  const n = v === undefined || v === null || v === '' ? NaN : Number(v);
  const isInt = /Int/.test(type);
  if (Number.isNaN(n) || (isInt && !Number.isInteger(n))) {
    const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type '${type}'`);
    e.status = 500;
    throw e;
  }
  return n;
}
module.exports.reqNum = reqNum;

/** multer memory storage for HttpPostedFileBase / Request.Files (any field name) */
function upload() {
  const multer = require('multer');
  return multer({ storage: multer.memoryStorage() }).any();
}
/** Request.Files["name"] (case-insensitive field name) or null */
const reqFile = (req, name) => (req.files || []).find((f) => String(f.fieldname).toLowerCase() === String(name).toLowerCase()) || null;
/** DateTime.Now.Ticks.ToString() */
const ticks = () => (BigInt(Date.now()) * 10000n + 621355968000000000n - BigInt(new Date().getTimezoneOffset()) * 600000000n).toString();
/**
 * Dns.GetHostEntry(Dns.GetHostName()).AddressList[1] (the web server's 2nd address, "" when it has only one).
 * PORT-NOTE: approximated with os.networkInterfaces() (non-internal addresses, IPv6 first like Windows' list).
 */
function serverIp() {
  const os = require('os');
  const all = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (!a.internal) all.push(a);
  all.sort((a, b) => (a.family === b.family ? 0 : (a.family === 'IPv6' || a.family === 6 ? -1 : 1)));
  return all.length > 1 ? all[1].address : '';
}
/** DataRow["name"] (ArgumentException when the column does not exist, case-insensitive like DataTable) */
function dtCell(row, name) {
  const k = Object.keys(row || {}).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k === undefined) throw new Error(`Column '${name}' does not belong to table .`);
  return row[k];
}
Object.assign(module.exports, { upload, reqFile, ticks, serverIp, dtCell });
