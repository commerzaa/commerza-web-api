/** Exports: class Sponsor_Trade_Slabs (table tbl_sponsortradeprofit; props STPID, INVESTMENTFROM, INVESTMENTTO, STPPERCENTAGE, ACTIVE, ACTIVEMEMBER, SELFACTIVE)
 *   Source Models/Sponsor_Trade_Slabs.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const Sponsor_Trade_Slabs = defineModel('Sponsor_Trade_Slabs', 'tbl_sponsortradeprofit', { STPID: 0, INVESTMENTFROM: 0, INVESTMENTTO: 0, STPPERCENTAGE: 0, ACTIVE: 0, ACTIVEMEMBER: 0, SELFACTIVE: 0 });

module.exports = Sponsor_Trade_Slabs;
