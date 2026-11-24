/** Exports (instance class `DataUtility`, Member app; database 'affiliate' = AppSettings["ConnectionString"] and DataBaseContext, both Db_Affiliate; all methods async):
 *   static SqlParameter(ParameterName, Value, Direction='Input') : {ParameterName, Value, Direction}   (replaces System.Data.SqlClient.SqlParameter; Direction 'Output' => OUT param, read from the result row)
 *   static get RepeaterCurrentRowCssClass : string   ("bg_grey" on every even call)
 *   constructor(Connection?) ; mCon / mDataCom / mDa / DataTable / DataSet property bags (kept for API parity, unused)
 *   ExecuteSql(strSql) | ExecuteSql(arrParam, strSql) : int (affected rows)
 *   ExecuteSqlSP(arrParam, strSPName) : int (@intResult) ; ExecuteSqlSPV(arrParam, strSPName) : void ; ExecuteSqlSPD(arrParam, strSPName) : double (@dobResult) ; ExecuteSqlSPS(arrParam, strSPName) : string (@strResult)
 *   IsExist(strSql) | IsExist(arrParam, strSql) : bool ; IsExistSP(arrParam, strSPName) | IsExistSP(strSPName) : bool (@intResult > 0) ; GetScalar(strSql) : any
 *   GetDataTable(strSql) | GetDataTable(arrParam, strSql) : row[] ; GetDataTableSP(arrParam, strSPName) | GetDataTableSP(strSPName) : row[]
 *   GetDataSet(strSql) | GetDataSet(arrParam, strSql) : {Table: row[], Tables: [row[]]} ; GetDataSetSP(strSPName) | GetDataSetSP(arrParam, strSPName) : same shape
 *   GetDataReader(strSql) | GetDataReader(arrParam, strSql) : row[] ; GetDataReaderSP(arrParam, strSPName) | GetDataReaderSP(strSPName) : row[]
 *   GetScaler(arrParam, strSql) : any ; GetScalerSP(arrParam, strSql) : any ; GetMaster(arrParam) : row[] (USP_GetMaster)
 *   GetDataSetNamed(strSql, dsName) : {[dsName]: row[]} ; GetDataSetNames(strSPName, dsName) : {[dsName]: row[]} ; GetDataSetSPNamed(arrParam, strSPName, tblName) : {[tblName]: row[]}
 *   ErrorInsert(Errorcode, Description, PROCEDURENAME, Errorline, ErrorURL) : void   ([DBO].[SP_ERRORLOG_FrontEND], @Panel = "Member")
 * PORT-NOTE: DataTable / SqlDataReader results are plain arrays of row objects with the lower-case column names PostgreSQL returns (callers map the names they need).
 * PORT-NOTE: raw SQL text of ExecuteSql/IsExist/GetDataTable/... is executed as-is: callers must pass PostgreSQL-compatible SQL with @name placeholders (bound from arrParam).
 * PORT-NOTE: SqlParameter OUT values (@intResult/@dobResult/@strResult) are read from the lower-case column of the single result row of the stored procedure.
 */
'use strict';
const { query, scalar, exec, proc, procOne } = require('../../db');

const DB = 'affiliate';

const NRE = () => new TypeError('Object reference not set to an instance of an object.');

// SqlParameter[] => named-parameter object; OUT params are not sent
function toArgs(arrParam, skipOutputs) {
  const args = {};
  for (const p of arrParam || []) {
    if (skipOutputs && (p.Direction === 'Output' || p.Direction === 2)) continue;
    args[String(p.ParameterName).replace(/^@/, '').trim()] = p.Value;
  }
  return args;
}
const spName = (n) => String(n).replace(/[\[\]]/g, '').replace(/^dbo\./i, '');
const ds = (rows, name) => { const o = {}; o[name || 'Table'] = rows; if (!name) o.Tables = [rows]; return o; };
const isInt = (v) => { const n = parseInt(v, 10); return String(v).trim() !== '' && !Number.isNaN(n) && /^\s*[+-]?\d+\s*$/.test(String(v)) ? n : null; };

function outValue(row, name) {
  if (!row) throw NRE(); // Parameters["@x"].Value on a procedure that returned nothing
  const k = name.toLowerCase();
  if (k in row) return row[k];
  const keys = Object.keys(row);
  return keys.length === 1 ? row[keys[0]] : null;
}

let rowCounter = 0;

class DataUtility {
  constructor(Connection) {
    // legacy: SqlConnection(Connection). The connection string is not used (single configured database).
    this._mCon = Connection || null;
    this._mDataCom = null;
    this._mDa = null;
    this._DataTable = null;
    this._DataSet = null;
  }

  static SqlParameter(ParameterName, Value, Direction) {
    return { ParameterName, Value, Direction: Direction || 'Input' };
  }

  static get RepeaterCurrentRowCssClass() {
    let toReturn = '';
    if (rowCounter % 2 === 0) toReturn = 'bg_grey';
    if (rowCounter === 2147483647) rowCounter = 0; else rowCounter++;
    return toReturn;
  }

