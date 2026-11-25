/** Exports: class ExcelPermission (table tbl_excelpermission; props TEPID, MenuId, IsActive, MenuName, URL)
 *   async AllList() : ExcelPermission[]  (all rows of tbl_excelpermission)
 */
'use strict';
const { query } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('ExcelPermission', 'tbl_excelpermission', { TEPID: 0, MenuId: 0, IsActive: 0, MenuName: null, URL: null });

class ExcelPermission extends Base {
  async AllList() {
    return Base.mapAll(await query(DB, 'select * from tbl_excelpermission'));
  }
}

module.exports = ExcelPermission;
