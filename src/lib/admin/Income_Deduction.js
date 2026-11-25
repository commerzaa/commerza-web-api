/** Exports: class Income_Deduction (table tds_section; props INT_ID, SECTION, SECTION_NAME, TDS_WITHKYC, INT_STATUS, DTM_DATE, DTM_UPDATE_DATE, TDS_WITHOUTKYC, ADMINCHARGE_WITHKYC, ADMINCHARGE_WITHOUTKYC, DEDUCTION_TIME_ID, DEDUCTION_TIME_NAME, IS_VISIBLE, CreditedInWalletTypeName, CreditedInWalletTypeid, IsWithdrawalIncome, PLATFORMCHARGE)
 *   async AllRoleList() : Income_Deduction[]  (IS_VISIBLE == 1; table tds_section)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Income_Deduction', 'tds_section', { INT_ID: 0, SECTION: null, SECTION_NAME: null, TDS_WITHKYC: 0, INT_STATUS: 0, DTM_DATE: null, DTM_UPDATE_DATE: null, TDS_WITHOUTKYC: 0, ADMINCHARGE_WITHKYC: 0, ADMINCHARGE_WITHOUTKYC: 0, DEDUCTION_TIME_ID: 0, DEDUCTION_TIME_NAME: null, IS_VISIBLE: 0, CreditedInWalletTypeName: null, CreditedInWalletTypeid: 0, IsWithdrawalIncome: 0, PLATFORMCHARGE: 0 });

class Income_Deduction extends Base {
  async AllRoleList() {
    return Base.mapAll(await query(DB, 'select * from tds_section where is_visible=1'));
  }
}

module.exports = Income_Deduction;
