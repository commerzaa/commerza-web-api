'use strict';
/**
 * Extra helpers private to admin port batch12 worker D (not a router).
 * Exports: trimCaret(s), chkInt32(n), dbNow(), sameUrlPerms(...)
 */
const { nullRef } = require('./batch12_common');

/** string.Trim('^') on a bound string (null => NullReferenceException) */
function trimCaret(s) {
  if (s === null || s === undefined) throw nullRef();
  return String(s).replace(/^\^+|\^+$/g, '');
}
/** Convert.ToInt32(long) (OverflowException outside Int32 range) */
function chkInt32(n) {
  if (n < -2147483648 || n > 2147483647) throw new Error('Value was either too large or too small for an Int32.');
  return n;
}

module.exports = { trimCaret, chkInt32 };
