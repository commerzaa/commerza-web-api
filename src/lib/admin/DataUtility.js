/** Exports (instance class `DataUtility`, MLM Admin panel; database 'affiliate' = AppSettings["ConnectionString"] and DataBaseContext, both Db_Affiliate; all methods async):
 *   everything of ../member/DataUtility (identical C# except ErrorInsert):
 *   static SqlParameter(ParameterName, Value, Direction='Input') ; static get RepeaterCurrentRowCssClass ; constructor(Connection?)
 *   ExecuteSql(strSql) | ExecuteSql(arrParam, strSql) ; ExecuteSqlSP(arrParam, strSPName) ; ExecuteSqlSPV ; ExecuteSqlSPD ; ExecuteSqlSPS
 *   IsExist(strSql) | IsExist(arrParam, strSql) ; IsExistSP(arrParam, strSPName) | IsExistSP(strSPName) ; GetScalar(strSql)
 *   GetDataTable(...) ; GetDataTableSP(...) ; GetDataSet(...) ; GetDataSetSP(...) ; GetDataReader(...) ; GetDataReaderSP(...)
 *   GetScaler(arrParam, strSql) ; GetScalerSP(arrParam, strSql) ; GetMaster(arrParam) ; GetDataSetNamed(strSql, dsName) ; GetDataSetNames(strSql, dsName) ; GetDataSetSPNamed(arrParam, strSPName, tblName)
 *   ErrorInsert(Errorcode, Description, PROCEDURENAME, Errorline, ErrorURL) : void   -- OVERRIDE: @Panel = "Admin" (Member: "Member")
 * Diff vs Member C# (Models/DataUtility.cs): only ErrorInsert's @Panel value differs.
 */
'use strict';
const { proc } = require('../../db');
const MemberDataUtility = require('../member/DataUtility');

const DB = 'affiliate';

class DataUtility extends MemberDataUtility {
  // Legacy: DataBaseContext (Db_Affiliate) => [DBO].[SP_ERRORLOG_FrontEND] @NUMBER,@DESCRIPTION,@PROCEDURENAME,@ERRORLINE,@URL,@Panel
  async ErrorInsert(Errorcode, Description, PROCEDURENAME, Errorline, ErrorURL) {
    await proc(DB, 'sp_errorlog_frontend', {
      number: Errorcode,
      description: Description,
      procedurename: PROCEDURENAME,
      errorline: Errorline,
      url: ErrorURL,
      panel: 'Admin',
    });
  }
}

module.exports = DataUtility;
