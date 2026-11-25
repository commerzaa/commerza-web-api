/** Exports: class Tbl_Binary_Level_Income_Slab (table tbl_binary_level_income_slab; props TBLISID, LEVEL, Title, Type, Income, Status, GPV, REFLISID, REFCOUNT, NoOfDownlineMember, SelfInvestments, SelfActivation, ToSelfInvestment, DirectMember)
 *   async TblBinarylevel() : Tbl_Binary_Level_Income_Slab[]  (all rows)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Tbl_Binary_Level_Income_Slab', 'tbl_binary_level_income_slab', { TBLISID: 0, LEVEL: 0, Title: null, Type: null, Income: 0, Status: 0, GPV: 0, REFLISID: 0, REFCOUNT: 0, NoOfDownlineMember: 0, SelfInvestments: 0, SelfActivation: 0, ToSelfInvestment: 0, DirectMember: 0 });

class Tbl_Binary_Level_Income_Slab extends Base {
  async TblBinarylevel() {
    return Base.mapAll(await query(DB, 'select * from tbl_binary_level_income_slab'));
  }
}

module.exports = Tbl_Binary_Level_Income_Slab;
