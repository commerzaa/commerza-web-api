/** Exports: class Customer_Paymodes (table tbl_customer_paymodes; props CPM, CP_CODE, CP_MODE, ACTIVE)
 *   static async CustomerPaymodeList() : Customer_Paymodes[]  (ACTIVE, by CP_MODE)
 *   static async CustomerPaymodeList_MRP() : Customer_Paymodes[]  (ACTIVE && CPM == 1, by CP_MODE)
 */
'use strict';
const { query } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Customer_Paymodes', 'tbl_customer_paymodes', { CPM: 0, CP_CODE: null, CP_MODE: null, ACTIVE: false });

class Customer_Paymodes extends Base {
  static async CustomerPaymodeList() {
    return Base.mapAll(await query(DB, 'select * from tbl_customer_paymodes where active::int=1 order by cp_mode'));
  }

  static async CustomerPaymodeList_MRP() {
    return Base.mapAll(await query(DB, 'select * from tbl_customer_paymodes where active::int=1 and cpm=1 order by cp_mode'));
  }
}

module.exports = Customer_Paymodes;
