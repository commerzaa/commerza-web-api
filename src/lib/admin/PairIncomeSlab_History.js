/** Exports: class PairIncomeSlab_History (table tbl_pairincomeslab_history; props TBLISID, Pair, IsFlush, UserId, ActivityReport, Status)
 *   Source Models/PairIncomeSlab_History.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const PairIncomeSlab_History = defineModel('PairIncomeSlab_History', 'tbl_pairincomeslab_history', { TBLISID: 0, Pair: 0, IsFlush: 0, UserId: 0, ActivityReport: null, Status: 0 });

module.exports = PairIncomeSlab_History;
