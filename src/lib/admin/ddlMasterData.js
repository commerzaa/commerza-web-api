/** Exports: class ddlMasterData (table tbl_dropdown; props DDID, NAME, DESCRIPTION, STATUS)
 *   Source Models/ddlMasterData.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const ddlMasterData = defineModel('ddlMasterData', 'tbl_dropdown', { DDID: 0, NAME: null, DESCRIPTION: null, STATUS: 0 });

module.exports = ddlMasterData;
