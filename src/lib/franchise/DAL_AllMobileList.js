/**
 * Exports: class DAL_AllMobileList { async Create(string MOBILE, bool CHECK, Int64 Plid, string GroupName): string;
 *   async Modify(int TMCSMID, string MOBILE, bool CHECK, Int64 Plid, string OldMobile): string; async Reject(int TMCSMID, string MOBILE, Int64 Plid): string }
 * PORT-NOTE: Franchise DataBaseContext = Db_Shopping. Legacy built the UPDATE by string concatenation (SQL injection); parameterised here.
 * Modify returns "" (legacy never assigned result).
 */
'use strict';
const db = require('../../db');
const { outValue } = require('../_http');

const NRE = () => new TypeError('Object reference not set to an instance of an object.');

class DAL_AllMobileList {
  async Create(MOBILE, CHECK, Plid, GroupName) {
    const row = await db.procOne('shopping', 'usp_add_mobile', { plid: Plid, mobile: MOBILE, check: CHECK, groupname: GroupName, remark: '' });
    return outValue(row, 'Message'); // @Message OUT
  }

  async Modify(TMCSMID, MOBILE, CHECK, Plid, OldMobile) {
    const result = '';
    const Obj = await db.queryOne('shopping', 'select mobile from tbl_member_customer_mobile where tmcsmid = @TMCSMID limit 1', { TMCSMID });
    if (Obj === null) throw NRE();
    const Mobiles = Obj.mobile;
    if (Mobiles === null || Mobiles === undefined) throw NRE();
    const Arr = String(Mobiles).split(',');
    if (Arr.length > 1) {
      for (let i = 0; i < Arr.length; i++) {
        if (Arr[i] === OldMobile) {
          Arr[i] = MOBILE;
          break;
        }
      }
      let UpdateMobile = '';
      for (let i = 0; i < Arr.length; i++) {
        UpdateMobile += Arr[i] + ',';
      }
      UpdateMobile = UpdateMobile.replace(/,+$/, '');
      await db.exec('shopping', 'update tbl_member_customer_mobile set mobile = @UpdateMobile where tmcsmid = @TMCSMID', { UpdateMobile, TMCSMID });
    } else {
      await db.exec('shopping', 'update tbl_member_customer_mobile set mobile = @MOBILE, isactive = @CHECK where tmcsmid = @TMCSMID', { MOBILE, CHECK: !!CHECK, TMCSMID });
    }
    return result;
  }

  async Reject(TMCSMID, MOBILE, Plid) {
    const row = await db.procOne('shopping', 'usp_delete_mobile', { tmcsmid: TMCSMID, plid: Plid, mobile: MOBILE });
    return outValue(row, 'StrResult'); // @StrResult OUT
  }
}

module.exports = DAL_AllMobileList;
