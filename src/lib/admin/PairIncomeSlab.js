/** Exports: class Tbl_PairIncomeSlab (table tbl_pairincomeslab; props TPISID, Pair, Status, IsFlush, INSERTEDDATE, UPDATEDDATE)
 *   (file Models/PairIncomeSlab.cs, class Tbl_PairIncomeSlab; also available as ./Tbl_PairIncomeSlab)
 *   async PairIncome() : Tbl_PairIncomeSlab[]  (all rows)
 */
'use strict';
const { query } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Tbl_PairIncomeSlab', 'tbl_pairincomeslab', { TPISID: 0, Pair: 0, Status: 0, IsFlush: 0, INSERTEDDATE: null, UPDATEDDATE: null });

class Tbl_PairIncomeSlab extends Base {
  async PairIncome() {
    return Base.mapAll(await query(DB, 'select * from tbl_pairincomeslab'));
  }
}

module.exports = Tbl_PairIncomeSlab;
module.exports.Tbl_PairIncomeSlab = Tbl_PairIncomeSlab;
