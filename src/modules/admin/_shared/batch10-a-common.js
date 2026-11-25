'use strict';
/**
 * Helpers private to admin port batch10 part A (not a router; lives in _shared/ so src/modules/admin.js does not mount it).
 * Exports: writeXlsFile(opts), dynPaging(), intParseOut(rows, name)
 */
const fs = require('fs');
const path = require('path');
const config = require('../../../config');
const { errorInsert } = require('./admin-session');
const { mapPath, cvtInt, col, str } = require('./batch10-common');

/**
 * Legacy StreamWriter export that only WRITES the tab-separated file (no Response.Redirect / download).
 * opts: { req, file ('~/memberreplyticket.xls'), rawHeaders, rows, cells(item, w), innerProc, closeOnInnerError (default true) }
 * Throws whatever the writer throws (callers wrap it in their own legacy try/catch).
 */
async function writeXlsFile(opts) {
  const { req, file, rawHeaders, rows, cells, innerProc } = opts;
  const filepath = mapPath(file);
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  let out = rawHeaders;
  let closed = false;
  for (const item of rows) {
    if (innerProc === undefined) { // no per-row try/catch in legacy
      await cells(item, (x) => { out += x; });
      continue;
    }
    try {
      if (closed) throw new Error('Cannot write to a closed TextWriter.');
      await cells(item, (x) => { out += x; });
    } catch (ExpObj) {
      await errorInsert(req, ExpObj, innerProc);
      closed = true;
    }
  }
  fs.writeFileSync(filepath, out);
  return filepath;
}

/** Convert.ToInt16(ConfigurationManager.AppSettings["DynamicPagging"]) (missing => 0) */
const dynPaging = () => cvtInt(config.app.DynamicPagging);

/** int.Parse(OUT.Value.ToString() == "" ? "0" : OUT.Value.ToString()) on a row-returning proc (no row => 0) */
function intParseOut(rows, name) {
  const s = str(col(rows && rows[0], name));
  const t = s === '' ? '0' : s;
  if (!/^\s*[-+]?\d+\s*$/.test(t)) throw new Error('Input string was not in a correct format.');
  return parseInt(t, 10);
}

module.exports = { writeXlsFile, dynPaging, intParseOut };
