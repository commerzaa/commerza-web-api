/** Exports: class Level_Entry (table levelentry; props id, parentRegNo, childRegNo, level, date, status, side)
 *   Source Models/Level_Entry.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const Level_Entry = defineModel('Level_Entry', 'levelentry', { id: 0, parentRegNo: 0, childRegNo: 0, level: 0, date: null, status: false, side: 0 });

module.exports = Level_Entry;
