/** Exports: class Roll_master (table tbl_rolemaster; props rid, roleName, description, date, status)
 *          class RollMaster_EmployeeMaster (no table; props rid, roleName, description, date, Updatedate, status, Emp_LoginID)
 *   async AllAciveRoleList() : Roll_master[]  (status == 1)
 *   async AllRoleList(reqOrEmpId) : RollMaster_EmployeeMaster[]  (proc USP_GET_EMPIDANDROLEDETAIL @EMPID = logged-in admin Emp_ID)
 *   async AllActiveRoleList(reqOrEmpId) : Roll_master[]  (status == 1; plus rid != 1 unless the logged-in Emp_ID == 1)
 *   async Roll_masterByid(int rid) : Roll_master | null  (status == 1 && rid)
 *   Roll_master.RollMaster_EmployeeMaster : model class (also ./RollMaster_EmployeeMaster)
 * PORT-NOTE: legacy read ((Employee_Master)Session["Admin_User"]).Emp_ID. Pass the Express req (JWT req.user: Emp_ID / emp_id /
 *   empid / admin_user.Emp_ID) or the Emp_ID number. Missing value => TypeError (legacy NullReferenceException).
 */
'use strict';
const { query, queryOne, proc } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Roll_master', 'tbl_rolemaster', { rid: 0, roleName: null, description: null, date: null, status: 0 });
const RollMaster_EmployeeMaster = defineModel('RollMaster_EmployeeMaster', null, { rid: 0, roleName: null, description: null, date: null, Updatedate: null, status: 0, Emp_LoginID: null });

function sessionEmpId(x) {
  if (typeof x === 'number' || typeof x === 'string') return Number(x);
  const u = x && (x.user || x);
  const a = u && (u.Admin_User || u.admin_user);
  const v = u && (u.Emp_ID ?? u.emp_id ?? u.empid ?? (a && (a.Emp_ID ?? a.emp_id)));
  if (v === undefined || v === null) throw new TypeError('Object reference not set to an instance of an object.');
  return Number(v);
}

class Roll_master extends Base {
  async AllAciveRoleList() {
    return Base.mapAll(await query(DB, 'select * from tbl_rolemaster where status=1'));
  }

  async AllRoleList(reqOrEmpId) {
    const Emp_ID = sessionEmpId(reqOrEmpId);
    return RollMaster_EmployeeMaster.mapAll(await proc(DB, 'usp_get_empidandroledetail', { empid: Emp_ID }));
  }

  async AllActiveRoleList(reqOrEmpId) {
    const Emp_ID = sessionEmpId(reqOrEmpId);
    let row;
    if (Emp_ID === 1) {
      row = await query(DB, 'select * from tbl_rolemaster where status=1');
    } else {
      row = await query(DB, 'select * from tbl_rolemaster where status=1 and rid<>1');
    }
    return Base.mapAll(row);
  }

  async Roll_masterByid(rid) {
    return Base.map(await queryOne(DB, 'select * from tbl_rolemaster where status=1 and rid=@rid limit 1', { rid }));
  }
}

module.exports = Roll_master;
module.exports.RollMaster_EmployeeMaster = RollMaster_EmployeeMaster;
