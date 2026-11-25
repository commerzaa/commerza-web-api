'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Approved_FranchiseController.cs (class Approved_FranchiseController => /Approved_Franchise/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, issueAdminToken } = require('./_shared/adminSession');
const { DB, col, str, sv, nint, toInt32, toStr, nullRef, tab, nowStamp, excelLink, pagePermissions, tsvExport } = require('./_shared/batch03_common');

const router = express.Router();
const C = 'Approved_Franchise';

/** class ApprovedFranchise */
const PROPS = ['RowNumber', 'FIMID', 'USERNAME', 'Package', 'MOBILE', 'Used_FrunchiseFund', 'Available_FrunchiseFund', 'Taluk', 'District',
  'Circle', 'Region', 'ApplyFor', 'FRCODE', 'FRID', 'Date'];
/** class ViewUserDetails */
const VIEW_USER_DETAILS_PROPS = ['NAME', 'PACKAGENAME', 'COUNTRY', 'STATE', 'CITY', 'ADDRESS', 'JOINDATE', 'PINCODE', 'Taluk', 'District',
  'Circle', 'Region', 'ApprovalDate', 'FRCode', 'Emailid', 'Mobile', 'StoreType', 'GST', 'TinNo', 'PASSWORD', 'USERNAME', 'SystemAgreement',
  'MemberAgreement'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (kept as module state).
let url = '';
let url1 = '';

/** public void ExportReport(string UserName, string Package, string Mobile, int? page, int? ddlcustpage, string FRCode) */
async function ExportReport(req, res, ViewBag, UserName, Package, Mobile, page, ddlcustpage, FRCode) {
  const userid = req.user.emp_id;
  const Filename = `Approved_Franchise_${userid}_${nowStamp()}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
  // eslint-disable-next-line no-unused-vars
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  if (UserName === null || Mobile === null || Package === null) nullRef();
  // dbo.USP_Approved_Frnachaise (7 params here: no @orderbydate; @MAXROWS = ddlcustpage; @FRCode untrimmed)
  const AllEPinRequestsList = mapRows(await db.proc(DB, 'USP_Approved_Frnachaise', {
    STARTROWINDEX: page, MAXROWS: ddlcustpage, FRCode, UserName: UserName.trim(), Mobile: Mobile.trim(), Package: Package.trim(),
  }), PROPS);
  if (AllEPinRequestsList.length > 0) {
    return tsvExport({
      req, res, ViewBag, sheet: 'Approved_Franchise.xls', attachName: 'All_Member_List.xls', filename: Filename, rows: AllEPinRequestsList,
      innerProc: 'AllEPinRequestsList', outerProc: 'AllEPinRequestsList',
      headers: ['S.No. \t', 'FR-Code \t', 'Applied For \t', 'Mobile No. \t', 'Taluk \t', 'District \t'],
      cells: (item, w) => {
        w(tab(toStr(item.RowNumber)) + ' \t');
        w(tab(toStr(item.USERNAME)) + ' \t');
        if (item.Package === null || item.Package === undefined) nullRef();
        w(tab(Number(item.Package).toFixed(2)) + ' \t'); // ToString("0.00")
        w(tab(toStr(item.MOBILE)) + ' \t');
        w(tab(toStr(item.Taluk)) + ' \t');
        w(tab(toStr(item.District)) + ' \t');
      },
    });
  }
  return false;
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string UserName, string Package, string Mobile, int? page, int? ddlcustpage, string btnexel, string FRCode)
// auth
// route-config: "AdminPanel/Approved-Franchise" -> Approved_Franchise/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Approved-Franchise'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = sv(req.p.orderbydate);
  let UserName = sv(req.p.UserName);
  let Package = sv(req.p.Package);
  let Mobile = sv(req.p.Mobile);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  let btnexel = sv(req.p.btnexel);
  let FRCode = sv(req.p.FRCode);
  const ViewBag = {};
  const out = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (UserName === null) UserName = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (Mobile === null) Mobile = '';
  if (FRCode === null) FRCode = '';
  if (Package === null) Package = '';
  if (page === null) page = 1;
  if (btnexel === null) btnexel = '';
  const MaxRows = Number(dynamicpagging);
  const Empid = req.user.emp_id;
  sessionStore.set(req, 'Admin_User_Menu', await UtilityClass.UpdateAdminMenu(Empid));
  const emp = await new UtilityClass().UpdateAdminUserSession(Empid);
  if (emp) out.token = issueAdminToken(emp);
  ViewBag.excelactive = await excelLink(url);
  // Employee_Master EM = Session["Admin_User"] (the refreshed one) => EM.Emp_ID (NullReference if the refresh returned null)
  const Employeeid = emp ? (emp.Emp_ID !== undefined ? emp.Emp_ID : emp.emp_id) : nullRef();
  const perm = await pagePermissions(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  const rows = await db.proc(DB, 'USP_Approved_Frnachaise', {
    STARTROWINDEX: page, MAXROWS: MaxRows, FRCode: FRCode.trim(), UserName: UserName.trim(), Mobile: Mobile.trim(), Package: Package.trim(), orderbydate,
  });
  const AllEPinRequestsList = mapRows(rows, PROPS);
  const tc = str(col(rows[0], 'totalcount'));
  const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
  ViewBag.CurrentPage = page;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.UserName = UserName;
  ViewBag.package = Package;
  ViewBag.mobile = Mobile;
  ViewBag.FRCode = FRCode;
  ViewBag.GridPageSize = ddlcustpage;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  if (btnexel === 'Export Excel') {
    if (await ExportReport(req, res, ViewBag, UserName, Package, Mobile, page, ddlcustpage, FRCode)) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Approved_Franchise/Index.cshtml', Model: AllEPinRequestsList, ...ViewBag, ...out });
}));

// ---------------------------------------------------------------- public void ExportReport(string UserName, string Package, string Mobile, int? page, int? ddlcustpage, string FRCode)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, sv(req.p.UserName), sv(req.p.Package), sv(req.p.Mobile), nint(req.p.page),
    nint(req.p.ddlcustpage), sv(req.p.FRCode));
  if (!sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult GetUserDetails(string FRID)
// auth (PORT-NOTE: legacy had NO session check although it returns franchise details incl. PASSWORD - protected here)
router.all(`/admin/${C}/GetUserDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const FRID = toInt32(sv(req.p.FRID)); // Convert.ToInt32(FRID)
  const ObjDetails = mapRows(await db.proc(DB, 'USP_GetUserDetailsByFRID', { FRID }), VIEW_USER_DETAILS_PROPS);
  return res.json(ObjDetails);
}));

module.exports = router;
