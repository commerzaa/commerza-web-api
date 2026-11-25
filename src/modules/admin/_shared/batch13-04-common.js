'use strict';
/**
 * Helpers private to admin port batch13-04 (Report_Refrence_For_All_Report ... ROI_Status). Not a router (lives in _shared/).
 * Re-exports everything of batch02-common and adds:
 *   outRaw(rows, name)          OUT parameter value of a row-returning proc (undefined when the proc returned no row)
 *   outParseInt(rows, name)     int.Parse(spOutput.Value.ToString())  (DBNull => FormatException; no row => 0, PORT-NOTE)
 *   outParseIntZ(rows, name)    int.Parse(v == "" ? "0" : v)
 *   outParseDec(rows, name)     decimal.Parse(<Decimal OUT>.Value.ToString()) (scale-0 rounding of ADO.NET, see PORT-NOTE)
 *   nz(v)                       Nullable<T>.ToString() (null => "")
 *   reqDouble(v, name)          non-nullable double / decimal action parameter (missing => 500 like MVC model binding)
 *   fmtErr()                    FormatException
 */
const B = require('./batch02-common');

const fmtErr = () => new Error('Input string was not in a correct format.');

function outRaw(rows, name) {
  if (!rows || !rows.length) return undefined;
  return B.col(rows[0], name);
}

/** PORT-NOTE: a PostgreSQL function cannot return its OUT values when it returns no row => treated as 0. */
function outParseInt(rows, name) {
  const v = outRaw(rows, name);
  if (v === undefined) return 0;
  const s = B.outStr(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw fmtErr();
  return parseInt(s, 10);
}
function outParseIntZ(rows, name) {
  const v = outRaw(rows, name);
  if (v === undefined) return 0;
  const s = B.outStr(v);
  const t = (s === '' ? '0' : s).trim();
  if (!/^[+-]?\d+$/.test(t)) throw fmtErr();
  return parseInt(t, 10);
}
/**
 * decimal.Parse / Convert.ToDecimal of a SqlDbType.Decimal OUTPUT parameter declared without Precision/Scale.
 * PORT-NOTE: ADO.NET returns such OUT values with scale 0 (rounded to an integer); reproduced with Math.round.
 * DBNull => "" => FormatException. No row => 0 (see outParseInt).
 */
function outParseDec(rows, name) {
  const v = outRaw(rows, name);
  if (v === undefined) return 0;
  const s = B.outStr(v).trim();
  if (s === '' || !Number.isFinite(Number(s))) throw fmtErr();
  return Math.round(Number(s));
}

/** Nullable<T>.ToString(): null => "" */
function nz(v) {
  if (v === null || v === undefined) return '';
  return B.cs(v);
}

/** non-nullable double/decimal action parameter */
function reqDouble(v, name, type = 'System.Double') {
  if (v !== undefined && v !== null && v !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type '${type}'`);
  e.status = 500;
  throw e;
}

/**
 * batch02 tsvDownload with an optional `rawHeaders` string (written verbatim instead of headers.map(h => h + " \t")),
 * for legacy exports whose header cells were not all written as "<h> \t". Same contract / PORT-NOTE as batch02 tsvDownload.
 */
async function tsvDownload(opts) {
  if (opts.rawHeaders === undefined) return B.tsvDownload(opts);
  const fs = require('fs');
  const path = require('path');
  const config = require('../../../config');
  const { errorInsert } = require('./admin-session');
  const { req, res, xlsName, Filename, rows, cells, innerProc, outerProc } = opts;
  const ViewBag = opts.ViewBag || {};
  try {
    const dir = path.join(config.uploadDir, 'AllExcelSheets');
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, xlsName);
    ViewBag.filepath = filepath;
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    let out = opts.rawHeaders;
    let closed = false;
    for (const item of rows) {
      try {
        if (closed) throw new Error('Cannot write to a closed TextWriter.');
        out += '\n';
        await cells(item, (x) => { out += x; });
      } catch (ExpObj) {
        if (innerProc) await errorInsert(req, ExpObj, innerProc);
        closed = true;
      }
    }
    fs.writeFileSync(filepath, out);
    const dl = path.join(config.uploadDir, 'DownloadedExcel');
    fs.mkdirSync(dl, { recursive: true });
    const filepath1 = path.join(dl, `${Filename}.xls`);
    if (fs.existsSync(filepath1)) fs.unlinkSync(filepath1);
    res.set('Content-Type', 'application/force-download');
    res.set('Content-Disposition', `attachment; filename=${xlsName}`);
    res.send(out);
    return { sent: true };
  } catch (ExpObj) {
    if (outerProc) await errorInsert(req, ExpObj, outerProc);
    ViewBag.filepath = ExpObj.message;
    return { sent: false };
  }
}

module.exports = { ...B, fmtErr, outRaw, outParseInt, outParseIntZ, outParseDec, nz, reqDouble, tsvDownload };
