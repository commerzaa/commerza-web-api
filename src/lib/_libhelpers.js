'use strict';
/**
 * Internal helpers shared by the DAL lib ports (not a port of a C# file).
 * Exports: out(row, name), errorInsert(procName, errorUrl, err), fire(fn), isDbError(err),
 *          withFallback(primary, fn), procFallback(primaryDb, name, params), replaceAll(str, find, repl), toStr(v)
 */
const db = require('../db');

/** Reads an OUTPUT parameter from the single result row of a stored procedure (lower-case column). */
function out(row, name) {
  if (!row) return null;
  const key = String(name).toLowerCase();
  if (key in row) return row[key];
  const keys = Object.keys(row);
  return keys.length === 1 ? row[keys[0]] : null;
}

/** C# string.Replace (replaces ALL occurrences, literal match, no $ patterns). */
function replaceAll(str, find, repl) {
  return String(str).split(find).join(repl === null || repl === undefined ? '' : String(repl));
}

/** C# ToStringOrEmpty extension */
function toStr(v) {
  return v === null || v === undefined ? '' : String(v);
}

/** Equivalent of the legacy "DataUtility ut = new DataUtility(); ut.ErrorInsert(code, msg, proc, line, url)" block. Never throws. */
async function errorInsert(procName, errorUrl, err) {
  try {
    const DataUtility = require('./DataUtility');
    const ut = new DataUtility();
    await ut.ErrorInsert(0, err && err.message ? err.message : String(err), procName, 0, errorUrl);
  } catch (e) {
    console.error('[errorInsert]', e && e.message);
  }
}

/** Equivalent of "new Thread(delegate(){...}).Start()": runs fn in the background, errors are only logged. */
function fire(fn) {
  Promise.resolve()
    .then(fn)
    .catch((e) => console.error('[background task]', e && e.message));
}

/** True when the error originates from the database driver (legacy SqlException). */
function isDbError(e) {
  if (!e) return false;
  const code = String(e.code || '');
  return !!(e.severity || e.sql || /^[0-9A-Z]{5}$/.test(code) || /^E[A-Z]+$/.test(code));
}

/**
 * Legacy DataBaseContext pointed at Db_Affiliate, but a few procedures / tables only exist in the Db_Shopping
 * schema dump. Tries the primary database and, when the function/table does not exist there (42883 / 42P01 / 42703),
 * retries on the other one.
 */
async function withFallback(primary, fn) {
  const other = primary === 'affiliate' ? 'shopping' : 'affiliate';
  try {
    return await fn(primary);
  } catch (e) {
    if (e && (e.code === '42883' || e.code === '42P01' || e.code === '42703')) return fn(other);
    throw e;
  }
}
const procFallback = (primary, name, params) => withFallback(primary, (d) => db.proc(d, name, params));

module.exports = { out, errorInsert, fire, isDbError, withFallback, procFallback, replaceAll, toStr };
