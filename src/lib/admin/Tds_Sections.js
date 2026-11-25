/** Exports: class Tds_Sections (table tbl_tdssections; props TDSSID, SECTION_NAME, STATUS)
 *   async AllRoleList() : Tds_Sections[]  (STATUS == 1)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Tds_Sections', 'tbl_tdssections', { TDSSID: 0, SECTION_NAME: null, STATUS: 0 });

class Tds_Sections extends Base {
  async AllRoleList() {
    return Base.mapAll(await query(DB, 'select * from tbl_tdssections where status=1'));
  }
}

module.exports = Tds_Sections;
