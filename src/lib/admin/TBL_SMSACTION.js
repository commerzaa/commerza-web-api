/** Exports: class TBL_SMSACTION (table tbl_smsaction; props ID, ModuleId, Action_Name, Sms_Content, Action_Status, SMSCategory, Sms_Send_Status)
 *   Source Models/TBL_SMSACTION.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const TBL_SMSACTION = defineModel('TBL_SMSACTION', 'tbl_smsaction', { ID: 0, ModuleId: 0, Action_Name: null, Sms_Content: null, Action_Status: null, SMSCategory: null, Sms_Send_Status: 0 });

module.exports = TBL_SMSACTION;
