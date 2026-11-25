'use strict';
/**
 * Helpers private to admin port batch13-09 (not a router; lives in _shared/ so src/modules/admin.js does not mount it).
 * Exports: supplied(params), outIntStrict(rows, name), outDecStrict(rows, name), toBool(v), csSubstring(s, start, len),
 *          imageFromStream(buf), tsvFile(opts), errorViewMsg(req, res, err, procName, extra), getFileName(p), body(req, name),
 *          XLS_DIR, DL_DIR
 */
const fs = require('fs');
const path = require('path');
const config = require('../../../config');
const { errorInsert } = require('./admin-session');
const { col, str, nullRef } = require('./batch11-common');

const XLS_DIR = () => path.join(config.uploadDir, 'AllExcelSheets');
const DL_DIR = () => path.join(config.uploadDir, 'DownloadedExcel');

/**
 * new SqlParameter("@x", null) => ADO.NET treats a null (not DBNull) value as "parameter not supplied", so the proc default applies.
 * PORT-NOTE: keys whose value is null/undefined are dropped so the PostgreSQL function default is used, like the legacy call.
 */
function supplied(params) {
  const out = {};
  for (const k of Object.keys(params)) if (params[k] !== null && params[k] !== undefined) out[k] = params[k];
  return out;
}

/** Convert.ToInt32 / Int64.Parse / int.Parse(spOutput.Value.ToString()) without "" guard: DBNull => FormatException.
 *  PORT-NOTE: a row-returning PG function cannot return its OUT value without rows => 0 when no row came back. */
function outIntStrict(rows, name) {
  if (!rows || !rows.length) return 0;
  const s = str(col(rows[0], name)).trim();
  if (!/^[-+]?\d+(\.0+)?$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
}
/** decimal.Parse(spOutput.Value.ToString()) (same no-row remark as outIntStrict) */
function outDecStrict(rows, name) {
  if (!rows || !rows.length) return 0;
  const s = str(col(rows[0], name)).trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseFloat(s);
}

/** Convert.ToBoolean(string): null => false; "true"/"false" (case-insensitive, trimmed) else FormatException */
function toBool(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'true') return true;
  if (s === 'false') return false;
  throw new Error('String was not recognized as a valid Boolean.');
}

/** C# string.Substring(start, length) (throws when out of range) */
function csSubstring(s, start, len) {
  if (start < 0 || len < 0 || start + len > s.length) throw new RangeError('Index and length must refer to a location within the string.');
  return s.substr(start, len);
}

/** System.Drawing.Image.FromStream(ms): ArgumentException on non-image data.
 *  PORT-NOTE: System.Drawing is not available; the image type is sniffed from the magic bytes (src/lib/Save_ImageFile.IsValidImage). */
function imageFromStream(b) {
  const Save_ImageFile = require('../../../lib/Save_ImageFile');
  if (!Save_ImageFile.IsValidImage(b)) throw new Error('Parameter is not valid.');
  return b;
}

/** System.IO.Path.GetFileName (null => null) */
const getFileName = (p) => (p === null || p === undefined ? null : path.basename(String(p).replace(/\\/g, '/')));

/** FormCollection["x"] (form body only, case-insensitive) */
function body(req, name) {
  const b = req.body || {};
  const k = Object.keys(b).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k === undefined ? null : b[k];
}

/**
 * Legacy tab-separated ".xls" StreamWriter export.
 * opts: { req, res, ViewBag, filepath (absolute), header (string written first), rows, cells(item, w) (async ok),
 *         innerProc (ErrorInsert name of the per-row catch, null => catch without ErrorInsert),
 *         outerProc (ErrorInsert name of the outer catch, null => none), outerSetsFilepath (default true),
 *         copyFilename (Filename => delete ~/DownloadedExcel/<Filename>.xls like the legacy code),
 *         download (null => the legacy code only wrote the file, no response; else the attachment file name) }
 * Returns { sent } (true when the download was written to res).
 * PORT-NOTE: legacy Response.Redirect(<the .xls>) => the file content is sent as an attachment directly; the File.Copy to
 * ~/DownloadedExcel after Response.Redirect never ran in legacy (thread aborted), so it is not done here either.
 */
async function tsvFile(opts) {
  const { req, res, ViewBag = {}, filepath, header, rows, cells, innerProc, outerProc } = opts;
  try {
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    ViewBag.filepath = filepath;
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    let out = header;
    let closed = false; // StreamWriter closed in the per-row catch => every later write throws ObjectDisposedException
    for (const item of rows) {
      try {
        if (closed) throw new Error('Cannot write to a closed TextWriter.');
        await cells(item, (x) => { out += x; });
      } catch (ExpObj) {
        if (innerProc) await errorInsert(req, ExpObj, innerProc);
        closed = true;
      }
    }
    fs.writeFileSync(filepath, out);
    if (opts.copyFilename) {
      const filepath1 = path.join(DL_DIR(), `${opts.copyFilename}.xls`);
      if (fs.existsSync(filepath1)) fs.unlinkSync(filepath1);
    }
    if (!opts.download) return { sent: false };
    res.set('Content-Type', 'application/force-download');
    res.set('Content-Disposition', `attachment; filename=${opts.download}`);
    res.send(out);
    return { sent: true };
  } catch (ExpObj) {
    if (res.headersSent) return { sent: true };
    if (outerProc) await errorInsert(req, ExpObj, outerProc);
    if (opts.outerSetsFilepath !== false) ViewBag.filepath = ExpObj.message;
    return { sent: false };
  }
}

/** catch block: ErrorInsert + (optional ViewBag.ErrorMessage) + return View("~/Views/PageNotFound/Index.cshtml") */
async function errorViewMsg(req, res, err, procName, extra = {}) {
  if (res.headersSent) return undefined;
  await errorInsert(req, err, procName);
  return res.json({ view: '~/Views/PageNotFound/Index.cshtml', ...extra });
}

/** Convert.FromBase64String(s) (strict, no prefix stripping; whitespace ignored like .NET) */
function fromBase64(s) {
  if (s === null || s === undefined) {
    const e = new Error("Value cannot be null.\r\nParameter name: s"); e.name = 'ArgumentNullException'; throw e;
  }
  const t = String(s).replace(/[\s]/g, '');
  if (t.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(t)) {
    throw new Error('The input is not a valid Base-64 string as it contains a non-base 64 character, more than two padding characters, or an illegal character among the padding characters.');
  }
  return Buffer.from(t, 'base64');
}

/** item.X.ToString() where X is a non-nullable value type / string (null => NullReferenceException) */
function req2(v) {
  if (v === null || v === undefined) throw nullRef();
  return v;
}

module.exports = {
  supplied, outIntStrict, outDecStrict, toBool, csSubstring, imageFromStream, tsvFile, errorViewMsg, getFileName, body, req2, fromBase64,
  XLS_DIR, DL_DIR,
};
