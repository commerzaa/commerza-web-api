'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Level_Business_Report.cs (class Level_Business_ReportController, no namespace => /Level_Business_Report/...)
// Database: affiliate (Db_Affiliate). Procs: USP_EXCEL_LINK, USP_GETEXCELPERMISIONSTATUS (via CheckPermissions), USP_MEMBER_BUSINESSREPORT,
// USP_EXCEL_DOWNLOAD_HISTORY, USP_GET_MEMBERBUSINESS.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nDec, nStr, cellStr, tab, nowStamp, cvtInt, dec2, excelHistory, writeXlsExport, errorView,
} = require('./_shared/batch08-common');
const { outVal, pagePerm, excelLinkRaw, MEMBER_BUSINESS_PROPS } = require('./_shared/batch08-d2-common');

const router = express.Router();
const C = 'Level_Business_Report';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

const strictInt = (s) => cvtInt(s === '' ? 'x' : s); // Convert.ToInt32(DBNull.ToString()) => FormatException

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string FROMDATE, string TODATE, int? page)
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, FROMDATE, TODATE, page) {
  const userid = req.user.emp_id; // ((Employee_Master)Session["Admin_User"]).Emp_ID
  const Filename = 'MyDownline_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_MEMBER_BUSINESSREPORT', {
    STARTROWINDEX: page, MAXROWS: 999999, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE, TODATE,
  });
  const MemberBusinessReport = mapRows(rows, MEMBER_BUSINESS_PROPS);
  if (MemberBusinessReport.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Level_Business_Report.xls', Filename,
      headers: ['S.No.', 'Username', 'Mobile', 'Self Business', 'Left Business', 'Right Business', 'Total Downline Business'],
      rows: MemberBusinessReport,
      innerProc: 'MyDownline',
      outerProc: 'USP_DIRECT_TREE_LIST',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(cellStr(item, 'MOBILENUMBER')) + ' \t');
        w(tab(dec2(item.PBV)) + ' \t');
        w(tab(dec2(item.LEFTBUSINESS)) + ' \t');
        w(tab(dec2(item.RIGHTBUSINESS)) + ' \t');
        w(tab(dec2(item.TOTALBUSINES)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, int? page, string OrderBy, string FROMDATE, string TODATE, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Level-Business-Report" -> Level_Business_Report/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Level-Business-Report'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let page = nInt(req.p.page);
  let OrderBy = nStr(req.p.OrderBy);
  let FROMDATE = nStr(req.p.FROMDATE);
  let TODATE = nStr(req.p.TODATE);
  let btnexel = nStr(req.p.btnexel);
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
  await excelLinkRaw(url);
  ViewBag.excelactive = 0;
  const Employeeid = req.user.emp_id;
  const perm = await pagePerm(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  // (an unused @ISACTIVE SqlParameter is built in an empty using-block: no DB call)
  try {
    const MaxRows = Number(dynamicpagging);
    if (OrderBy === null) OrderBy = '';
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_MEMBER_BUSINESSREPORT', {
      STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE, TODATE,
    });
    const MemberBusinessReport = mapRows(rows, MEMBER_BUSINESS_PROPS);
    const TotalRecord = strictInt(outVal(rows, 'TOTALCOUNT'));
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
      const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, FROMDATE, TODATE, page);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Level_Business_Report/Index.cshtml', Model: MemberBusinessReport, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_GET_MEMBERBUSINESS');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.FROMDATE), nStr(req.p.TODATE), nInt(req.p.page));
  if (!r.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult GetAllDownLineMeberByUserName(string UserName, int? page)
// auth (PORT-NOTE: legacy had NO session check on this admin member-business lookup - protected here)
router.all(`/admin/${C}/GetAllDownLineMeberByUserName{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const UserName = nStr(req.p.UserName);
  let page = nInt(req.p.page);
  const SearchField = 'ALLDOWNLINEBYUSERNAME';
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_GET_MEMBERBUSINESS', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: '', FROMDATE: '', TODATE: '', USERNAME: UserName,
    TLBV: '0', TRBV: '0',
  });
  const MemberBusinessReport = mapRows(rows, MEMBER_BUSINESS_PROPS);
  const rc = outVal(rows, 'TOTALCOUNT');
  cvtInt(rc === '' ? '0' : rc); // TotalRecord (ViewBag only, not part of the JsonResult)
  return res.json(MemberBusinessReport);
}));

// ---------------------------------------------------------------- JsonResult GetAllLeftSideMemberOrRightSide(decimal? Tlbv, decimal? Trbv, int? page, string UserName)
// auth (PORT-NOTE: legacy had NO session check - protected here)
router.all(`/admin/${C}/GetAllLeftSideMemberOrRightSide{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let Tlbv = nDec(req.p.Tlbv);
  let Trbv = nDec(req.p.Trbv);
  let page = nInt(req.p.page);
  const UserName = nStr(req.p.UserName);
  if (Tlbv === null) Tlbv = 0;
  if (Trbv === null) Trbv = 0;
  const SearchField = '';
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_GET_MEMBERBUSINESS', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: '', FROMDATE: '', TODATE: '', USERNAME: UserName,
    TLBV: Tlbv, TRBV: Trbv,
  });
  const MemberBusinessReport = mapRows(rows, MEMBER_BUSINESS_PROPS);
  strictInt(outVal(rows, 'TOTALCOUNT')); // Convert.ToInt32(RECORDCOUNT.Value.ToString()) (DBNull => FormatException, uncaught => 500)
  return res.json(MemberBusinessReport);
}));

module.exports = router;
