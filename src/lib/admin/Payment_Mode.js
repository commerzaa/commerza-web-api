/** Exports: class Payment_Mode (no table; props PayID, PayMode)
 *          class Payment_Mode_New (table tbl_paymode; props pmoid, payMode, status, process_fee, pm_code, Image, UserID, UsedIn, MerchantID, merchant_token, api_Key, Salt, Currency, Password, IsTesting, second_password, Secret_pin, Withdrawal_Status, ISTOPUPSTATUS_ENABLE, ISWithdrawal_ENABLE, Active, ISADMINSHOW, TYPE, VariablePercenatgeForAutoApprove, Process_fees ; [NotMapped] Process_fees)
 *   Payment_Mode: static async PayModeList() : Payment_Mode[]  (fixed list Cash/Cheque/NEFT/RTGS/DD/Net Banking/Credit,Debit Card)
 *   Payment_Mode.Payment_Mode_New (also ./Payment_Mode_New):
 *     static async PayModeList() : Payment_Mode_New[]  (status == 1 && Active == 1, by payMode; Process_fees = payMode for pmoid 1,
 *         else payMode + " ( Fee : " + process_fee.ToString("$0.00") + ")")
 *     async paymodeby_pmcode(string Pmcode) : Payment_Mode_New | null  (status == 1 && pm_code)
 *     async Allpaymode() : Payment_Mode_New[]  (status == 1, by payMode)
 *     async paymodeby_pmoid(Int32 pmoid) : Payment_Mode_New | null  (status == 1 && pmoid)
 *     async paymode() : Payment_Mode_New[]  (pmoid > 0 && Active == 1, by payMode)
 * Not reused from ../franchise/Payment_Mode.js: different C# and database.
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Payment_Mode', null, { PayID: 0, PayMode: null });
const BaseNew = defineModel('Payment_Mode_New', 'tbl_paymode', { pmoid: 0, payMode: null, status: 0, process_fee: 0, pm_code: null, Image: null, UserID: null, UsedIn: null, MerchantID: null, merchant_token: null, api_Key: null, Salt: null, Currency: null, Password: null, IsTesting: false, second_password: null, Secret_pin: null, Withdrawal_Status: 0, ISTOPUPSTATUS_ENABLE: 0, ISWithdrawal_ENABLE: 0, Active: 0, ISADMINSHOW: 0, TYPE: 0, VariablePercenatgeForAutoApprove: 0, Process_fees: null }, ['Process_fees']);

// decimal.ToString("$0.00"): "$" literal, 2 decimals, sign in front
function fmtUsd(v) {
  const n = Number(v || 0);
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toFixed(2);
}

class Payment_Mode extends Base {
  static async PayModeList() {
    const li = [];
    li.push(new Payment_Mode({ PayID: 1, PayMode: 'Cash' }));
    li.push(new Payment_Mode({ PayID: 2, PayMode: 'Cheque' }));
    li.push(new Payment_Mode({ PayID: 5, PayMode: 'NEFT' }));
    li.push(new Payment_Mode({ PayID: 6, PayMode: 'RTGS' }));
    li.push(new Payment_Mode({ PayID: 3, PayMode: 'DD' }));
    li.push(new Payment_Mode({ PayID: 4, PayMode: 'Net Banking' }));
    li.push(new Payment_Mode({ PayID: 7, PayMode: 'Credit,Debit Card' }));
    return li;
  }
}

class Payment_Mode_New extends BaseNew {
  static async PayModeList() {
    const li = [];
    const rows = BaseNew.mapAll(await query(DB, 'select * from tbl_paymode where status=1 and active=1 order by paymode'));
    for (const item of rows) {
      const obj = new Payment_Mode_New(item);
      if (item.pmoid === 1) {
        obj.Process_fees = item.payMode;
      } else {
        obj.Process_fees = item.payMode + ' ( Fee : ' + fmtUsd(item.process_fee) + ')';
      }
      li.push(obj);
    }
    return li;
  }

  async paymodeby_pmcode(Pmcode) {
    return BaseNew.map(await queryOne(DB, 'select * from tbl_paymode where status=1 and pm_code=@Pmcode limit 1', { Pmcode }));
  }

  async Allpaymode() {
    return BaseNew.mapAll(await query(DB, 'select * from tbl_paymode where status=1 order by paymode'));
  }

  async paymodeby_pmoid(pmoid) {
    return BaseNew.map(await queryOne(DB, 'select * from tbl_paymode where status=1 and pmoid=@pmoid limit 1', { pmoid }));
  }

  async paymode() {
    return BaseNew.mapAll(await query(DB, 'select * from tbl_paymode where pmoid>0 and active=1 order by paymode'));
  }
}

module.exports = Payment_Mode;
module.exports.Payment_Mode_New = Payment_Mode_New;
