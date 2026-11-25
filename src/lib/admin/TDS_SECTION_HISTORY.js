/** Exports: class TDS_SECTION_HISTORY (table tds_section_history; props TID, Sectionname, TDS_with_kyc, TDS_without_kyc, Admin_charge, Admin_charge_without_kyc, DeductionName, ISWITH_DRWAL_INCOME, Creditedin_wallet_Type, Creditedin_wallet_id, UserId, ActivityReport, Status)
 *   Source Models/TDS_SECTION_HISTORY.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const TDS_SECTION_HISTORY = defineModel('TDS_SECTION_HISTORY', 'tds_section_history', { TID: 0, Sectionname: null, TDS_with_kyc: 0, TDS_without_kyc: 0, Admin_charge: 0, Admin_charge_without_kyc: 0, DeductionName: null, ISWITH_DRWAL_INCOME: 0, Creditedin_wallet_Type: null, Creditedin_wallet_id: 0, UserId: 0, ActivityReport: null, Status: 0 });

module.exports = TDS_SECTION_HISTORY;
