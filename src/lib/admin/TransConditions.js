/** Exports: class TransConditions (table tbl_transconditions; props Tcid, Title, MinAmount, MaxAmount, AdminCharge, MultipleAmount, Tds, NoOfTimesPerDay, IsOnlyDownLine, IsStop, Description)
 *   async TranConditions_List() : TransConditions[]  (all rows)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('TransConditions', 'tbl_transconditions', { Tcid: 0, Title: null, MinAmount: 0, MaxAmount: 0, AdminCharge: 0, MultipleAmount: 0, Tds: 0, NoOfTimesPerDay: 0, IsOnlyDownLine: false, IsStop: false, Description: null });

class TransConditions extends Base {
  async TranConditions_List() {
    return Base.mapAll(await query(DB, 'select * from tbl_transconditions'));
  }
}

module.exports = TransConditions;
