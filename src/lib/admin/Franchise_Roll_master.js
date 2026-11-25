/** Exports: class Franchise_Roll_master (table tbl_rolemaster_franchisepanel; props rid, roleName, description, date, status)
 *   async AllAciveRoleList() : Franchise_Roll_master[]  (status == 1)
 *   async AllRoleList() : Franchise_Roll_master[]  (status == 1)
 *   async AllActiveRoleList() : Franchise_Roll_master[]  (status == 1)
 *   async Roll_masterByid(int rid) : Franchise_Roll_master | null  (status == 1 && rid)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Franchise_Roll_master', 'tbl_rolemaster_franchisepanel', { rid: 0, roleName: null, description: null, date: null, status: 0 });

class Franchise_Roll_master extends Base {
  async AllAciveRoleList() {
    return Base.mapAll(await query(DB, 'select * from tbl_rolemaster_franchisepanel where status=1'));
  }

  async AllRoleList() {
    return Base.mapAll(await query(DB, 'select * from tbl_rolemaster_franchisepanel where status=1'));
  }

  async AllActiveRoleList() {
    return Base.mapAll(await query(DB, 'select * from tbl_rolemaster_franchisepanel where status=1'));
  }

  async Roll_masterByid(rid) {
    return Base.map(await queryOne(DB, 'select * from tbl_rolemaster_franchisepanel where status=1 and rid=@rid limit 1', { rid }));
  }
}

module.exports = Franchise_Roll_master;
