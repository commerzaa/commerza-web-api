/** Exports: class state_with_vat (table tbl_state_with_vat; props swvid, SID, stateName, vcid, vatTitle, vatPerc, state_OH, active)
 *   async state_with_vat_list() : state_with_vat[]  (active)
 *   async state_with_vat_Onvcid(int vcid) : state_with_vat[]  (active && vcid)
 *   async state_with_vat_OnSID(int SID) : state_with_vat[]  (active && SID)
 *   async state_with_vat_OnstateName(string stateName) : state_with_vat[]  (active && stateName)
 */
'use strict';
const { query } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('state_with_vat', 'tbl_state_with_vat', { swvid: 0, SID: 0, stateName: null, vcid: 0, vatTitle: null, vatPerc: 0, state_OH: 0, active: false });

class state_with_vat extends Base {
  async state_with_vat_list() {
    return Base.mapAll(await query(DB, 'select * from tbl_state_with_vat where active::int=1'));
  }

  async state_with_vat_Onvcid(vcid) {
    return Base.mapAll(await query(DB, 'select * from tbl_state_with_vat where active::int=1 and vcid=@vcid', { vcid }));
  }

  async state_with_vat_OnSID(SID) {
    return Base.mapAll(await query(DB, 'select * from tbl_state_with_vat where active::int=1 and sid=@SID', { SID }));
  }

  async state_with_vat_OnstateName(stateName) {
    return Base.mapAll(await query(DB, 'select * from tbl_state_with_vat where active::int=1 and statename=@stateName', { stateName }));
  }
}

module.exports = state_with_vat;
