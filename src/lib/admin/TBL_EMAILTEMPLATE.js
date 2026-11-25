/** Exports: class TBL_EMAILTEMPLATE (table tbl_emailtemplate; props ETID, TITLE, SUBJECT, EMAILCONTENT)
 *   Source Models/TBL_EMAILTEMPLATE.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const TBL_EMAILTEMPLATE = defineModel('TBL_EMAILTEMPLATE', 'tbl_emailtemplate', { ETID: 0, TITLE: null, SUBJECT: null, EMAILCONTENT: null });

module.exports = TBL_EMAILTEMPLATE;
