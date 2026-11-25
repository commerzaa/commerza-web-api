'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\DashboardRoleList.cs (class DashboardRoleListController => /admin/DashboardRoleList/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, isAdmin, legacyUrl, errorInsert } = require('./_shared/adminSession');
const { pagePermissions, excelLink } = require('./_shared/loginLogCommon');
const B = require('./_shared/batch05_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'DashboardRoleList';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** class DashboardRoleList */
const DRL_PROPS = ['DBRID', 'ROLENAME', 'DESCRIPTION', 'CREATEDDATE', 'UPDATEDATE', 'STATUS', 'EMP_LOGINID'];

/** public void ExportReport() */
async function ExportReport(req, res, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Dashboard_Role_List_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const EmpId = req.user.emp_id;
  const _DashboardRoleList = mapRows(await db.proc(DB, 'SpCreateEditRole_Dashboard', {
    Emp_Id: EmpId, roleName: '', roleDesc: '', CollectionOfId: '', mode: 4,
  }), DRL_PROPS);
  if (_DashboardRoleList.length > 0) {
    let RowNumber = 1;
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Dashboard_Role_List.xls', Filename,
      headers: ['S.No.', 'Role Name', 'Description', 'Status'],
      rows: _DashboardRoleList, innerProc: 'AllEPinRequestsList', outerProc: 'USP_ALL_MEMBERLIST',
      cells: (item, w) => {
        w('\n');
        w(B.tab(String(RowNumber)) + ' \t');
        w(B.tab(B.cellStr(item, 'ROLENAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'DESCRIPTION')) + ' \t');
        w(B.tab(Number(item.STATUS) > 0 ? 'Active' : 'Deactive') + ' \t');
        RowNumber += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Dashboard-Role-List" -> DashboardRoleList/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Dashboard-Role-List'], adminAuth, asyncHandler(async (req, res) => {
  let btnexel = B.nStr(req.p.btnexel);
  if (btnexel === null) btnexel = '';
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Empid = req.user.emp_id;
  const ViewBag = {};
  Object.assign(ViewBag, await B.perms(Empid, url)); // CheckPermissions (overwritten below, legacy order kept)
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK
  const perm = await pagePermissions(Empid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  const Emp_ID = req.user.emp_id;
  const _DashboardRoleList = mapRows(await db.proc(DB, 'USP_GET_DASHBOARDROLLROLEDETAIL', { EMPID: Emp_ID }), DRL_PROPS);
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/DashboardRoleList/Index.cshtml', Model: _DashboardRoleList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport()
// auth (public method => routable; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult UpdateRole(string Dbrid)
// auth-by-check (legacy returned Json("Session Expired. Please login again") without a session - contract kept)
router.all(`/admin/${C}/UpdateRole{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  if (!isAdmin(req)) return res.json('Session Expired. Please login again');
  try {
    const Dbrids = B.cvtInt(await UtilityClass.Decryptword(B.nStr(req.p.Dbrid)));
    const Empid = req.user.emp_id;
    const row = await db.procOne(DB, 'SpCreateEditRole_Dashboard', {
      Emp_Id: Empid, roleName: '', roleDesc: '', CollectionOfId: '', mode: 3, Dbrid: Dbrids, statuss: '0',
    });
    const stringret = B.outStr(row, 'strresult');
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'spCreateEditRole');
    return res.json('Error occurred. Please try later');
  }
}));

// ---------------------------------------------------------------- JsonResult UpdateStatus(string strrid)
// auth-by-check (legacy returned Json("Session Expired. Please login again") without a session - contract kept)
router.all(`/admin/${C}/UpdateStatus{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  if (!isAdmin(req)) return res.json('Session Expired. Please login again');
  try {
    const rid = B.cvtInt(await UtilityClass.Decryptword(B.nStr(req.p.strrid)));
    const empcode = req.user.emp_code; void empcode;
    const Empid = req.user.emp_id; void Empid;
    void rid;
    // PORT-NOTE: legacy command text "SpCreateEditRole_Dashboard @Emp_Id,@rid,@roleName,@roleDesc,@CollectionOfId,@mode,@chageStates,@strResult out"
    // is POSITIONAL against (@Emp_Id,@roleName,@roleDesc,@CollectionOfId,@mode,@strResult OUT,@Dbrid,@statuss): the 8th argument
    // "@strResult out" lands on @statuss, which is not an OUTPUT parameter => SQL Server error 8162 on every call, so the action always
    // answered "Error occurred. Please try later". Reproduced without calling the proc.
    throw new Error('The formal parameter "@statuss" was not declared as an OUTPUT parameter, but the actual parameter passed in requested output.');
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'spCreateEditRole');
    return res.json('Error occurred. Please try later');
  }
}));

module.exports = router;
