'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\OverallEarning_Report.cs (class OverallEarning_ReportController, no namespace
// => /admin/OverallEarning_Report/...). Database: affiliate (Db_Affiliate). Procs USP_EXCEL_LINK, USP_GETEXCELPERMISIONSTATUS,
// USP_Overall_Earning, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  nInt, nDec, nStr, cellStr, tab, dec2, nowStamp, excelHistory, writeXlsExport, errorView, excelLink, inlinePerms,
} = require('./_shared/batch11-common');
const { strictOutInt, tabN } = require('./_shared/batch11-b-common');
const { dynPaging } = require('./_shared/batch06-common');
const { cvtDecOut, OVERALL_EARNING_REPORT_PROPS } = require('./_shared/batch13-01-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'OverallEarning_Report';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** public void ExportReport(string SearchField, string SearchValue, int? page, string OrderBy, decimal? maxamount, decimal? minamount) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, page, OrderBy, maxamount, minamount) {
  const userid = req.user.emp_id;
  const Filename = 'OverallEarning_Report_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  if (maxamount === null) maxamount = 0;
  if (minamount === null) minamount = 0;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  // [USP_Overall_Earning] @STARTROWINDEX,@MAXROWS,@ORDERBYFIELD,@SEARCHFIELD,@SEARCHVALUE,@MODE,@MAXAMOUNT,@MINAMOUNT,@RECORDCOUNT OUT,@TOTALAVAILABLE OUT
  const AllFreeEpinList = mapRows(await db.proc(DB, 'USP_Overall_Earning', {
    STARTROWINDEX: page, MAXROWS: MaxRows, ORDERBYFIELD: OrderBy, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, MODE: 1,
    MAXAMOUNT: maxamount, MINAMOUNT: minamount,
  }), OVERALL_EARNING_REPORT_PROPS);
  if (AllFreeEpinList.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'OverallEarning_Report.xls', Filename, rows: AllFreeEpinList,
      rawHeaders: 'S.No. \tUsername \tBinary \tBinary Level \tROI \t ROI Level\tDirect \tRollup \tLevel \tWithdrawal \tBalance \t',
      innerProc: 'OverallEarning_Report', outerProc: 'USP_Overall_Earning',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(cellStr(item, 'PAIRINCOME')) + ' \t');
        w(tab(cellStr(item, 'BinaryLevelIncome')) + ' \t');
        w(tab(cellStr(item, 'ROI')) + ' \t');
        w(tab(cellStr(item, 'ROI_GROWTHLEVEL')) + ' \t');
        w(tab(cellStr(item, 'DIRECTINCOME')) + ' \t');
        w(tab(dec2(item.RollupIncome)) + ' \t');
        w(tabN(cellStr(item, 'LEVELINCOME'), 3) + ' \t'); // legacy replaced "\t" with 3 spaces here
        w(tab(cellStr(item, 'WITHDRAWALAMOUNT')) + ' \t');
        w(tab(cellStr(item, 'AvailableCommissionWallet')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string SearchField, string SearchValue, int? page,
//   string OrderBy, decimal? maxamount, decimal? minamount, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/OverallEarning-Report" -> OverallEarning_Report/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/OverallEarning-Report'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let page = nInt(req.p.page);
  let OrderBy = nStr(req.p.OrderBy);
  let maxamount = nDec(req.p.maxamount);
  let minamount = nDec(req.p.minamount);
  let btnexel = nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (maxamount === null) maxamount = 0;
  if (minamount === null) minamount = 0;
  if (dynamicpagging === null) dynamicpagging = dynPaging();
  const ViewBag = {};
  ViewBag.excelactive = await excelLink(url);
  if (btnexel === null) btnexel = '';
  const Employeeid = req.user.emp_id;
  const p = await inlinePerms(Employeeid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  try {
    const MaxRows = Number(dynamicpagging);
    if (SearchField === null || SearchValue === null) { SearchField = ''; SearchValue = ''; }
    if (OrderBy === null) OrderBy = '';
    if (page === null) page = 1;
    // [USP_Overall_Earning] ... @RECORDCOUNT OUT,@TOTALAVAILABLE OUT,@TOTALBINARY OUT,@TOTALBINARYLEVEL OUT,@TOTALROI OUT,@TOTALROILEVEL OUT,
    //   @TOTALDIRECT OUT,@TOTALROLLUP OUT,@TOTALLEVEL OUT,@TOTALWITHDRAWAL OUT  (OUT values returned as columns)
    const rows = await db.proc(DB, 'USP_Overall_Earning', {
      STARTROWINDEX: page, MAXROWS: MaxRows, ORDERBYFIELD: OrderBy, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), MODE: 1,
      MAXAMOUNT: maxamount, MINAMOUNT: minamount,
    });
    const AllFreeEpinList = mapRows(rows, OVERALL_EARNING_REPORT_PROPS);
    const TotalRecord = strictOutInt(rows, 'RECORDCOUNT');
    const TOTALAVAILABLES = cvtDecOut(rows, 'TOTALAVAILABLE');
    const TOTALBINARYS = cvtDecOut(rows, 'TOTALBINARY');
    const TOTALBINARYLEVELS = cvtDecOut(rows, 'TOTALBINARYLEVEL');
    const TOTALROIS = cvtDecOut(rows, 'TOTALROI');
    const TOTALROILEVELS = cvtDecOut(rows, 'TOTALROILEVEL');
    const TOTALDIRECTS = cvtDecOut(rows, 'TOTALDIRECT');
    const TOTALROLLUPS = cvtDecOut(rows, 'TOTALROLLUP');
    const TOTALLEVELS = cvtDecOut(rows, 'TOTALLEVEL');
    const TOTALWITHDRAWALS = cvtDecOut(rows, 'TOTALWITHDRAWAL');
    ViewBag.TOTALAVAILABLES = TOTALAVAILABLES; ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.TOTALBINARYS = TOTALBINARYS;
    ViewBag.TOTALBINARYLEVELS = TOTALBINARYLEVELS;
    ViewBag.TOTALROIS = TOTALROIS;
    ViewBag.TOTALROILEVELS = TOTALROILEVELS;
    ViewBag.TOTALDIRECTS = TOTALDIRECTS;
    ViewBag.TOTALROLLUPS = TOTALROLLUPS;
    ViewBag.TOTALLEVELS = TOTALLEVELS;
    ViewBag.TOTALWITHDRAWALS = TOTALWITHDRAWALS;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.OrderBy = OrderBy;
    ViewBag.maxamount = maxamount;
    ViewBag.minamount = minamount;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, page, OrderBy, maxamount, minamount);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/OverallEarning_Report/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_Overall_Earning');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, int? page, string OrderBy,
//   decimal? maxamount, decimal? minamount)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nStr(req.p.SearchField), nStr(req.p.SearchValue), nInt(req.p.page), nStr(req.p.OrderBy),
    nDec(req.p.maxamount), nDec(req.p.minamount));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
