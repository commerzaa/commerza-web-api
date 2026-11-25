'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\List_Admin_Role.cs (class List_Admin_RoleController => /List_Admin_Role/...)
// Database: affiliate (Db_Affiliate). Actions: Index(btnexel), ExportReport(), UpdateStatus(strrid) - see _shared/batch09_roles.js.
// class Emp_Master (Emp_ID, Emp_Code, Emp_LoginID) is an unused model in this file.
const Roll_master = require('../../lib/admin/Roll_master');
const { buildRoleList } = require('./_shared/batch09_roles');
const { tab, cellStr } = require('./_shared/batch09_common');

module.exports = buildRoleList({
  C: 'List_Admin_Role',
  routeConfig: '/admin/AdminPanel/List-Admin-Role', // route-config: "AdminPanel/List-Admin-Role" -> List_Admin_Role/Index
  lib: Roll_master,
  libArg: true, // Roll_master.AllRoleList() reads Session["Admin_User"].Emp_ID => pass req
  urlBeforeSessionCheck: false,
  excelLinkFirst: true,
  view: '~/Views/AdminPanel/List_Admin_Role/Index.cshtml',
  filename: (userid, stamp) => 'Role_List_' + userid + '_' + stamp,
  sheet: 'Role_List.xls',
  headers: ['S.No.', 'Role Name', 'Description', 'Employee Id', 'Created On', 'Updated On', 'Status'],
  cells: (item, w, RowNumber) => {
    w(tab(String(RowNumber)) + ' \t');
    w(tab(cellStr(item, 'roleName')) + ' \t');
    w(tab(cellStr(item, 'description')) + ' \t');
    w(tab(cellStr(item, 'Emp_LoginID')) + ' \t');
    w(tab(cellStr(item, 'date')) + ' \t');
    w(tab(cellStr(item, 'Updatedate')) + ' \t');
    w(tab(item.status > 0 ? 'Active' : 'Deactive') + ' \t');
  },
  innerProc: 'AllEPinRequestsList',
  outerProc: 'USP_ALL_MEMBERLIST',
  // spCreateEditRole @Emp_Id,@rid,@roleName,@roleDesc,@CollectionOfId,@mode,@chageStates,@strResult out
  proc: 'spCreateEditRole',
  procParams: (Empid, rid) => ({ Emp_Id: Empid, rid, roleName: '', roleDesc: '', CollectionOfId: '', chageStates: 1, mode: 1 }),
  errProc: 'spCreateEditRole',
});
