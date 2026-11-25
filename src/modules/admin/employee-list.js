'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Employee_List.cs (class Employee_ListController, no namespace => /Employee_List/...)
// Database: affiliate (Db_Affiliate). Procs USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK, usp_GetBranch, usp_All_EmployeeList,
// USP_EXCEL_DOWNLOAD_HISTORY, USP_GET_DASHBOARDROLLROLEDETAIL.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Roll_master = require('../../lib/admin/Roll_master');
const { adminAuth, legacyUrl, issueAdminToken } = require('./_shared/admin-session');
const {
  nInt, nStr, col, inlinePerms, nowStamp, excelHistory, writeXlsExport, cellStr, tab, dynPaging, intParse, trimNull,
} = require('./_shared/batch06-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Employee_List';

/** public class AllEmployeehlist */
const ALL_EMPLOYEE_PROPS = ['ROWNUMBER', 'EMP_CODE', 'EMP_ID', 'EMP_LOGINID', 'BRNAME', 'EMP_NAME', 'EMP_EMAIL', 'EMP_MOBILE', 'EMP_IMAGE', 'TOTALEMP',
  'STATUS', 'CURRENT_BALANCE', 'TOTALROLES', 'COM_TITLE', 'EMP_PANNO', 'dashboard_role', 'QRCODEISACTIVE'];
/** public class EmpBranch (RoleMaster is declared but unused) */
const EMP_BRANCH_PROPS = ['BrCode', 'BrName', 'empcount'];
/** DashboardRoleList.cs class DashboardRoleList */
const DASHBOARD_ROLE_PROPS = ['DBRID', 'ROLENAME', 'DESCRIPTION', 'CREATEDDATE', 'UPDATEDATE', 'STATUS', 'EMP_LOGINID'];

// PORT-NOTE: `public static DataUtility objdut` (unused) and `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** private bool ThumbnailCallback() - throws NotImplementedException (unused; not an action). */
function ThumbnailCallback() { // eslint-disable-line no-unused-vars
  throw new Error('The method or operation is not implemented.');
}

/** usp_All_EmployeeList @StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@ToDate,@status,@Brtid,@Rolename,@TotalCount out[,@empid] */
const employeeList = (p) => db.proc(DB, 'usp_All_EmployeeList', p);

/** public void ExportReport(string fromDate, string toDate, string SearchField, string SearchValue, string status, string brtid, string RoleMaster) */
async function ExportReport(req, res, fromDate, toDate, SearchField, SearchValue, status, brtid, RoleMaster, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'EmployeeList_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  ViewBag.Empbranch = mapRows(await db.proc(DB, 'usp_GetBranch', {}), EMP_BRANCH_PROPS);
  ViewBag.rolMaster = await new Roll_master().AllAciveRoleList();
  const list = mapRows(await employeeList({
    StartRowIndex: 1, MaxRows: 999999, SearchField: trimNull(SearchField), SearchValue: trimNull(SearchValue), fromDate: trimNull(fromDate),
    ToDate: trimNull(toDate), status: trimNull(status), Brtid: trimNull(brtid), Rolename: RoleMaster,
  }), ALL_EMPLOYEE_PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'EmployeeList.xls', Filename, ViewBag, rows: list,
      headers: ['S.No.', 'Emp. Id', 'Name', 'Email', 'Contact', 'Admin Role', 'Dashboard Role', 'Status'],
      innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        for (const k of ['ROWNUMBER', 'EMP_CODE', 'EMP_NAME', 'EMP_EMAIL', 'EMP_MOBILE']) w(tab(cellStr(item, k)) + ' \t');
        w(cellStr(item, 'TOTALROLES').replace(/\t/g, ' ') + ' \t'); // this column replaced tabs with ONE space
        w(tab(cellStr(item, 'dashboard_role')) + ' \t');
        w(tab(cellStr(item, 'STATUS')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string SearchField, string btnexel, string SearchValue, string brtid,
//   string fromDate, string toDate, string status, string RoleMaster, int? page)
// auth (Session["Admin_User"] dereferenced before the null check => adminAuth)
// route-config: "AdminPanel/employee-list" -> Employee_List/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/employee-list'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let SearchField = nStr(req.p.SearchField);
  let btnexel = nStr(req.p.btnexel);
  let SearchValue = nStr(req.p.SearchValue);
  let brtid = nStr(req.p.brtid);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let status = nStr(req.p.status);
  let RoleMaster = nStr(req.p.RoleMaster);
  let page = nInt(req.p.page);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  if (dynamicpagging === null) dynamicpagging = dynPaging();
  const perm = await inlinePerms(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = perm.excelactive;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (btnexel === null) btnexel = '';
  if (toDate === null) toDate = '';
  if (status === null) status = '';
  if (brtid === null) brtid = '';
  if (RoleMaster === null) RoleMaster = '';
  else RoleMaster = RoleMaster.replace(/^\^+|\^+$/g, ''); // RoleMaster.Trim('^')
  const Empid = req.user.emp_id;
  // Session["Admin_User_Menu"] = UtilityClass.UpdateAdminMenu(Empid); Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid);
  sessionStore.set(req, 'Admin_User_Menu', await UtilityClass.UpdateAdminMenu(Empid));
  const emp = await new UtilityClass().UpdateAdminUserSession(Empid);
  const token = emp ? issueAdminToken(emp) : undefined;
  ViewBag.Empbranch = mapRows(await db.proc(DB, 'usp_GetBranch', {}), EMP_BRANCH_PROPS);
  ViewBag.rolMaster = await new Roll_master().AllAciveRoleList();
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await employeeList({
    StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(), fromDate: fromDate.trim(), ToDate: toDate.trim(),
    status: status.trim(), Brtid: brtid.trim(), Rolename: RoleMaster, empid: Empid,
  });
  const AllEmplist = mapRows(rows, ALL_EMPLOYEE_PROPS);
  const TotalRecord = intParse(col(rows[0], 'TotalCount'));
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.brtid = brtid.trim();
  ViewBag.status = status.trim();
  ViewBag.RoleMaster = RoleMaster;
  if (btnexel === 'Export Excel') {
    const x = await ExportReport(req, res, fromDate, toDate, SearchField, SearchValue, status, brtid, RoleMaster, ViewBag);
    if (x.sent) return undefined;
  }
  const out = { view: '~/Views/AdminPanel/Employee_List/Index.cshtml', Model: AllEmplist, ...ViewBag };
  if (token) out.token = token; // refreshed Session["Admin_User"]
  return res.json(out);
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, string SearchField, string SearchValue,
//   string status, string brtid, string RoleMaster)
// auth (PORT-NOTE: public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.fromDate), nStr(req.p.toDate), nStr(req.p.SearchField), nStr(req.p.SearchValue),
    nStr(req.p.status), nStr(req.p.brtid), nStr(req.p.RoleMaster), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- public void viewbagcolletion()
// public (legacy had no session check; it only fills ViewBag and returns nothing)
router.all(`/admin/${C}/viewbagcolletion{/:id}`, asyncHandler(async (req, res) => {
  // ViewBag.TotalRecord = 0; SearchField/SearchValue/fromDate/toDate/status/RoleMaster = "" - never rendered (void action)
  res.send('');
}));

// ---------------------------------------------------------------- JsonResult gerEmployeeDetails(string gerimpid)
// auth (PORT-NOTE: legacy had no session check; employee data => adminAuth)
router.all(`/admin/${C}/gerEmployeeDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const gerimpid = nStr(req.p.gerimpid);
  const AllEmplist = mapRows(await employeeList({
    StartRowIndex: 1, MaxRows: 1, SearchField: 'Emp_ID', SearchValue: trimNull(gerimpid), fromDate: '', ToDate: '', status: '', Brtid: '', Rolename: '',
  }), ALL_EMPLOYEE_PROPS);
  return res.json(AllEmplist);
}));

// ---------------------------------------------------------------- JsonResult GetempRoles()
// auth (Roll_master.AllRoleList reads the logged-in admin's Emp_ID from the session)
router.all(`/admin/${C}/GetempRoles{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  res.json(await new Roll_master().AllRoleList(req));
}));

// ---------------------------------------------------------------- JsonResult GetDashboardRoles()
// auth (PORT-NOTE: legacy had no session check but dereferences Session["Admin_User"] => adminAuth)
router.all(`/admin/${C}/GetDashboardRoles{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Emp_ID = req.user.emp_id;
  const _DashboardRole = mapRows(await db.proc(DB, 'USP_GET_DASHBOARDROLLROLEDETAIL', { EMPID: Emp_ID }), DASHBOARD_ROLE_PROPS);
  res.json(_DashboardRole);
}));

module.exports = router;
