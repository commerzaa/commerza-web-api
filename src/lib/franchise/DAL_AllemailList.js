/**
 * Exports: class DAL_AllemailList { async Create(string EMAIL, bool CHECK, Int64 Plid, string GroupName): string;
 *   async Modify(int TMCEMID, string EMAIL, bool CHECK, Int64 Plid, string OldEmail): string; async Reject(int TMCEMID, string EMAIL, Int64 Plid): string }
 * PORT-NOTE: Franchise DataBaseContext = Db_Shopping. Legacy built the UPDATE by string concatenation (SQL injection); parameterised here.
 * IsActive was written as the string 'True'/'False' (C# bool.ToString()); a real boolean is sent here.
 */
'use strict';
const db = require('../../db');
const { outValue } = require('../_http');

const NRE = () => new TypeError('Object reference not set to an instance of an object.');

class DAL_AllemailList {
  async Create(EMAIL, CHECK, Plid, GroupName) {
    const row = await db.procOne('shopping', 'usp_add_email', { plid: Plid, email: EMAIL, check: CHECK, groupname: GroupName, remark: '' });
    return outValue(row, 'Message'); // @Message OUT
  }

  async Modify(TMCEMID, EMAIL, CHECK, Plid, OldEmail) {
    let result = '';
    const Obj = await db.queryOne('shopping', 'select email from tbl_member_customer_email where tmcemid = @TMCEMID limit 1', { TMCEMID });
    if (Obj === null) throw NRE();
    const Emails = Obj.email;
    if (Emails === null || Emails === undefined) throw NRE();
    const Arr = String(Emails).split(',');
    if (Arr.length > 1) {
      for (let i = 0; i < Arr.length; i++) {
        if (Arr[i] === OldEmail) {
          Arr[i] = EMAIL;
          break;
        }
      }
      let UpdateEmail = '';
      for (let i = 0; i < Arr.length; i++) {
        UpdateEmail += Arr[i] + ',';
      }
      UpdateEmail = UpdateEmail.replace(/,+$/, '');
      await db.exec('shopping', 'update tbl_member_customer_email set email = @UpdateEmail where tmcemid = @TMCEMID', { UpdateEmail, TMCEMID });
    } else {
      await db.exec('shopping', 'update tbl_member_customer_email set email = @EMAIL, isactive = @CHECK where tmcemid = @TMCEMID', { EMAIL, CHECK: !!CHECK, TMCEMID });
    }
    result = 'Success';
    return result;
  }

  async Reject(TMCEMID, EMAIL, Plid) {
    const row = await db.procOne('shopping', 'usp_delete_email', { tmcemid: TMCEMID, plid: Plid, email: EMAIL });
    return outValue(row, 'StrResult'); // @StrResult OUT
  }
}

module.exports = DAL_AllemailList;
