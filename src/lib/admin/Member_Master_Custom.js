/** Exports: class Member_Master_Custom (no table; props regNo, IntroRegNo, LoginId, sponserID, Name, userName, EmailID, Mobile, ImageName, UserType, ADID, LastLogin, MemType, ROI, Member_Unique_Id, Application_FormNo)
 *          class Tbl_RechargeHistory (table tbl_rechargehistory; props TRHID, PLID, DateAndTime, MobileNumber, Operator, Amount, Api_REFID, Api_Balance, Api_ErrorCode, Api_Remark, Api_REQID, Api_Status, Status, OpCode, ATC, IsAmountRefunded)
 *   Source Models/Member_Master_Custom.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const Member_Master_Custom = defineModel('Member_Master_Custom', null, { regNo: 0, IntroRegNo: 0, LoginId: null, sponserID: null, Name: null, userName: null, EmailID: null, Mobile: null, ImageName: null, UserType: null, ADID: null, LastLogin: null, MemType: 0, ROI: 0, Member_Unique_Id: null, Application_FormNo: null });
const Tbl_RechargeHistory = defineModel('Tbl_RechargeHistory', 'tbl_rechargehistory', { TRHID: 0, PLID: 0, DateAndTime: null, MobileNumber: null, Operator: null, Amount: 0, Api_REFID: null, Api_Balance: 0, Api_ErrorCode: null, Api_Remark: null, Api_REQID: null, Api_Status: null, Status: 0, OpCode: null, ATC: 0, IsAmountRefunded: 0 });

module.exports = Member_Master_Custom;
module.exports.Tbl_RechargeHistory = Tbl_RechargeHistory;
