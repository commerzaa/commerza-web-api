/**
 * Exports: class DAL_AffiliateBonusManage { async SaveReferralInfo(AffiliateSharSaveModel model): string;
 *   async GetReferralSessionData(string SessionString): RefrralInfoModel }
 * Portal DataBaseContext = Db_Shopping. Procedure USP_MANAGE_AFFILIATE_SHARE returns @MESSAGE OUT as a column of the result row.
 */
'use strict';
const db = require('../../db');
const UtilityClass = require('./UtilityClass');

const toInt32 = (s) => { // Convert.ToInt32(string)
  if (s === null || s === undefined) return 0;
  const t = String(s).trim();
  if (!/^[+-]?\d+$/.test(t) || Math.abs(Number(t)) > 2147483647) throw new Error('Input string was not in a correct format.');
  return Number(t);
};

class DAL_AffiliateBonusManage {
  async SaveReferralInfo(model) {
    let ResValue = '';
    const row = await db.procOne('shopping', 'usp_manage_affiliate_share', {
      share_by_id: model.SHARE_BY_ID,
      share_to_id: model.SHARE_TO_ID,
      link: model.LINK,
      sprid: model.SPRID,
      remark: model.REMARK,
      mode: model.MODE,
      complete_flag: model.COMPLETE_FLAG,
      order_id: model.ORDER_ID,
    });
    let v;
    if (row) {
      const k = Object.keys(row).find((x) => x.toLowerCase() === 'message');
      v = k !== undefined ? row[k] : row[Object.keys(row)[0]];
    }
    if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.');
    ResValue = String(v);
    return ResValue;
  }

  async GetReferralSessionData(SessionString) {
    const model = { CATEGORY_NAME: null, SPRID: 0, REFERRAL_USER_ID: 0, SHARE_LINK: null };
    const data = String(SessionString).split('^');
    if (data.length === 4) {
      model.CATEGORY_NAME = data[0];
      model.SPRID = toInt32(data[1]);
      model.REFERRAL_USER_ID = toInt32(await UtilityClass.Decryptword(data[2]));
      model.SHARE_LINK = data[3];
    }
    return model;
  }
}

module.exports = DAL_AffiliateBonusManage;
