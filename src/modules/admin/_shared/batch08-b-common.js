'use strict';
/**
 * Helpers private to admin port batch08 part B (not a router; lives in _shared/ so src/modules/admin.js does not mount it).
 * Exports: decParse(s), intParse(s), outIntOr0(row, name), outDec(row, name)
 */
const B = require('./batch08-common');

/** decimal.Parse(string) (""/null => FormatException / ArgumentNullException) */
function decParse(s) {
  if (s === null || s === undefined) throw new Error('Value cannot be null.');
  const t = String(s).trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) throw new Error('Input string was not in a correct format.');
  return parseFloat(t);
}
/** int.Parse(string) */
function intParse(s) {
  if (s === null || s === undefined) throw new Error('Value cannot be null.');
  const t = String(s).trim();
  if (!/^[-+]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return parseInt(t, 10);
}
/** int.Parse(X.Value.ToString() == "" ? "0" : X.Value.ToString()) for an OUT param returned as a result column (no row => "") */
function outIntOr0(row, name) {
  const s = B.str(B.col(row, name));
  return intParse(s === '' ? '0' : s);
}
/** decimal.Parse(X.Value.ToString()) for an OUT param returned as a result column (DBNull/no row => FormatException) */
const outDec = (row, name) => decParse(B.str(B.col(row, name)));

module.exports = { decParse, intParse, outIntOr0, outDec };
