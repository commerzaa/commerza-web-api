/** Exports: class WalletType (table tbl_wallettype; props TWTID, WalletTypeName, Status, Active, Description, IsWithdrawalIncome, IsVisible)
 *   async WalletTypelist() : WalletType[]  (IsVisible == 1, by WalletTypeName)
 *   async WalletTypelist(int TWTID) : WalletType[]  (IsVisible == 1 && TWTID, by WalletTypeName)  -- C# overload: dispatched on argument count
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('WalletType', 'tbl_wallettype', { TWTID: 0, WalletTypeName: null, Status: 0, Active: 0, Description: null, IsWithdrawalIncome: 0, IsVisible: 0 });

class WalletType extends Base {
  async WalletTypelist(...args) {
    if (args.length === 0) {
      return Base.mapAll(await query(DB, 'select * from tbl_wallettype where isvisible=1 order by wallettypename'));
    }
    const TWTID = args[0];
    return Base.mapAll(await query(DB, 'select * from tbl_wallettype where isvisible=1 and twtid=@TWTID order by wallettypename', { TWTID }));
  }
}

module.exports = WalletType;
