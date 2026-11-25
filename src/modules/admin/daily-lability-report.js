'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\DailyLabilityReport.cs (class DailyLabilityReportController => /admin/DailyLabilityReport/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'DailyLabilityReport';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** class DailyLabilityReport */
const DLR_PROPS = ['ROWNUMBER', 'Lability', 'Investment', 'Profit', 'Date', 'COLOR', 'Credit', 'Debit', 'Balance'];

const trimOrThrow = (v) => { if (v === null || v === undefined) throw B.nullRef(); return String(v).trim(); };

/** public void ExportReport(string fromdate, string todate, string SearchField, string SearchValue) */
async function ExportReport(req, res, ViewBag, fromdate, todate, SearchField, SearchValue) {
  const userid = req.user.emp_id;
  const Filename = 'dailyLabilityReport_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  // [USP_MemberDailyLability] without @orderbydate (CommandTimeout 1000 s => pg pool timeout)
  const AllFreeEpinList = mapRows(await db.proc(DB, 'USP_MemberDailyLability', {
    STARTROWINDEX: 1, MAXROWS: 999999, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: trimOrThrow(SearchField), SEARCHVALUE: trimOrThrow(SearchValue),
  }), DLR_PROPS);
  if (AllFreeEpinList.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'dailyLabilityReport.xls', Filename,
      headers: ['S.No.', 'DATE', 'Total Investment', 'Total Lability', 'Profit'],
      rows: AllFreeEpinList, innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.cellStr(item, 'Date')) + ' \t');
        w(B.tab(B.dec2(item.Investment)) + ' \t');
        w(B.tab(B.dec2(item.Lability)) + ' \t');
        w(B.tab(B.dec2(item.Profit)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField, string btnexel, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/DailyLabilityReport" -> DailyLabilityReport/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/DailyLabilityReport'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let SearchField = B.nStr(req.p.SearchField);
  let btnexel = B.nStr(req.p.btnexel);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromdate = B.nStr(req.p.fromdate);
  let todate = B.nStr(req.p.todate);
  let page = B.nInt(req.p.page);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Empid = req.user.emp_id;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (btnexel === null) btnexel = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  const ViewBag = {};
  Object.assign(ViewBag, await B.perms(Empid, url));
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_MemberDailyLability', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
      orderbydate,
    });
    const AllFreeEpinList = mapRows(rows, DLR_PROPS);
    // PORT-NOTE: @TOTALCOUNT OUT read from the first result row ("" => 0).
    const tc = B.str(B.col(rows[0] || null, 'totalcount'));
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, fromdate, todate, SearchField, SearchValue);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/DailyLabilityReport/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
  } catch (ex) {
    if (res.headersSent) return undefined;
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' }); // legacy catch had no ErrorInsert
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string fromdate, string todate, string SearchField, string SearchValue)
// auth (public method => routable; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.fromdate), B.nStr(req.p.todate), B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue));
  if (!r.sent) res.send('');
}));

module.exports = router;
