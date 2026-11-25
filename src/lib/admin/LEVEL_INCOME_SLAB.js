/** Exports: class LEVEL_INCOME_SLAB (table level_income_slab; props LISID, LEVEL, TITLE, TYPE, INCOME, STATUS, GPV, REFLISID, REFCOUNT, NoOfDownlineMember, SelfInvestments, SelfActivation, DirectMember, ToSelfInvestment)
 *   Source Models/LEVEL_INCOME_SLAB.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const LEVEL_INCOME_SLAB = defineModel('LEVEL_INCOME_SLAB', 'level_income_slab', { LISID: 0, LEVEL: 0, TITLE: null, TYPE: null, INCOME: 0, STATUS: false, GPV: 0, REFLISID: 0, REFCOUNT: 0, NoOfDownlineMember: 0, SelfInvestments: 0, SelfActivation: 0, DirectMember: 0, ToSelfInvestment: 0 });

module.exports = LEVEL_INCOME_SLAB;
