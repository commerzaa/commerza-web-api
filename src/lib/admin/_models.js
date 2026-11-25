'use strict';
/**
 * Internal helpers for the MLM_Adminpanel Models ports (not a port of a C# file).
 * Exports:
 *   defineModel(name, table, defaults, notMapped?) : class   - C# entity / view-model class replacement:
 *       new X(init?) -> object with every C# property (C# default values: numbers 0, bool false, string/Nullable/DateTime null)
 *       X.PROPS  : string[]  PascalCase property names in declaration order (use with mapRows/mapRow)
 *       X.TABLE  : string|null  PostgreSQL table name from [Table("dbo.X")] (lower-case, schema dropped)
 *       X.NOT_MAPPED : string[]  [NotMapped] properties (not columns of TABLE)
 *       X.map(row) / X.mapAll(rows) : mapRow / mapRows with PROPS, returning plain objects (null for no row); [NotMapped] props get their default
 *   errorInsert(code, message, procName, line, url) : Promise<void>   legacy "DataUtility ut = new DataUtility(); ut.ErrorInsert(...)" (never throws)
 *   out(row, name) : OUTPUT parameter value from a proc result row
 *   DB : 'affiliate'  (legacy DataBaseContext => Db_Affiliate)
 * PORT-NOTE: C# DateTime (non-nullable) defaults to DateTime.MinValue; here it defaults to null.
 */
const { mapRow, mapRows } = require('../../utils/shape');
const { out } = require('../_libhelpers');

const DB = 'affiliate';

function defineModel(name, table, defaults, notMapped) {
  const props = Object.keys(defaults);
  const C = {
    [name]: class {
      constructor(init) {
        for (const p of props) this[p] = defaults[p];
        if (init) Object.assign(this, init);
      }
    },
  }[name];
  C.PROPS = props;
  C.TABLE = table || null;
  C.NOT_MAPPED = notMapped || [];
  // EF never materialises [NotMapped] properties: they keep their C# default value
  const nm = C.NOT_MAPPED;
  const fix = (o) => { if (o) for (const p of nm) o[p] = defaults[p]; return o; };
  C.map = (row) => fix(mapRow(row, props));
  C.mapAll = (rows) => mapRows(rows, props).map(fix);
  return C;
}

async function errorInsert(code, message, procName, line, url) {
  try {
    const DataUtility = require('./DataUtility');
    const ut = typeof DataUtility === 'function' && DataUtility.prototype && DataUtility.prototype.ErrorInsert ? new DataUtility() : DataUtility;
    await ut.ErrorInsert(code, message, procName, line, url);
  } catch (e) {
    console.error('[admin errorInsert]', e && e.message);
  }
}

module.exports = { defineModel, errorInsert, out, DB };
