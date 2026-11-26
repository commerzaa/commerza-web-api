'use strict';
/**
 * Helpers private to admin port batch13-11 (not a router; lives in _shared/ so src/modules/admin.js does not mount it).
 * Exports: decOf(rows, name), int0Of(rows, name), excelLinkObj(url), noSpace(item, name), viewJson(res, view, Model, ViewBag),
 *          sendVoid(res, r), FORMAT_ERR
 */
const db = require('../../../db');
const { DB, col, str, cellStr } = require('./batch11-common');

const FORMAT_ERR = 'Input string was not in a correct format.';

/** decimal.Parse(<OUT param>.Value.ToString()) on a row-returning proc (DBNull => "" => FormatException).
 *  PORT-NOTE: with no rows PG cannot return the OUT value => 0. */
function decOf(rows, name) {
  if (!rows || !rows[0]) return 0;
  const s = str(col(rows[0], name)).trim();
  if (s === '' || Number.isNaN(Number(s))) throw new Error(FORMAT_ERR);
  return Number(s);
}

/** Convert.ToInt32(v.ToString() == "" ? "0" : v.ToString()) on a row-returning proc OUT param (no rows => 0). */
function int0Of(rows, name) {
  if (!rows || !rows[0]) return 0;
  let s = str(col(rows[0], name)).trim();
  if (s === '') s = '0';
  if (!/^[-+]?\d+(\.0+)?$/.test(s)) throw new Error(FORMAT_ERR);
  return parseInt(s, 10);
}

/** USP_EXCEL_LINK @url,@ISACTIVE out => Convert.ToInt32(spOutput.Value) (object overload: DBNull => InvalidCastException) */
async function excelLinkObj(url) {
  const row = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const v = col(row, 'isactive');
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  return Math.round(Number(v));
}

/** item.X.ToString().Replace(" ", string.Empty) (null => NullReferenceException) */
const noSpace = (item, name) => cellStr(item, name).split(' ').join('');

/** return View(view, Model) => JSON with the ViewBag values */
const viewJson = (res, view, Model, ViewBag) => res.json({ view, Model: Model === undefined ? null : Model, ...ViewBag });

/** public void ExportReport(...) called as an action: empty response unless the download was sent */
function sendVoid(res, r) {
  if (r && r.sent) return undefined;
  if (!res.headersSent) res.send('');
  return undefined;
}

module.exports = { decOf, int0Of, excelLinkObj, noSpace, viewJson, sendVoid, FORMAT_ERR };
