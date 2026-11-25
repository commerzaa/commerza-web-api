'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\List_Franchise_Role.cs (class List_Franchise_RoleController => /List_Franchise_Role/...)
// Database: affiliate (Db_Affiliate). Actions: Index(btnexel), ExportReport(), UpdateStatus(strrid) - see _shared/batch09_roles.js.
const Franchise_Roll_master = require('../../lib/admin/Franchise_Roll_master');
const { buildRoleList } = require('./_shared/batch09-roles');
const { tab, cellStr } = require('./_shared/batch09-common');

module.exports = buildRoleList({
  C: 'List_Franchise_Role',
  routeConfig: '/admin/AdminPanel/List-Franchise-Role', // route-config: "AdminPanel/List-Franchise-Role" -> List_Franchise_Role/Index
  lib: Franchise_Roll_master,
  libArg: false,
  urlBeforeSessionCheck: true, // url/url1 statics were set before the session check
  excelLinkFirst: true,
  view: '~/Views/AdminPanel/List_Franchise_Role/Index.cshtml',
  filename: (userid, stamp) => 'Text_' + userid + '_' + stamp,
  sheet: 'Franchise_Role_List.xls',
  headers: ['S.No.', 'Role Name', 'Description', 'Status'],
  cells: (item, w, RowNumber) => {
    w(tab(String(RowNumber)) + ' \t');
    w(tab(cellStr(item, 'roleName')) + ' \t');
    w(tab(cellStr(item, 'description')) + ' \t');
    w(tab(item.status > 0 ? 'Active' : 'Deactive') + ' \t');
  },
  innerProc: 'AllEPinRequestsList',
  outerProc: 'USP_ALL_MEMBERLIST',
  // SpCreateEditRole_From_Franchise @rid,@roleName,@roleDesc,@CollectionOfId,@mode,@chageStates,@strResult out
  proc: 'SpCreateEditRole_From_Franchise',
  procParams: (Empid, rid) => ({ rid, roleName: '', roleDesc: '', CollectionOfId: '', chageStates: 1, mode: 1 }),
  errProc: 'SpCreateEditRole_From_Member', // (sic) legacy PROCEDURENAME
});
