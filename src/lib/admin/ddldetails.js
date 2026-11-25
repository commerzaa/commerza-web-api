/** Exports: class ddldetails (table tbl_dropdowndetails; props DDDID, DDID, Type, Content, Details, STATUS)
 *   Source Models/ddldetails.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const ddldetails = defineModel('ddldetails', 'tbl_dropdowndetails', { DDDID: 0, DDID: 0, Type: null, Content: null, Details: null, STATUS: 0 });

module.exports = ddldetails;
