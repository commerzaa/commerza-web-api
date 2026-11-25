/** Exports: class tbl_emailaction (table tbl_emailaction; props Email_Content, Email_Send_Status, Email_Subject, Action_Name, EID)
 *   Source Models/tbl_emailaction.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const tbl_emailaction = defineModel('tbl_emailaction', 'tbl_emailaction', { Email_Content: null, Email_Send_Status: 0, Email_Subject: null, Action_Name: null, EID: 0 });

module.exports = tbl_emailaction;
