/** Exports: class Withdrawal_Master (table withdrawal_master; props payid, date, status)
 *   async Getwithdrawallist() : Withdrawal_Master[]  (status == 1, payid desc)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Withdrawal_Master', 'withdrawal_master', { payid: 0, date: null, status: 0 });

class Withdrawal_Master extends Base {
  async Getwithdrawallist() {
    return Base.mapAll(await query(DB, 'select * from withdrawal_master where status=1 order by payid desc'));
  }
}

module.exports = Withdrawal_Master;
