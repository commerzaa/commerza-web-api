/** Exports: class Kit_Type (table tbl_kittype; props KTID, KType, Date, Active)
 *   async GetKitTypeList() : Kit_Type[]  (Active, KType desc)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Kit_Type', 'tbl_kittype', { KTID: 0, KType: null, Date: null, Active: false });

class Kit_Type extends Base {
  async GetKitTypeList() {
    return Base.mapAll(await query(DB, 'select * from tbl_kittype where active::int=1 order by ktype desc'));
  }
}

module.exports = Kit_Type;
