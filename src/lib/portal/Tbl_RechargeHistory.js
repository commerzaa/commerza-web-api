/** Exports: Tbl_RechargeHistory - EF entity / SqlQuery<T> property bag from Models/Tbl_RechargeHistory.cs.
 *  { PROPS: [PascalCase property names for mapRows], TABLE: '<postgres table>' } (no methods in the C#). */
'use strict';

const Tbl_RechargeHistory = { PROPS: ['TRHID', 'PLID', 'DateAndTime', 'MobileNumber', 'Operator', 'Amount', 'Api_REFID', 'Api_Balance', 'Api_ErrorCode', 'Api_Remark', 'Api_REQID', 'Api_Status', 'Status', 'OpCode', 'IsAmountRefunded'], TABLE: 'tbl_rechargehistory' };

module.exports = { ...Tbl_RechargeHistory, Tbl_RechargeHistory };
