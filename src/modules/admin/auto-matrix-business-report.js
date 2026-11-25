'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Auto_Matrix_Business_Report.cs (class Auto_Matrix_Business_ReportController => /Auto_Matrix_Business_Report/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const { DB, col, str, sv, nint, ndec, toInt32, toStr, nullRef, tab, nowStamp, pagePermissions, tsvExport } = require('./_shared/batch03-common');

const router = express.Router();
const C = 'Auto_Matrix_Business_Report';

/** class MemberBusinessReport (Controllers/AdminPanel/Member_Business_Report.cs) */
const PROPS = ['ROWNUMBER', 'LEFTBUSINESS', 'RIGHTBUSINESS', 'USERNAME', 'Name', 'MOBILENUMBER', 'MOBILE', 'TOTALBUSINES', 'PBV'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (kept as module state).
let url = '';
let url1 = '';

const fix2 = (v) => { if (v === null || v === undefined) nullRef(); return Number(v).toFixed(2); }; // decimal.ToString("0.00")

/** public void ExportReport(string SearchField, string SearchValue, string FROMDATE, string TODATE, int? page) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, FROMDATE, TODATE, page) {
  const userid = req.user.emp_id;
  const Filename = `MyDownline_${userid}_${nowStamp()}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
  if (page === null) page = 1;
  const MemberBusinessReport = mapRows(await db.proc(DB, 'USP_MEMBER_BUSINESSREPORT', {
    STARTROWINDEX: page, MAXROWS: 999999, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE, TODATE,
  }), PROPS);
  if (MemberBusinessReport.length > 0) {
    return tsvExport({
      req, res, ViewBag, sheet: 'Auto_Matrix_Business_Report.xls', filename: Filename, rows: MemberBusinessReport, innerProc: 'MyDownline',
      outerProc: 'USP_DIRECT_TREE_LIST',
      headers: ['S.No. \t', 'Username \t', 'Mobile \t', 'Self Business \t', 'Left Business \t', 'Right Business \t', 'Total Downline Business \t'],
      cells: (item, w) => {
        w(tab(toStr(item.ROWNUMBER)) + ' \t');
        w(tab(toStr(item.USERNAME)) + ' \t');
        w(tab(toStr(item.MOBILENUMBER)) + ' \t');
        w(tab(fix2(item.PBV)) + ' \t');
        w(tab(fix2(item.LEFTBUSINESS)) + ' \t');
        w(tab(fix2(item.RIGHTBUSINESS)) + ' \t');
        w(tab(fix2(item.TOTALBUSINES)) + ' \t');
      },
    });
  }
  return false;
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, int? page, string OrderBy, string FROMDATE, string TODATE, string btnexel)
// auth
// route-config: "AdminPanel/Auto-Matrix-Business-Report" -> Auto_Matrix_Business_Report/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Auto-Matrix-Business-Report'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = sv(req.p.orderbydate);
  let SearchField = sv(req.p.SearchField);
  let SearchValue = sv(req.p.SearchValue);
  let page = nint(req.p.page);
  let OrderBy = sv(req.p.OrderBy);
  let FROMDATE = sv(req.p.FROMDATE);
  let TODATE = sv(req.p.TODATE);
  let btnexel = sv(req.p.btnexel);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (FROMDATE === null) FROMDATE = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (TODATE === null) TODATE = '';
  if (btnexel === null) btnexel = '';
  // USP_EXCEL_LINK is executed but its output is ignored: ViewBag.excelactive = 0
  await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  ViewBag.excelactive = 0;
  const Employeeid = req.user.emp_id;
  const perm = await pagePermissions(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  try {
    const MaxRows = Number(dynamicpagging);
    if (OrderBy === null) OrderBy = '';
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_MEMBER_BUSINESSREPORT', {
      STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE, TODATE,
    });
    const MemberBusinessReport = mapRows(rows, PROPS);
    const TotalRecord = toInt32(str(col(rows[0], 'totalcount')) || 'x'); // Convert.ToInt32(DBNull.ToString()) => FormatException
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.CurrentPage = page; ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.FROMDATE = FROMDATE;
    ViewBag.TODATE = TODATE;
    ViewBag.OrderBy = OrderBy;
    if (btnexel === 'Export Excel') {
      if (await ExportReport(req, res, ViewBag, SearchField, SearchValue, FROMDATE, TODATE, page)) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Auto_Matrix_Business_Report/Index.cshtml', Model: MemberBusinessReport, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_GET_MEMBERBUSINESS');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string FROMDATE, string TODATE, int? page)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, sv(req.p.SearchField), sv(req.p.SearchValue), sv(req.p.FROMDATE), sv(req.p.TODATE), nint(req.p.page));
  if (!sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult GetAllDownLineMeberByUserName(string UserName, int? page)
// auth (PORT-NOTE: legacy had NO session check on this member business report - protected here)
router.all(`/admin/${C}/GetAllDownLineMeberByUserName{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const UserName = sv(req.p.UserName);
  let page = nint(req.p.page);
  const SearchField = 'ALLDOWNLINEBYUSERNAME';
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_GET_MEMBERBUSINESS', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: '', FROMDATE: '', TODATE: '', USERNAME: UserName, TLBV: '0', TRBV: '0',
  });
  const MemberBusinessReport = mapRows(rows, PROPS);
  const rc = str(col(rows[0], 'totalcount'));
  toInt32(rc === '' ? '0' : rc); // TotalRecord (ViewBag only, not part of the JsonResult)
  return res.json(MemberBusinessReport);
}));

// ---------------------------------------------------------------- JsonResult GetAllLeftSideMemberOrRightSide(decimal? Tlbv, decimal? Trbv, int? page, string UserName)
// auth (PORT-NOTE: legacy had NO session check - protected here)
router.all(`/admin/${C}/GetAllLeftSideMemberOrRightSide{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let Tlbv = ndec(req.p.Tlbv);
  let Trbv = ndec(req.p.Trbv);
  let page = nint(req.p.page);
  const UserName = sv(req.p.UserName);
  if (Tlbv === null) Tlbv = 0;
  if (Trbv === null) Trbv = 0;
  const SearchField = '';
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_GET_MEMBERBUSINESS', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: '', FROMDATE: '', TODATE: '', USERNAME: UserName, TLBV: Tlbv, TRBV: Trbv,
  });
  const MemberBusinessReport = mapRows(rows, PROPS);
  toInt32(str(col(rows[0], 'totalcount')) || 'x'); // Convert.ToInt32(RECORDCOUNT.Value.ToString()) (DBNull => FormatException, uncaught)
  return res.json(MemberBusinessReport);
}));

module.exports = router;
