/** Exports: class Payout (table payout; props payID, paydate, payfrom, payto, NewMembers, PayoutAmount, Tds, AdminCharge, acitve)
 *   async GetCurrentPayoutDate() : Date ; async CheckValidPayDate() : bool ; async Getpayoutlist() : Payout[]
 *  Override of ../member/Payout.js (= ../Payout.js): the SQL is identical (admin entity uses regNo/Regdate, the same columns as REGNO/REGDATE),
 *  but CheckValidPayDate uses the ADMIN UtilityClass.GetDatabaseDate().
 */
'use strict';
const Reused = require('../member/Payout');
const { defineModel } = require('./_models');

const M = defineModel('Payout', 'payout', { payID: 0, paydate: null, payfrom: null, payto: null, NewMembers: 0, PayoutAmount: 0, Tds: 0, AdminCharge: 0, acitve: 0 });

class Payout extends Reused {
  constructor(init) {
    super();
    Object.assign(this, new M(init));
  }

  async CheckValidPayDate() {
    const UtilityClass = require('./UtilityClass');
    const Current = new Date(await UtilityClass.GetDatabaseDate());
    const PayoutDate = await this.GetCurrentPayoutDate();
    if (Current > PayoutDate) {
      return true;
    } else {
      return false;
    }
  }
}
Object.assign(Payout, { PROPS: M.PROPS, TABLE: M.TABLE, NOT_MAPPED: M.NOT_MAPPED, map: M.map, mapAll: M.mapAll });

module.exports = Payout;
