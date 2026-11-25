/** Exports: class Agency_Master (table tbl_agency_master; props AMID, TransId, AgencyNo, RegNo, LoginID, Amount, Purchase_Balance, Date, Active_Date, ReturnMonths, ReturnAmount, From_BrCode, From_Emp_Code, Paymode, BankName, ChkNo, Remark, Active, isBlocked, Blocked_Date, SpAmt, DistBV, IsDist, MaxPurchase, Last_Purchase_Date)
 *   Source Models/Agency_Master.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const Agency_Master = defineModel('Agency_Master', 'tbl_agency_master', { AMID: 0, TransId: null, AgencyNo: null, RegNo: 0, LoginID: null, Amount: 0, Purchase_Balance: 0, Date: null, Active_Date: null, ReturnMonths: 0, ReturnAmount: 0, From_BrCode: null, From_Emp_Code: null, Paymode: null, BankName: null, ChkNo: null, Remark: null, Active: false, isBlocked: false, Blocked_Date: null, SpAmt: 0, DistBV: 0, IsDist: false, MaxPurchase: 0, Last_Purchase_Date: null });

module.exports = Agency_Master;
