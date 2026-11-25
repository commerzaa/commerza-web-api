/** Exports: class Dynamic_ProfileUpdatePage (table tbl_detailspagemasterforprofileupdation; props TDPMFRID, FIELDNAME, DISPLAYSHOW, SHOWACTIVE, VALIDATIONACTIVE, ISEDIT, STATUS, ACTIVE, FID)
 *   async AllRoleList() : Dynamic_ProfileUpdatePage[]  (STATUS == 1 && TDPMFRID not in 21,22,23,24)
 */
'use strict';
const { query } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Dynamic_ProfileUpdatePage', 'tbl_detailspagemasterforprofileupdation', { TDPMFRID: 0, FIELDNAME: null, DISPLAYSHOW: 0, SHOWACTIVE: 0, VALIDATIONACTIVE: 0, ISEDIT: 0, STATUS: 0, ACTIVE: 0, FID: null });

class Dynamic_ProfileUpdatePage extends Base {
  async AllRoleList() {
    return Base.mapAll(await query(DB, 'select * from tbl_detailspagemasterforprofileupdation where status=1 and tdpmfrid<>21 and tdpmfrid<>22 and tdpmfrid<>23 and tdpmfrid<>24'));
  }
}

module.exports = Dynamic_ProfileUpdatePage;
