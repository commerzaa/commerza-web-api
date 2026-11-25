'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\List_Member_Role.cs (class List_Member_RoleController => /List_Member_Role/...)
// Database: affiliate (Db_Affiliate). Actions: Index(btnexel), ExportReport(), UpdateStatus(strrid) - see _shared/batch09_roles.js.
// (List<SubMenuDetail> AllSubMenuDetail in ExportReport is never used.)
const Member_Roll_master = require('../../lib/admin/Member_Roll_master');
const { buildRoleList } = require('./_shared/batch09-roles');
const { tab, cellStr } = require('./_shared/batch09-common');

module.exports = buildRoleList({
  C: 'List_Member_Role',
  routeConfig: '/admin/AdminPanel/List-Member-Role', // route-config: "AdminPanel/List-Member-Role" -> List_Member_Role/Index
  lib: Member_Roll_master,
  libArg: false,
  urlBeforeSessionCheck: false,
  excelLinkFirst: false,
  view: '~/Views/AdminPanel/List_Member_Role/Index.cshtml',
  filename: (userid, stamp) => 'Member_Role_List' + userid + '_' + stamp,
  sheet: 'Member_Role_List.xls',
  downloadName: ' Member_Role_List.xls', // (sic) "filename= Member_Role_List.xls"
  headers: ['S.No.', 'Role Name', 'Description', 'STATUS'],
  cells: (item, w, srno) => {
    w(tab(String(srno)) + ' \t');
    w(tab(cellStr(item, 'roleName')) + ' \t');
    w(tab(cellStr(item, 'description')) + ' \t');
    w(tab(item.status > 0 ? 'Active' : 'Deactive') + ' \t');
  },
  innerProc: 'ExportReport',
  outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
  // SpCreateEditRole_From_Member @rid,@roleName,@roleDesc,@CollectionOfId,@mode,@chageStates,@strResult out
  proc: 'SpCreateEditRole_From_Member',
  procParams: (Empid, rid) => ({ rid, roleName: '', roleDesc: '', CollectionOfId: '', chageStates: 1, mode: 1 }),
  errProc: 'SpCreateEditRole_From_Member',
});
