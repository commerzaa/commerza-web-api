/** Exports: class Payout (table payout; props payID, paydate, payfrom, payto, NewMembers, PayoutAmount, Tds, AdminCharge, acitve)
 *   async GetCurrentPayoutDate() : Date ; async CheckValidPayDate() : bool ; async Getpayoutlist() : Payout[]
 */
'use strict';
const { query, queryOne } = require('../db');
const { mapRows } = require('../utils/shape');

const PROPS = ['payID', 'paydate', 'payfrom', 'payto', 'NewMembers', 'PayoutAmount', 'Tds', 'AdminCharge', 'acitve'];

class Payout {
  async GetCurrentPayoutDate() {
    let LastPayDate;
    const row = await queryOne('affiliate', 'select payto from payout order by payid desc limit 1');
    if (row !== null) {
      LastPayDate = row.payto;
    } else {
      const row2 = await queryOne('affiliate', 'select regdate from member_master order by regno asc limit 1');
      LastPayDate = row2.regdate; // legacy: NullReference when there is no member
    }
    LastPayDate = new Date(new Date(LastPayDate).getTime() + 7 * 24 * 60 * 60 * 1000); // AddDays(7)
    return LastPayDate;
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

  async Getpayoutlist() {
    return mapRows(await query('affiliate', 'select * from payout where acitve=1 order by payid desc'), PROPS);
  }
}

module.exports = Payout;
