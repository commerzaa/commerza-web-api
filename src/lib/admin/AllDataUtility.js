/** Exports (C# BAL/AllDataUtility.cs `public class AllDataUtility`, MLM Admin, database 'affiliate' (DataBaseContext = Db_Affiliate)):
 *   class AllDataUtility (instance, all methods async):
 *     constructor(ObjDBC?)            ; ObjPopDataBaseContext (get/set, kept for parity: the database name 'affiliate')
 *     ExecuteSql(sqlQuery) : int                                                         (rows affected)
 *     ExecuteSqlSpWithOneOutputParam(arrParam, procName, outPutParamIndex) : string     (arrParam[outPutParamIndex].Value.ToString() when index > 0, else "")
 *     IsExist(sqlQuery) : bool                                                          (first column of first row > 0)
 *     IsExistSpWithoutOutput(arrParam, procName) : bool                                 (first column of first row > 0)
 *     IsExistSpWithOutput(arrParam, procName, outPutParamIndex) : bool                  (Convert.ToInt32(arrParam[outPutParamIndex].Value) > 0 when index > 0)
 *     GetList(value, arrParam, procName) : row[]                                        (SqlQuery<T>; pass an array of PascalCase property names as `value`
 *                                                                                         to get mapRows(rows, value), otherwise raw lower-case rows)
 *   arrParam = array of { ParameterName: '@X', Value, Direction: 'Input'|'Output'|'InputOutput' } (use DataUtility.SqlParameter(name, value, direction)).
 *   procName = the legacy EF command text, e.g. "USP_X @A,@B,@OUT out" (the procedure name is its first token; the parameters are taken from arrParam,
 *   bound by name) or a SELECT/WITH statement with @name placeholders (run as SQL).
 * After a call, Output / InputOutput parameters get their .Value set from the (lower-case) column of the procedure's first result row,
 * like SqlParameter.Value after ExecuteSqlCommand.
 * No Member/API equivalent exists => ported.
 * PORT-NOTE: raw SQL passed to ExecuteSql / IsExist must be PostgreSQL-compatible (callers convert the legacy T-SQL).
 * PORT-NOTE: the finalizer (~AllDataUtility => Dispose) has no equivalent (pooled connections).
 */
'use strict';
const { query, exec, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');

const DB = 'affiliate';

const isOut = (p) => p && (p.Direction === 'Output' || p.Direction === 'InputOutput' || p.Direction === 2 || p.Direction === 3);
const pname = (p) => String(p.ParameterName).replace(/^@/, '').trim();

function inputArgs(arrParam) {
  const args = {};
  for (const p of arrParam || []) {
    if (p.Direction === 'Output' || p.Direction === 2) continue;
    args[pname(p)] = p.Value;
  }
  return args;
}

/** Runs EF-style command text; returns the result rows and writes OUT values back into arrParam. */
async function runCommand(arrParam, procName) {
  const text = String(procName).trim();
  let rows;
  if (/^(select|with)\b/i.test(text)) {
    rows = await query(DB, text, inputArgs(arrParam));
  } else {
    const name = text.split(/\s+/)[0].replace(/[\[\]]/g, '').replace(/^dbo\./i, '');
    rows = await proc(DB, name, inputArgs(arrParam));
  }
  const first = rows[0];
  for (const p of arrParam || []) {
    if (!isOut(p)) continue;
    let v = null;
    if (first) {
      const k = Object.keys(first).find((x) => x.toLowerCase() === pname(p).toLowerCase());
      if (k !== undefined) v = first[k];
    }
    p.Value = v; // DBNull when the procedure did not return it
  }
  return rows;
}

function firstInt(rows) { // SqlQuery<Int32>(...).FirstOrDefault()
  const r = rows[0];
  if (!r) return 0;
  const v = r[Object.keys(r)[0]];
  if (v === null || v === undefined) throw new Error('The cast to value type \'System.Int32\' failed because the materialized value is null.');
  return Number(v);
}

function toInt32(v) { // Convert.ToInt32(object): null => 0, DBNull => InvalidCastException
  if (v === undefined) return 0;
  if (v === null) throw new Error('Object cannot be cast from DBNull to other types.');
  if (typeof v === 'boolean') return v ? 1 : 0;
  const t = String(v).trim();
  if (!/^[+-]?\d+(\.\d+)?$/.test(t)) throw new Error('Input string was not in a correct format.');
  return Math.round(Number(t));
}

class AllDataUtility {
  constructor(ObjDBC) {
    // Both legacy constructors ignore the argument and create a new DataBaseContext.
    this._ObjDBC = DB;
  }

  get ObjPopDataBaseContext() { return this._ObjDBC; }
  set ObjPopDataBaseContext(value) { this._ObjDBC = value; }

  async ExecuteSql(sqlQuery) {
    const intResult = await exec(DB, sqlQuery, {});
    return intResult;
  }

  async ExecuteSqlSpWithOneOutputParam(arrParam, procName, outPutParamIndex) {
    let STRRESULT = '';
    await runCommand(arrParam, procName);
    if (outPutParamIndex > 0) {
      const v = arrParam[outPutParamIndex].Value;
      STRRESULT = v === null || v === undefined ? '' : String(v);
    }
    return STRRESULT;
  }

  async IsExist(sqlQuery) {
    const IntResult = firstInt(await query(DB, sqlQuery, {}));
    if (IntResult > 0) return true;
    return false;
  }

  async IsExistSpWithoutOutput(arrParam, procName) {
    const IntResult = firstInt(await runCommand(arrParam, procName));
    if (IntResult > 0) return true;
    return false;
  }

  async IsExistSpWithOutput(arrParam, procName, outPutParamIndex) {
    let IntResult = 0;
    await runCommand(arrParam, procName);
    if (outPutParamIndex > 0) {
      IntResult = toInt32(arrParam[outPutParamIndex].Value);
    }
    if (IntResult > 0) return true;
    return false;
  }

  async GetList(value, arrParam, procName) {
    const rows = await runCommand(arrParam, procName);
    return Array.isArray(value) ? mapRows(rows, value) : rows;
  }
}

module.exports = AllDataUtility;
