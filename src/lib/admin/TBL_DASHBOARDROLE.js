/** Exports: class TBL_DASHBOARDROLE (table tbl_dashboardrole; props DBRID, ROLENAME, STATUS, DESCRIPTION)
 *   Source Models/TBL_DASHBOARDROLE.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const TBL_DASHBOARDROLE = defineModel('TBL_DASHBOARDROLE', 'tbl_dashboardrole', { DBRID: 0, ROLENAME: null, STATUS: 0, DESCRIPTION: null });

module.exports = TBL_DASHBOARDROLE;
