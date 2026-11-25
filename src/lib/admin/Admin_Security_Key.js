/** Exports: class Admin_Security_Key (table admin_security_key; props ASKID, Emp_Id, Sms, GaKey, ActiveKey, Status, Date, FACODE, IPADDRESS, RandomNo)
 *          class Security_Key (table security_key; props SKID, Plid, Sms, GaKey, ActiveKey, Status, Date)
 *   async Get_Security_Key(Int64 Emp_Id) : Admin_Security_Key | null  (Emp_Id && Status)
 *   async Check_SmsKey(Int64 Emp_Id, string SmsKey) : bool  (SmsKey == Get_Sms_Key(Emp_Id))
 *   async Check_GaKeyForEnableTime(int Emp_Id, string SecretKey, string user2FACode = "") : bool  (TimeBasedOneTimePassword.IsValid; may throw OneTimePasswordException)
 *   async Get_Sms_Key(Int64 Emp_Id) : string  (Sms of the active key or "")
 *   async Get_GA_Key(int Emp_Id) : string  (RandomNo of the active key or "")
 *   async Manage_Security_Key(Int64 Emp_Id, string Mode, string Sms, int ActiveKey, string GAKey, string FACode, string RandomNo) : string
 *       (proc Usp_Manage_Admin_Secutiry_Key @Emp_Id,@Mode,@Sms,@GaKey,@ActiveKey,@FACODE,@IPADDRESS,@RandomNo,@strResult out; IP = GetIP.GetLocalIP())
 *   Admin_Security_Key.Security_Key : model class (table security_key; also ./Security_Key)
 */
'use strict';
const { queryOne, procOne } = require('../../db');
const { defineModel, out, DB } = require('./_models');
const { toStr } = require('../_libhelpers');
const TimeBasedOneTimePassword = require('./TimeBasedOneTimePassword');
const GetIP = require('./GetIP');

const Base = defineModel('Admin_Security_Key', 'admin_security_key', { ASKID: 0, Emp_Id: 0, Sms: null, GaKey: null, ActiveKey: 0, Status: false, Date: null, FACODE: null, IPADDRESS: null, RandomNo: null });
const Security_Key = defineModel('Security_Key', 'security_key', { SKID: 0, Plid: 0, Sms: null, GaKey: null, ActiveKey: 0, Status: false, Date: null });

class Admin_Security_Key extends Base {
  async Get_Security_Key(Emp_Id) {
    return Base.map(await queryOne(DB, 'select * from admin_security_key where emp_id=@Emp_Id and status::int=1 limit 1', { Emp_Id }));
  }

  async Check_SmsKey(Emp_Id, SmsKey) {
    const SecretKey = await this.Get_Sms_Key(Emp_Id);
    if (SmsKey === SecretKey) {
      return true;
    } else {
      return false;
    }
  }

  async Check_GaKeyForEnableTime(Emp_Id, SecretKey, user2FACode = '') {
    if (await TimeBasedOneTimePassword.IsValid(SecretKey, user2FACode)) {
      return true;
    } else {
      return false;
    }
  }

  async Get_Sms_Key(Emp_Id) {
    const obj = await queryOne(DB, 'select sms from admin_security_key where emp_id=@Emp_Id and status::int=1 limit 1', { Emp_Id });
    if (obj !== null) {
      return obj.sms;
    } else {
      return '';
    }
  }

  async Get_GA_Key(Emp_Id) {
    const obj = await queryOne(DB, 'select randomno from admin_security_key where emp_id=@Emp_Id and status::int=1 limit 1', { Emp_Id });
    if (obj !== null) {
      return obj.randomno;
    } else {
      return '';
    }
  }

  async Manage_Security_Key(Emp_Id, Mode, Sms, ActiveKey, GAKey, FACode, RandomNo) {
    const IP = await GetIP.GetLocalIP();
    // legacy CommandTimeout = 1000 s
    const row = await procOne(DB, 'usp_manage_admin_secutiry_key', { emp_id: Emp_Id, mode: Mode, sms: Sms, gakey: GAKey, activekey: ActiveKey, facode: FACode, ipaddress: IP, randomno: RandomNo });
    return toStr(out(row, 'strResult'));
  }
}

module.exports = Admin_Security_Key;
module.exports.Security_Key = Security_Key;
