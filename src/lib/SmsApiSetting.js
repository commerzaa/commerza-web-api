/** Exports: static async SMSSend(mobileNo, sender, message, Plid: int, ApiType: int = 0): int; instance class method async updatesmsapi(smsapi, active, proapi, proactive, Plid: int): string. Use: const SmsApiSetting = require('../lib/SmsApiSetting'); await SmsApiSetting.SMSSend(...); await new SmsApiSetting().updatesmsapi(...) */
'use strict';
const { query, procOne } = require('../db');
const { getText, ErrorInsert, outValue } = require('./_http');

let ret = 0; // legacy static field (kept: "Api Check" with an empty url returns the previous value)

class SmsApiSetting {
  static async SMSSend(mobileNo, sender, message, Plid, ApiType = 0) {
    if (message === 'Api Check') {
      if (mobileNo !== '') {
        try {
          const Baseurl = mobileNo;
          await getText(Baseurl);
          ret = 1;
        } catch (ExpObj) {
          await ErrorInsert(ExpObj, 'SMSSend', 'DAL/SmsApiSetting');
          ret = 0;
        }
      }
      return ret;
    }
    // PORT-NOTE: legacy called SqlQuery<string>(...).ToString() (never executed the query; ToString() returned the type name,
    // so the split/concat always threw and SMSSend always returned 0). Ported to the evident intent: run the query, use the first row.
    // Both ApiType branches ran the identical statement. Table lives in Db_Shopping dump ('shopping').
    let api = '';
    const rows = await query('shopping', 'select SMS_API from TBL_SMSAPISETTING where API_TYPE=1 and STATUS=1 and Plid=@Plid', { Plid });
    if (rows.length > 0 && rows[0].sms_api != null) api = String(rows[0].sms_api);
    if (api !== '') {
      const apimessage = api.split('~');
      ret = 0;
      try {
        if (apimessage.length > 0) {
          // apimessage[1]/[2] missing => IndexOutOfRangeException in legacy => caught below
          if (apimessage.length < 3) throw new RangeError('Index was outside the bounds of the array.');
          const baseurl = apimessage[0] + mobileNo + apimessage[1] + message + apimessage[2];
          await getText(baseurl);
          ret = 1;
        }
      } catch (ExpObj) {
        await ErrorInsert(ExpObj, 'SMSSend', 'DAL/SmsApiSetting');
        ret = 0;
      }
    } else {
      ret = 1;
    }
    return ret;
  }

  async updatesmsapi(smsapi, active, proapi, proactive, Plid) {
    // legacy computed proapis ("" when null) but still sent proapi (null) to the procedure
    const row = await procOne('shopping', 'update_smsapi_setting', {
      plid: Plid, status: active, prostatus: proactive, smsapi, prosmsapi: proapi,
    });
    return outValue(row, 'intResult'); // @intResult OUT
  }
}

module.exports = SmsApiSetting;
