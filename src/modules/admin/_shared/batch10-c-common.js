'use strict';
/**
 * Helpers private to admin port batch10 part C (not a router; lives in _shared/ so src/modules/admin.js does not mount it).
 * Exports: outDecRaw(rows, name), outRaw(rows, name)
 */
const { col } = require('./batch10-common');

/** <decimal OUT SqlParameter>.Value of a row-returning proc as the view received it.
 *  PORT-NOTE: ADO.NET decimal OUT params declared without Scale come back rounded to scale 0 (kept: Math.round);
 *  DBNull / no rows (PG cannot return OUT values without a row) => null. */
function outDecRaw(rows, name) {
  const v = col(rows && rows[0], name);
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? v : Math.round(n);
}
/** <OUT SqlParameter>.Value (no rows / DBNull => null) */
function outRaw(rows, name) {
  const v = col(rows && rows[0], name);
  return v === undefined ? null : v;
}
module.exports = { outDecRaw, outRaw };
