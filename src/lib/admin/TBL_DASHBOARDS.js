/** Exports: class TBL_DASHBOARDS (table tbl_dashboards; props TDID, URL, IMAGE, ACTINE, DASHBOARDNAME, TITLE)
 *   Source Models/TBL_DASHBOARDS.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const TBL_DASHBOARDS = defineModel('TBL_DASHBOARDS', 'tbl_dashboards', { TDID: 0, URL: null, IMAGE: null, ACTINE: 0, DASHBOARDNAME: null, TITLE: null });

module.exports = TBL_DASHBOARDS;
