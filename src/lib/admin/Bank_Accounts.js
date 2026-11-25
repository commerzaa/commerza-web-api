/** Exports: class Bank_Accounts (table bank_accounts; props acid, regNo, accountHolderName, accountNo, bankName, branchName, ifscCode, active)
 *   static async Bank_Accounts_List() : Bank_Accounts[]  (active)
 *   static async Bank_Accounts_List_OfReg(Int64 regNo) : Bank_Accounts[]  (active && regNo)
 */
'use strict';
const { query } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Bank_Accounts', 'bank_accounts', { acid: 0, regNo: 0, accountHolderName: null, accountNo: null, bankName: null, branchName: null, ifscCode: null, active: false });

class Bank_Accounts extends Base {
  static async Bank_Accounts_List() {
    return Base.mapAll(await query(DB, 'select * from bank_accounts where active::int=1'));
  }

  static async Bank_Accounts_List_OfReg(regNo) {
    return Base.mapAll(await query(DB, 'select * from bank_accounts where active::int=1 and regno=@regNo', { regNo }));
  }
}

module.exports = Bank_Accounts;
