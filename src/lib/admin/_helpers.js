/** Exports: errorInsert(PROCEDURENAME, ErrorURL, err). Internal helper of the admin lib ports (no C# equivalent). */
'use strict';

/**
 * Equivalent of the legacy catch block
 *   DataUtility ut = new DataUtility(); ut.ErrorInsert(code, ExpObj.Message, PROCEDURENAME, line, ErrorURL);
 * using the ADMIN DataUtility (@Panel = "Admin"). Win32 error code / stack line are not available in JS => 0. Never throws.
 */
async function errorInsert(PROCEDURENAME, ErrorURL, err) {
  try {
    const DataUtility = require('./DataUtility');
    await new DataUtility().ErrorInsert(0, err && err.message ? err.message : String(err), PROCEDURENAME, 0, ErrorURL);
  } catch (e) {
    console.error('[admin errorInsert]', e && e.message);
  }
}

module.exports = { errorInsert };
