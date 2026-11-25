/** Exports: class Trans_Type (table trans_type; props TTID, TType, TTitle, Active)
 *   async Trans_Type_List() : Trans_Type[]  (Active)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Trans_Type', 'trans_type', { TTID: 0, TType: null, TTitle: null, Active: false });

class Trans_Type extends Base {
  async Trans_Type_List() {
    return Base.mapAll(await query(DB, 'select * from trans_type where active::int=1'));
  }
}

module.exports = Trans_Type;
