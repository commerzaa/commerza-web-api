/** Exports: class TBL_SMSTEMPLATE (table tbl_smstemplate; props STID, TITLE, MESSAGE, UPDATEDON, UPDATEDBY, STATUS)
 *   Source Models/TBL_SMSTEMPLATE.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const TBL_SMSTEMPLATE = defineModel('TBL_SMSTEMPLATE', 'tbl_smstemplate', { STID: 0, TITLE: null, MESSAGE: null, UPDATEDON: null, UPDATEDBY: 0, STATUS: 0 });

module.exports = TBL_SMSTEMPLATE;
