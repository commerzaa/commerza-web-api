'use strict';
/**
 * Exports (instance class, use `new DataUtility()`):
 *   class DataUtility
 *     async ErrorInsert(Errorcode:int, Description:string, PROCEDURENAME:string, Errorline:int, ErrorURL:string) : void
 *     async ExecuteSqlSP(arrParam:SqlParameter[], strSPName:string) : int   (returns @intResult output)
 *     async ExecuteSql(strSql:string) : int                                  (affected rows)
 *     static SqlParameter(ParameterName, Value, Direction?) -> helper replacing System.Data.SqlClient.SqlParameter
 *       (Direction 'Output' => output parameter, not sent to the procedure; its value is read from the result row)
 */
const { proc, exec } = require('../db');

class DataUtility {
  /** Replacement for `new SqlParameter(name, value)` (+ `.Direction = ParameterDirection.Output`). */
  static SqlParameter(ParameterName, Value, Direction) {
    return { ParameterName, Value, Direction: Direction || 'Input' };
  }

  // Legacy: Cart_Entity => Db_Shopping, [DBO].[SP_ERRORLOG_FrontEND]
  async ErrorInsert(Errorcode, Description, PROCEDURENAME, Errorline, ErrorURL) {
    await proc('shopping', 'sp_errorlog_frontend', {
      number: Errorcode,
      description: Description,
      procedurename: PROCEDURENAME,
      errorline: Errorline,
      url: ErrorURL,
      panel: 'Member',
    });
  }

  // Legacy: SqlConnection(AppSettings["ConnectionString"]) => Db_Affiliate
  async ExecuteSqlSP(arrParam, strSPName) {
    const args = {};
    let outName = null;
    for (const p of arrParam) {
      const name = String(p.ParameterName).replace(/^@/, '').trim();
      if (p.Direction === 'Output' || p.Direction === 2) {
        if (name.toLowerCase() === 'intresult') outName = name.toLowerCase();
        continue; // OUT params are returned as result columns
      }
      args[name] = p.Value;
    }
    const spName = String(strSPName).replace(/[\[\]]/g, '');
    const rows = await proc('affiliate', spName, args);
    const row = rows[0] || {};
    // PORT-NOTE: C# Int32.Parse(@intResult) throws when the output is missing; here a missing value yields 0.
    const v = row[outName || 'intresult'];
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }

  // PORT-NOTE: raw SQL text is executed as-is; callers must pass PostgreSQL-compatible SQL.
  async ExecuteSql(strSql) {
    return await exec('affiliate', strSql, {});
  }
}

module.exports = DataUtility;
