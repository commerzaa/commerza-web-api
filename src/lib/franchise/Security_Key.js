/** Exports: class Security_Key (table security_key, Db_Shopping; props SKID, plid, Sms, GaKey, ActiveKey, Status, Date)
 *   async Get_Security_Key(Int64 plid) : Security_Key|null
 *   async Check_SmsKey(Int64 plid, string SmsKey) : bool
 *   async Check_GaKey(Int64 plid, string GaKey) : bool   (TimeBasedOneTimePassword.IsValid may throw OneTimePasswordException)
 *   async Get_Sms_Key(Int64 plid) : string ; async Get_GA_Key(Int64 plid) : string
 *   async Manage_Security_Key(Int64 Plid, string Mode, string Sms, string GaKey, int ActiveKey) : string   (Usp_Manage_Secutiry_Key, @strResult out)
 */
'use strict';
const { queryOne, procOne } = require('../../db');
const { mapRow } = require('../../utils/shape');
const { outValue } = require('../_http');
const TimeBasedOneTimePassword = require('./TimeBasedOneTimePassword');

const PROPS = ['SKID', 'plid', 'Sms', 'GaKey', 'ActiveKey', 'Status', 'Date'];
const SQL = 'select * from security_key where plid=@plid and status::int=1 limit 1';

class Security_Key {
  constructor(row) {
    this.SKID = 0; this.plid = 0; this.Sms = null; this.GaKey = null; this.ActiveKey = 0; this.Status = false; this.Date = null;
    if (row) Object.assign(this, row);
  }

  async Get_Security_Key(plid) {
    const m = mapRow(await queryOne('shopping', SQL, { plid }), PROPS);
    return m ? new Security_Key(m) : null;
  }

  async Check_SmsKey(plid, SmsKey) {
    const SecretKey = await this.Get_Sms_Key(plid);
    return SmsKey === SecretKey;
  }

  async Check_GaKey(plid, GaKey) {
    const SecretKey = await this.Get_GA_Key(plid);
    return !!TimeBasedOneTimePassword.IsValid(SecretKey, GaKey);
  }

  async Get_Sms_Key(plid) {
    const obj = mapRow(await queryOne('shopping', SQL, { plid }), PROPS);
    return obj !== null ? obj.Sms : '';
  }

  async Get_GA_Key(plid) {
    const obj = mapRow(await queryOne('shopping', SQL, { plid }), PROPS);
    return obj !== null ? obj.GaKey : '';
  }

  async Manage_Security_Key(Plid, Mode, Sms, GaKey, ActiveKey) {
    const row = await procOne('shopping', 'Usp_Manage_Secutiry_Key', { plid: Plid, Mode, Sms, GaKey, ActiveKey });
    return outValue(row, 'strResult');
  }
}

module.exports = Security_Key;
