/** Exports: class SmsApiSetting (Franchise DAL/SmsApiSetting.cs) { static async SMSSend(mobileNo, sender, message, Plid: int, ApiType: int = 0): int; async updatesmsapi(smsapi, active, proapi, proactive, Plid: int): string }
 *  Extends ../SmsApiSetting (updatesmsapi is logically identical, same 'shopping' DB). SMSSend is overridden because the Franchise C#
 *  swallows exceptions WITHOUT calling DataUtility.ErrorInsert (the API version logs to the error table).
 */
'use strict';
const { query } = require('../../db');
const { getText } = require('../_http');
const Base = require('../SmsApiSetting');

let ret = 0; // legacy private static int ret (kept: "Api Check" with an empty url returns the previous value)

class SmsApiSetting extends Base {
  static async SMSSend(mobileNo, sender, message, Plid, ApiType = 0) {
    if (message === 'Api Check') {
      if (mobileNo !== '') {
        try {
          const Baseurl = mobileNo;
          await getText(Baseurl);
          ret = 1;
        } catch (ex) {
          ret = 0;
        }
      }
      return ret;
    }
    // PORT-NOTE: legacy called SqlQuery<string>(...).ToString() (returned the query type name, so the split/concat always
    // threw and SMSSend always returned 0). Ported to the evident intent (same as ../SmsApiSetting): run the query, use row 1.
    // Both ApiType branches ran the identical statement. Franchise DB = Db_Shopping ('shopping').
    let api = '';
    const rows = await query('shopping', 'select SMS_API from TBL_SMSAPISETTING where API_TYPE=1 and STATUS=1 and Plid=@Plid', { Plid });
    if (rows.length > 0 && rows[0].sms_api != null) api = String(rows[0].sms_api);
    if (api !== '') {
      const apimessage = api.split('~');
      ret = 0;
      try {
        if (apimessage.length > 0) {
          if (apimessage.length < 3) throw new RangeError('Index was outside the bounds of the array.');
          const baseurl = apimessage[0] + mobileNo + apimessage[1] + message + apimessage[2];
          await getText(baseurl);
          ret = 1;
        }
      } catch (Exp) {
        ret = 0; // Franchise: no ErrorInsert
      }
    } else {
      ret = 1;
    }
    return ret;
  }
}

module.exports = SmsApiSetting;
