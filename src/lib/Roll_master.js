/** Exports: class Roll_master (table tbl_rolemaster; props rid, roleName, description, date, status)
 *   async AllAciveRoleList() : Roll_master[] ; async AllRoleList() : Roll_master[] ; async AllActiveRoleList() : Roll_master[]  (all: status == 1)
 *   async Roll_masterByid(int rid) : Roll_master | null
 */
'use strict';
const { query, queryOne } = require('../db');
const { mapRow, mapRows } = require('../utils/shape');

const PROPS = ['rid', 'roleName', 'description', 'date', 'status'];

class Roll_master {
  async AllAciveRoleList() {
    return mapRows(await query('affiliate', 'select * from tbl_rolemaster where status=1'), PROPS);
  }

  async AllRoleList() {
    return mapRows(await query('affiliate', 'select * from tbl_rolemaster where status=1'), PROPS);
  }

  async AllActiveRoleList() {
    return mapRows(await query('affiliate', 'select * from tbl_rolemaster where status=1'), PROPS);
  }

  async Roll_masterByid(rid) {
    return mapRow(await queryOne('affiliate', 'select * from tbl_rolemaster where status=1 and rid=@rid limit 1', { rid }), PROPS);
  }
}

module.exports = Roll_master;
