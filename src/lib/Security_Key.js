/** Exports: class Security_Key  (table tbl_gakeyauthorization_history; props TGKAHID, plid, FACODE, GAKEY, IPADDRESS, RandomNo, Status, CREATEDDATE)
 *   async Get_Security_Key(long plid) : Security_Key | null
 *   async Check_GaKey(long plid, string SecretKey, string user2FACode = "") : bool    (TimeBasedOneTimePassword.IsValid may throw OneTimePasswordException)
 *   async Get_GA_Key(long plid) : string
 *   async Manage_Security_Key(long Plid, string Mode, string Sms, string GaKey, int ActiveKey) : string   (Usp_Manage_Secutiry_Key, @strResult out)
 */
'use strict';
const { queryOne, procOne } = require('../db');
const { mapRow } = require('../utils/shape');
const { out, toStr } = require('./_libhelpers');
const TimeBasedOneTimePassword = require('./TimeBasedOneTimePassword');

const PROPS = ['TGKAHID', 'plid', 'FACODE', 'GAKEY', 'IPADDRESS', 'RandomNo', 'Status', 'CREATEDDATE'];

class Security_Key {
  constructor(row) {
    this.TGKAHID = 0;
    this.plid = 0;
    this.FACODE = null;
    this.GAKEY = null;
    this.IPADDRESS = null;
    this.RandomNo = null;
    this.Status = 0;
    this.CREATEDDATE = null;
    if (row) Object.assign(this, row);
  }

  async Get_Security_Key(plid) {
    const row = await queryOne('affiliate', 'select * from tbl_gakeyauthorization_history where plid=@plid and status=1 limit 1', { plid });
    const m = mapRow(row, PROPS);
    return m ? new Security_Key(m) : null;
  }

  async Check_GaKey(plid, SecretKey, user2FACode = '') {
    if (TimeBasedOneTimePassword.IsValid(SecretKey, user2FACode)) {
      return true;
    } else {
      return false;
    }
  }

  async Get_GA_Key(plid) {
    const obj = await queryOne('affiliate', 'select gakey from tbl_gakeyauthorization_history where plid=@plid and status=1 limit 1', { plid });
    if (obj !== null) {
      return obj.gakey;
    } else {
      return '';
    }
  }

  async Manage_Security_Key(Plid, Mode, Sms, GaKey, ActiveKey) {
    const row = await procOne('affiliate', 'Usp_Manage_Secutiry_Key', { plid: Plid, Mode, Sms, GaKey, ActiveKey });
    return toStr(out(row, 'strResult'));
  }
}

module.exports = Security_Key;
