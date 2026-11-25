/** Exports: class GROWTH_LEVEL_INCOME_SLAB (table growth_level_income_slab; props GLISID, LEVEL, TITLE, TYPE, INCOME, STATUS, GPV, REFLISID, REFCOUNT, NoOfDownlineMember, SelfActivation, SelfInvestMents, TotalLeftMember, TotalRightMember, ToSelfInvestment, DirectMember)
 *   Source Models/GROWTH_LEVEL_INCOME_SLAB.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const GROWTH_LEVEL_INCOME_SLAB = defineModel('GROWTH_LEVEL_INCOME_SLAB', 'growth_level_income_slab', { GLISID: 0, LEVEL: 0, TITLE: null, TYPE: null, INCOME: 0, STATUS: false, GPV: 0, REFLISID: 0, REFCOUNT: 0, NoOfDownlineMember: 0, SelfActivation: 0, SelfInvestMents: 0, TotalLeftMember: 0, TotalRightMember: 0, ToSelfInvestment: 0, DirectMember: 0 });

module.exports = GROWTH_LEVEL_INCOME_SLAB;
