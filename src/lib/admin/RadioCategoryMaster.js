/** Exports: class RadioCategoryMaster (table tbl_questiontypemaster; props TQTMID, QUESTIONTYPE, CREATEDBY, ISACTIVE)
 *   async RadioCategoryMasterList() : RadioCategoryMaster[]  (ISACTIVE == 1, by TQTMID)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('RadioCategoryMaster', 'tbl_questiontypemaster', { TQTMID: 0, QUESTIONTYPE: null, CREATEDBY: 0, ISACTIVE: 0 });

class RadioCategoryMaster extends Base {
  async RadioCategoryMasterList() {
    return Base.mapAll(await query(DB, 'select * from tbl_questiontypemaster where isactive=1 order by tqtmid'));
  }
}

module.exports = RadioCategoryMaster;
