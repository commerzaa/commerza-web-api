/**
 * Exports: class ManageAffiliateData { async UpdateRequest(model: AddBonusModel): ResponseResult; async GetConfigForm(string merchatId): DataTable (array of row objects);
 *   async UpdateConfiguration(model: MerchantConfiguration): ResponseResult }
 * ResponseResult = { STATUS: bool, RESULT: int, MESSAGE: string }.  AddBonusModel = { ABPID, BONUS_TYPE, BONUS_VALUE, REDEEM_DAYS, SPRID, CREATED_BY, STATUS };
 * MerchantConfiguration = { FLAG, MERCHANT_ID, VALUE, COLUMN_NAME }.
 * PORT-NOTE: legacy used BAL/DbManager over CommonFunc.getDbShopping() (DefaultConnection = Db_Shopping) => 'shopping'. The procedures' OUTPUT parameters
 *   @OUT_STATUS (bit), @OUT_RESULT (int), @OUT_MESSAGE (varchar(100)) come back as columns of the single result row.
 */
'use strict';
const db = require('../../db');

const D = 'shopping';
const col = (row, name) => {
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? undefined : row[k];
};

/** DbManager.ExecuteQueryWithResponse output mapping: Convert.ToBoolean / Convert.ToInt32 / Convert.ToString of the OUT params. */
function toResponse(row) {
  const st = col(row, 'out_status');
  const rs = col(row, 'out_result');
  const ms = col(row, 'out_message');
  if (st === null || st === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  if (rs === null || rs === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  let STATUS;
  if (st === true || st === false) STATUS = st;
  else if (st === 1 || st === '1' || String(st).toLowerCase() === 'true') STATUS = true;
  else if (st === 0 || st === '0' || String(st).toLowerCase() === 'false') STATUS = false;
  else throw new Error('String was not recognized as a valid Boolean.');
  const RESULT = parseInt(String(rs), 10);
  if (Number.isNaN(RESULT)) throw new Error('Input string was not in a correct format.');
  return { STATUS, RESULT, MESSAGE: ms === null || ms === undefined ? '' : String(ms) };
}

class ManageAffiliateData {
  async UpdateRequest(model) {
    const row = await db.procOne(D, 'usp_update_affiliate_bonus', {
      abpid: model.ABPID,
      bonus_type: model.BONUS_TYPE,
      bonus_value: model.BONUS_VALUE,
      redeedays: model.REDEEM_DAYS,
      sprid: model.SPRID,
      created_by: model.CREATED_BY,
      status: model.STATUS,
    });
    return toResponse(row);
  }

  async GetConfigForm(merchatId) {
    return db.proc(D, 'usp_configuration_form', { merchantid: merchatId });
  }

  async UpdateConfiguration(model) {
    const row = await db.procOne(D, 'usp_update_merchant_cofig_data', {
      flag: model.FLAG,
      merchant_id: model.MERCHANT_ID,
      value: model.VALUE,
      column_name: model.COLUMN_NAME,
    });
    return toResponse(row);
  }
}

module.exports = ManageAffiliateData;
