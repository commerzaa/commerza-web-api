/** Exports: class GrowthChart (table tbl_growthchart; props id, giveid, regNo, helpAmount, growthAmount, growthDate, status, active, AdminCh, Tds, Cash, Repurchase, TotalHits, RemainHits, ImageIDs, LastLogin, IpAddress, TotalImageIDs, kid)
 *   Source Models/GrowthChart.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const GrowthChart = defineModel('GrowthChart', 'tbl_growthchart', { id: 0, giveid: 0, regNo: 0, helpAmount: 0, growthAmount: 0, growthDate: null, status: 0, active: 0, AdminCh: 0, Tds: 0, Cash: 0, Repurchase: 0, TotalHits: 0, RemainHits: 0, ImageIDs: null, LastLogin: null, IpAddress: null, TotalImageIDs: null, kid: 0 });

module.exports = GrowthChart;