  get mCon() { return this._mCon; }
  set mCon(v) { this._mCon = v; }
  get mDataCom() { return this._mDataCom; }
  set mDataCom(v) { this._mDataCom = v; }
  get mDa() { if (this._mDa === null) this._mDa = {}; return this._mDa; }
  set mDa(v) { this._mDa = v; }
  get DataTable() { if (this._DataTable === null) this._DataTable = []; return this._DataTable; }
  set DataTable(v) { this._DataTable = v; }
  get DataSet() { if (this._DataSet === null) this._DataSet = {}; return this._DataSet; }
  set DataSet(v) { this._DataSet = v; }

  // ---- ExecuteNonQuery family
  async ExecuteSql(a, b) {
    if (Array.isArray(a)) return await exec(DB, b, toArgs(a, false));
    return await exec(DB, a, {});
  }

  async ExecuteSqlSP(arrParam, strSPName) {
    const row = await procOne(DB, spName(strSPName), toArgs(arrParam, true));
    const n = isInt(outValue(row, 'intResult'));
    if (n === null) throw new Error('Input string was not in a correct format.'); // Int32.Parse
    return n;
  }

  async ExecuteSqlSPV(arrParam, strSPName) {
    await proc(DB, spName(strSPName), toArgs(arrParam, true));
  }

  async ExecuteSqlSPD(arrParam, strSPName) {
    const row = await procOne(DB, spName(strSPName), toArgs(arrParam, true));
    const n = Number(outValue(row, 'dobResult'));
    if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
    return n;
  }

  async ExecuteSqlSPS(arrParam, strSPName) {
    const row = await procOne(DB, spName(strSPName), toArgs(arrParam, true));
    const v = outValue(row, 'strResult');
    if (v === null || v === undefined) throw NRE();
    return String(v);
  }

  // ---- existence / scalar
  async IsExist(a, b) {
    const v = Array.isArray(a) ? await scalar(DB, b, toArgs(a, false)) : await scalar(DB, a, {});
    if (v === null || v === undefined) throw NRE(); // (int)null
    return Number(v) > 0;
  }

  async IsExistSP(a, b) {
    const rows = Array.isArray(a) ? await proc(DB, spName(b), toArgs(a, true)) : await proc(DB, spName(a), {});
    const n = isInt(outValue(rows[0] || null, 'intResult'));
    if (n === null) throw new Error('Input string was not in a correct format.');
    return n > 0;
  }

  async GetScalar(strSql) {
    return await scalar(DB, strSql, {});
  }

  // ---- DataTable
  async GetDataTable(a, b) {
    if (Array.isArray(a)) return await query(DB, b, toArgs(a, false));
    return await query(DB, a, {});
  }

  async GetDataTableSP(a, b) {
    if (Array.isArray(a)) return await proc(DB, spName(b), toArgs(a, true));
    return await proc(DB, spName(a), {});
  }

  // ---- DataSet
  async GetDataSet(a, b) {
    return ds(Array.isArray(a) ? await query(DB, b, toArgs(a, false)) : await query(DB, a, {}));
  }

  async GetDataSetSP(a, b) {
    return ds(Array.isArray(a) ? await proc(DB, spName(b), toArgs(a, true)) : await proc(DB, spName(a), {}));
  }

  // ---- DataReader (PORT-NOTE: returned as an array of rows)
  async GetDataReader(a, b) {
    if (Array.isArray(a)) return await query(DB, b, toArgs(a, false));
    return await query(DB, a, {});
  }

  async GetDataReaderSP(a, b) {
    if (Array.isArray(a)) return await proc(DB, spName(b), toArgs(a, true));
    return await proc(DB, spName(a), {});
  }

  // legacy GetScaler adds only arrParam[0] to the command
  async GetScaler(arrParam, strSql) {
    return await scalar(DB, strSql, toArgs([arrParam[0]], false));
  }

  async GetScalerSP(arrParam, strSql) {
    const rows = await proc(DB, spName(strSql), toArgs(arrParam, true));
    const r = rows[0];
    if (!r) return null;
    const k = Object.keys(r)[0];
    return k === undefined ? null : r[k];
  }

  async GetMaster(arrParam) {
    return await proc(DB, 'USP_GetMaster', toArgs(arrParam, true));
  }

  async GetDataSetNamed(strSql, dsName) {
    return ds(await query(DB, strSql, {}), dsName);
  }

  async GetDataSetNames(strSql, dsName) {
    return ds(await proc(DB, spName(strSql), {}), dsName);
  }

  async GetDataSetSPNamed(arrParam, strSPName, tblName) {
    return ds(await proc(DB, spName(strSPName), toArgs(arrParam, true)), tblName);
  }

  // Legacy: DataBaseContext (Db_Affiliate) => [DBO].[SP_ERRORLOG_FrontEND] @NUMBER,@DESCRIPTION,@PROCEDURENAME,@ERRORLINE,@URL,@Panel
  async ErrorInsert(Errorcode, Description, PROCEDURENAME, Errorline, ErrorURL) {
    await proc(DB, 'sp_errorlog_frontend', {
      number: Errorcode,
      description: Description,
      procedurename: PROCEDURENAME,
      errorline: Errorline,
      url: ErrorURL,
      panel: 'Member',
    });
  }
}

module.exports = DataUtility;
