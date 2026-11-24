/** Exports: class Give_Help (table give_help)   async Create(decimal amount, int RegNo) : { InvestID, Message }  (USP_PROVIDEHELP; then DAL_Help_Master.Create_Admin_Links(RegNo, "") when InvestID != "0") */
'use strict';
const { procOne } = require('../db');
const { out, toStr } = require('./_libhelpers');

class Give_Help {
  async Create(amount, RegNo) {
    const Result = { InvestID: null, Message: null };
    const row = await procOne('affiliate', 'USP_PROVIDEHELP', { PLID: RegNo, AMOUNT: amount, PACKAGEID: 0 });
    Result.InvestID = toStr(out(row, 'INVESTID'));
    Result.Message = toStr(out(row, 'STRRESULT'));
    if (Result.InvestID !== '0') {
      const DAL_Help_Master = require('./DAL_Help_Master');
      const dh = new DAL_Help_Master();
      // string Address=BlockChainTransClass.Generate_BTC_Address();  (commented out in legacy)
      await dh.Create_Admin_Links(RegNo, '');
    }
    return Result;
  }
}

module.exports = Give_Help;
