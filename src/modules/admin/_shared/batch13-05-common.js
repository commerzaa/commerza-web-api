'use strict';
/**
 * Helpers private to admin port batch13-05 (ROIRate, RollupBonus, Royality_*, RoyalityAchivers, RoyalityIncome, Royalty_Reward,
 * SalaryIncome, Setting). Not a router (lives in _shared/ so src/modules/admin.js does not mount it).
 * Exports: decOutOf(rows, name), strOutIntOf(rows, name), nullableDateStr(v), writeXlsFile(opts), copyToDownloaded(req, sheet, Filename, procName),
 *          moneyLiteral(v)
 */
const fs = require('fs');
const path = require('path');
const config = require('../../../config');
const { errorInsert } = require('./admin-session');
const { col, str, cvtDec, cvtInt, netDateString } = require('./batch06-common');

/** decimal.Parse(<OUT param>.Value.ToString()) on a row-returning proc (DBNull => "" => FormatException).
 *  PORT-NOTE: with no rows PostgreSQL cannot return the OUT value => 0 (SQL Server returned the proc's computed total). */
function decOutOf(rows, name) {
  if (!rows || rows.length === 0) return 0;
  const s = str(col(rows[0], name));
  if (s === '') throw new Error('Input string was not in a correct format.');
  return cvtDec(s);
}

/** Convert.ToInt32(<varchar OUT param>.Value.ToString()) (DBNull => "" => FormatException).
 *  PORT-NOTE: with no rows PostgreSQL cannot return the OUT value => 0. */
function strOutIntOf(rows, name) {
  if (!rows || rows.length === 0) return 0;
  const s = str(col(rows[0], name)).trim();
  if (s === '') throw new Error('Input string was not in a correct format.');
  return cvtInt(s);
}

/** Nullable<DateTime>.ToString(): null => "" (no exception), else DateTime.ToString() */
function nullableDateStr(v) {
  if (v === null || v === undefined) return '';
  return v instanceof Date ? netDateString(v) : String(v);
}

/**
 * Tab-separated ".xls" written with a StreamWriter to Server.MapPath(relPath) and NOT sent (legacy had no Response.Redirect).
 * opts: { req, relPath ('AllExcelSheets/x.xls' or 'x.xls'), headers: string[] (each written as "<h> \t"), rows, cells(item, w),
 *         innerProc, outerProc, ViewBag }
 */
async function writeXlsFile(opts) {
  const { req, relPath, headers, rows, cells, innerProc, outerProc, ViewBag = {} } = opts;
  try {
    const filepath = path.join(config.uploadDir, relPath);
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    ViewBag.filepath = filepath;
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    let out = headers.map((h) => `${h} \t`).join('');
    let closed = false; // StreamWriter closed by the inner catch => later writes throw ObjectDisposedException
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
  } catch (ExpObj) {
    if (outerProc) await errorInsert(req, ExpObj, outerProc);
    ViewBag.filepath = ExpObj.message;
  }
}

/** System.IO.File.Copy(~/AllExcelSheets/<sheet>, ~/DownloadedExcel/<Filename>.xls) for exports that copied BEFORE Response.Redirect. */
async function copyToDownloaded(req, sheet, Filename, procName) {
  try {
    const src = path.join(config.uploadDir, 'AllExcelSheets', sheet);
    const dir = path.join(config.uploadDir, 'DownloadedExcel');
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(src, path.join(dir, `${Filename}.xls`));
  } catch (ExpObj) {
    if (procName) await errorInsert(req, ExpObj, procName);
  }
}

/** SQL Server implicit varchar -> money conversion ("" => 0, numeric text => number, anything else => conversion error). */
function moneyLiteral(v) {
  const s = v === null || v === undefined ? '' : String(v).trim();
  if (s === '') return 0;
  if (!/^[-+]?\$?(\d+(,\d{3})*(\.\d*)?|\.\d+)$/.test(s)) {
    const e = new Error('Cannot convert a char value to money. The char value has incorrect syntax.');
    e.status = 500;
    throw e;
  }
  return Number(s.replace(/[$,]/g, ''));
}

module.exports = { decOutOf, strOutIntOf, nullableDateStr, writeXlsFile, copyToDownloaded, moneyLiteral };
