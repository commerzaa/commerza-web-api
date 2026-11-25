'use strict';
/**
 * Batch04 (part A) private helpers for the MLM_Adminpanel controller ports. Not a router (lives in _shared/).
 * Exports: s(v), ni(v), reqInt(v, name), col(row, name), str(v), toInt32(v), netStr(v), nowStamp(), tab(v),
 *          permissions(url, empId) (CheckPermissions BAL), inlinePermissions(empId, url) (inline USP_GETEXCELPERMISIONSTATUS + USP_EXCEL_LINK),
 *          excelHistory(userid, url, Filename), sendTsv({...}), jTokStr(v), parseJObject(text), DYNAMIC_PAGING(), tdSet/tdPeek/tdGet (TempData),
 *          netDateStr(d), cvtInt(v), sendJson(res, data), inlinePermissionsExcelFirst(empId, url)
 */
const fs = require('fs');
const path = require('path');
const db = require('../../../db');
const config = require('../../../config');
const { errorInsert } = require('./adminSession');

const DB = 'affiliate';

/** MVC string binding: missing or "" => null (ConvertEmptyStringToNull). */
const s = (v) => (v === undefined || v === null || v === '' ? null : String(v));

/** int? binding: missing / empty / invalid => null */
function ni(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

/** non-nullable int action parameter: MVC throws ArgumentException (=> HTTP 500) when it is missing/invalid. */
function reqInt(v, name, type = 'System.Int32') {
  const n = ni(v);
  if (n === null) {
    const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type '${type}'`);
    e.status = 500;
    throw e;
  }
  return n;
}

const col = (row, name) => {
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? undefined : row[k];
};
/** OutputParameter.Value.ToString() (DBNull => "") */
const str = (v) => (v === null || v === undefined ? '' : (v instanceof Date ? v.toISOString() : String(v)));

/** Convert.ToInt32(string): "" / invalid => FormatException */
function toInt32(v) {
  const t = str(v).trim();
  if (!/^[-+]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return parseInt(t, 10);
}

/** x.ToString() on a value that may be null => NullReferenceException */
function netStr(v) {
  if (v === null || v === undefined) throw new Error('Object reference not set to an instance of an object.');
  return v instanceof Date ? v.toISOString() : String(v);
}

const p2 = (n) => String(n).padStart(2, '0');
/** DateTime.Now.ToString("ddMMyyyyhhmmss") */
function nowStamp() {
  const x = new Date();
  const h = x.getHours() % 12 === 0 ? 12 : x.getHours() % 12;
  return `${p2(x.getDate())}${p2(x.getMonth() + 1)}${x.getFullYear()}${p2(h)}${p2(x.getMinutes())}${p2(x.getSeconds())}`;
}

const tab = (v) => String(v).replace(/\t/g, '    '); // Regex.Replace(x, "\t", "    ")

/** Convert.ToInt16(ConfigurationManager.AppSettings["DynamicPagging"]) (null => 0) */
const DYNAMIC_PAGING = () => {
  const v = config.app.DynamicPagging;
  return v === undefined || v === null || v === '' ? 0 : toInt32(v);
};

/** CheckPermissions.GetPageActionPermission + GetExcelPermission (BAL). */
async function permissions(url, empId) {
  const CheckPermissions = require('../../../lib/admin/CheckPermissions');
  const perm = await CheckPermissions.GetPageActionPermission(url, empId);
  return {
    isactive: perm._opIsDownloadAllowed,
    isedit: perm._opIsEditAllowed,
    excelactive: await CheckPermissions.GetExcelPermission(url),
  };
}

/** Inline legacy copy: USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out ; USP_EXCEL_LINK @url,@ISACTIVE out */
async function inlinePermissions(empId, url) {
  const row = await db.procOne(DB, 'USP_GETEXCELPERMISIONSTATUS', { EMPID: empId, HERF: url });
  const e = str(col(row, 'excelstatus'));
  const i = str(col(row, 'isedit'));
  const out = { isactive: toInt32(e === '' ? '0' : e), isedit: toInt32(i === '' ? '0' : i) };
  const r2 = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const v = str(col(r2, 'isactive'));
  out.excelactive = toInt32(v === '0' ? '0' : v);
  return out;
}

/** [USP_EXCEL_DOWNLOAD_HISTORY] @ID,@DOWNLOADEDFROM,@FILENAME,@MODE,@STRRESULT OUT */
async function excelHistory(userid, url, Filename) {
  return db.procOne(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
}

/**
 * Legacy StreamWriter export to ~/AllExcelSheets/<sheet> + Response.Redirect to it.
 * opts: { req, res, sheet ('Btc_Withdrawal.xls'), Filename, headers[] (written as `${h} \t`), rows, cells(item, w) (may throw),
 *         rowErrProc, outerErrProc, ViewBag, contentType? (default 'application/force-download'), downloadName? (default sheet),
 *         headerRaw? (string written instead of headers) }
 * Returns { sent: true } or { sent: false } (ViewBag.filepath set to the error message on failure).
 * PORT-NOTE: Response.Redirect("~/AllExcelSheets/...") ended the request (ThreadAbortException, logged by the legacy outer catch) before
 *   File.Copy(filepath, ~/DownloadedExcel/<Filename>.xls) => no copy is made; the written file is sent as the download instead of a redirect.
 */
async function sendTsv(opts) {
  const { req, res, sheet, headers, rows, cells, rowErrProc, outerErrProc, ViewBag = {} } = opts;
  try {
    const dir = path.join(config.uploadDir, 'AllExcelSheets');
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, sheet);
    ViewBag.filepath = filepath;
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    let out = opts.headerRaw !== undefined ? opts.headerRaw : headers.map((h) => `${h} \t`).join('');
    let closed = false; // wr.Close() in the per-row catch => every following write throws ObjectDisposedException
    for (const item of rows) {
      try {
        if (closed) throw new Error('Cannot write to a closed TextWriter.');
        if (!opts.noRowNewline) out += '\n';
        await cells(item, (x) => { out += x; });
      } catch (ExpObj) {
        await errorInsert(req, ExpObj, rowErrProc);
        closed = true;
      }
    }
    fs.writeFileSync(filepath, out);
    const dl = path.join(config.uploadDir, 'DownloadedExcel');
    fs.mkdirSync(dl, { recursive: true });
    if (opts.Filename) {
      const filepath1 = path.join(dl, `${opts.Filename}.xls`);
      if (fs.existsSync(filepath1)) fs.unlinkSync(filepath1);
    }
    res.set('Content-Type', opts.contentType || 'application/force-download');
    res.set('Content-Disposition', `attachment; filename=${opts.downloadName || sheet}`);
    res.send(out);
    return { sent: true };
  } catch (ExpObj) {
    if (res.headersSent) return { sent: true };
    await errorInsert(req, ExpObj, outerErrProc);
    ViewBag.filepath = ExpObj.message;
    return { sent: false };
  }
}

/** Newtonsoft JToken.ToString(): strings raw, null => "", objects/arrays indented JSON, bools "True"/"False". */
function jTokStr(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
}

/** JObject.Parse(text): throws unless text is a JSON object. */
function parseJObject(text) {
  const o = JSON.parse(text);
  if (o === null || typeof o !== 'object' || Array.isArray(o)) throw new Error('Error reading JObject from JsonReader.');
  return o;
}

module.exports = {
  s, ni, reqInt, col, str, toInt32, netStr, nowStamp, tab, DYNAMIC_PAGING, permissions, inlinePermissions, excelHistory, sendTsv,
  jTokStr, parseJObject,
};

// ---------------------------------------------------------------- TempData (MVC) emulation on top of sessionStore
// PORT-NOTE: TempData values live in sessionStore key 'TempData' (per admin); tdGet() removes the value like a TempData read
// (MVC kept it until the end of the request; reads in the same request see the same value through tdPeek()).
const sessionStore = require('../../../utils/sessionStore');
function tdSet(req, k, v) {
  const o = { ...(sessionStore.get(req, 'TempData') || {}) };
  if (v === null || v === undefined) delete o[k]; else o[k] = v;
  sessionStore.set(req, 'TempData', o);
}
function tdPeek(req, k) {
  const o = sessionStore.get(req, 'TempData') || {};
  return o[k] === undefined ? null : o[k];
}
function tdGet(req, k) {
  const v = tdPeek(req, k);
  if (v !== null) tdSet(req, k, null);
  return v;
}
module.exports.tdSet = tdSet;
module.exports.tdPeek = tdPeek;
module.exports.tdGet = tdGet;

/** DateTime.ToString() with the en-US culture: "M/d/yyyy h:mm:ss tt" (null => NullReferenceException like a DBNull DateTime) */
function netDateStr(d) {
  if (d === null || d === undefined) throw new Error('Object reference not set to an instance of an object.');
  const x = d instanceof Date ? d : new Date(d);
  const h = x.getHours() % 12 === 0 ? 12 : x.getHours() % 12;
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getMonth() + 1}/${x.getDate()}/${x.getFullYear()} ${h}:${pad(x.getMinutes())}:${pad(x.getSeconds())} ${x.getHours() < 12 ? 'AM' : 'PM'}`;
}
/** Convert.ToInt32(string) / Convert.ToInt64(string): null => 0, otherwise Int.Parse (FormatException) */
function cvtInt(v) {
  if (v === null || v === undefined) return 0;
  const t = String(v).trim();
  if (!/^[-+]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return parseInt(t, 10);
}
/** Json(null) => MVC JsonResult writes nothing */
const sendJson = (res, data) => (data === null || data === undefined ? res.type('application/json').send('') : res.json(data));
module.exports.netDateStr = netDateStr;
module.exports.cvtInt = cvtInt;
module.exports.sendJson = sendJson;
/** Same as inlinePermissions but in the order USP_EXCEL_LINK first, then USP_GETEXCELPERMISIONSTATUS (as some legacy actions did). */
async function inlinePermissionsExcelFirst(empId, url) {
  const r2 = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const v = str(col(r2, 'isactive'));
  const out = { excelactive: toInt32(v === '0' ? '0' : v) };
  const row = await db.procOne(DB, 'USP_GETEXCELPERMISIONSTATUS', { EMPID: empId, HERF: url });
  const e = str(col(row, 'excelstatus'));
  const i = str(col(row, 'isedit'));
  out.isactive = toInt32(e === '' ? '0' : e);
  out.isedit = toInt32(i === '' ? '0' : i);
  return out;
}
module.exports.inlinePermissionsExcelFirst = inlinePermissionsExcelFirst;
