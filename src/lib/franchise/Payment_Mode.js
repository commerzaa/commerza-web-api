/** Exports: class Payment_Mode { static PayModeList() : [{PayID,PayMode}] }   (also .Payment_Mode)
 *  class Payment_Mode_New (table tbl_paymode)  (also .Payment_Mode_New and Payment_Mode.Payment_Mode_New)
 *    static async PayModeList() : Payment_Mode_New[]  (status 1, by payMode; adds Process_fees)
 *    async paymodeby_pmcode(string Pmcode) : Payment_Mode_New|null ; async Allpaymode() : Payment_Mode_New[] ;
 *    async paymodeby_pmoid(int pmoid) : Payment_Mode_New|null ; async paymode() : Payment_Mode_New[]  (pmoid > 0)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');

const PROPS = ['pmoid', 'payMode', 'status', 'process_fee', 'pm_code', 'Image', 'UserID', 'UsedIn', 'MerchantID', 'merchant_token', 'api_Key', 'Salt', 'Currency', 'Password', 'IsTesting', 'second_password', 'Secret_pin'];
const nm = (o) => (o ? { ...o, Withdrawal_Status: 0, VariablePercenatgeForAutoApprove: 0, Process_fees: null } : o); // [NotMapped]

// decimal.ToString("$0.00") (midpoint away from zero)
function fmtMoney(v) {
  const n = Number(v);
  const a = Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100;
  return (n < 0 && a !== 0 ? '-' : '') + '$' + a.toFixed(2);
}

class Payment_Mode {
  static PayModeList() {
    const li = [];
    li.push({ PayID: 1, PayMode: 'Cash' });
    li.push({ PayID: 2, PayMode: 'Cheque' });
    li.push({ PayID: 5, PayMode: 'NEFT' });
    li.push({ PayID: 6, PayMode: 'RTGS' });
    li.push({ PayID: 3, PayMode: 'DD' });
    li.push({ PayID: 4, PayMode: 'Net Banking' });
    li.push({ PayID: 7, PayMode: 'Credit,Debit Card' });
    return li;
  }
}

class Payment_Mode_New {
  static async PayModeList() {
    const li = [];
    const rows = mapRows(await query('shopping', 'select * from tbl_paymode where status::int=1 order by paymode'), PROPS).map(nm);
    for (const Item of rows) {
      const obj = Item;
      if (Item.pmoid === 1) {
        obj.Process_fees = Item.payMode;
      } else {
        obj.Process_fees = Item.payMode + ' ( Fee : ' + fmtMoney(Item.process_fee) + ')';
      }
      li.push(obj);
    }
    return li;
  }

  async paymodeby_pmcode(Pmcode) {
    return nm(mapRow(await queryOne('shopping', 'select * from tbl_paymode where status::int=1 and pm_code=@Pmcode limit 1', { Pmcode }), PROPS));
  }

  async Allpaymode() {
    return mapRows(await query('shopping', 'select * from tbl_paymode where status::int=1 order by paymode'), PROPS).map(nm);
  }

  async paymodeby_pmoid(pmoid) {
    return nm(mapRow(await queryOne('shopping', 'select * from tbl_paymode where status::int=1 and pmoid=@pmoid limit 1', { pmoid }), PROPS));
  }

  async paymode() {
    return mapRows(await query('shopping', 'select * from tbl_paymode where pmoid>0 order by paymode'), PROPS).map(nm);
  }
}

Payment_Mode.Payment_Mode = Payment_Mode;
Payment_Mode.Payment_Mode_New = Payment_Mode_New;
module.exports = Payment_Mode;
