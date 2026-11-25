'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ChangeUserName_History.cs (class ChangeUserName_HistoryController)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const B = require('./_shared/batch04B_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'ChangeUserName_History';

/** class ChangeUserName_History */
const PROPS = ['ROWNUMBER', 'OLDUsername', 'NewUserName', 'NAME', 'MOBILE', 'EMAILID', 'Status', 'Date'];

// PORT-NOTE: `private static string url, url1` (shared by all requests) kept as module variables.
let url = '';
let url1 = '';

/** DBO.USP_Change_UserName_History @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT OUT,@REGNO */
async function loadHistory(page, MaxRows, SearchField, SearchValue, fromDate, toDate, regno) {
  if (SearchField === null || SearchValue === null || fromDate === null || toDate === null) throw B.NRE(); // .Trim() on null
  const rows = await db.proc(DB, 'USP_Change_UserName_History', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
    FROMDATE: fromDate.trim(), TODATE: toDate.trim(), REGNO: regno,
  });
  const TotalRecord = B.toInt32(B.str(B.outVal(rows, 'TOTALCOUNT'))); // int.Parse(spOutput.Value.ToString())
  return { list: mapRows(rows, PROPS), TotalRecord };
}

/** public void ExportReport(Int32? page, Int32? dynamicpagging, string SearchField, string SearchValue, string fromDate, string toDate, string regno) */
async function ExportReport(req, res, page, dynamicpagging, SearchField, SearchValue, fromDate, toDate, regno) {
  const ViewBag = {};
  const MaxRows = dynamicpagging === null ? 0 : dynamicpagging; // Convert.ToInt32(null) => 0
  if (page === null) page = 1;
  const r = await loadHistory(page, MaxRows, SearchField, SearchValue, fromDate, toDate, regno);
  // (ViewBag values set by the legacy ExportReport are discarded: the void action rendered no view)
  await UtilityClass.GridNumbersPerPage();
  const sent = await B.exportXls({
    req, res, rows: r.list, sheet: 'ChangeUserName_History', procName: 'USP_Change_UserName_History', ViewBag,
    headers: ['S.No. \t', 'Old Username \t', 'New Username \t', 'Name \t', 'Mobile \t', 'EmailID \t', 'Date \t', 'Status \t'],
    row: (item, w) => {
      w(B.tab(B.ts(item.ROWNUMBER)) + ' \t');
      w(B.tab(B.ts(item.OLDUsername)) + ' \t');
      w(B.tab(B.ts(item.NewUserName)) + ' \t');
      w(B.tab(B.ts(item.NAME)) + ' \t');
      w(B.tab(B.ts(item.MOBILE)) + ' \t');
      w(B.tab(B.ts(item.EMAILID)) + ' \t');
      w(B.tab(B.netDefault(item.Date)) + ' \t');
      if (item.Status === '1' || item.Status === 1) w('Active \t'); else w('InActive \t');
    },
  });
  return { sent, ViewBag };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(Int32? page, Int32? dynamicpagging, string SearchField, string SearchValue, string fromDate, string toDate, string btnexel, string regno)
// auth ([SessionExpireCheck] + Session["Admin_User"] check)
// route-config: "AdminPanel/Change-UserName-History" -> ChangeUserName_History/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Change-UserName-History'], adminAuth, asyncHandler(async (req, res) => {
  let page = B.ip(req, 'page');
  let dynamicpagging = B.ip(req, 'dynamicpagging');
  let SearchField = B.sp(req, 'SearchField');
  let SearchValue = B.sp(req, 'SearchValue');
  let fromDate = B.sp(req, 'fromDate');
  let toDate = B.sp(req, 'toDate');
  let btnexel = B.sp(req, 'btnexel');
  let regno = B.sp(req, 'regno');
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (btnexel === null) btnexel = '';
  if (regno === null) regno = '';
  else regno = B.qs(req, 'Regno'); // legacy re-read from the query string (null when it came from the form)

  const ViewBag = {};
  const perm = await B.pagePerm(req, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = await B.excelActive(url);

  const MaxRows = dynamicpagging;
  if (page === null) page = 1;
  const r = await loadHistory(page, MaxRows, SearchField, SearchValue, fromDate, toDate, regno);
  ViewBag.CurrentPage = page;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.TotalRecord = r.TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  if (btnexel === 'Export Excel') {
    const e = await ExportReport(req, res, page, dynamicpagging, SearchField, SearchValue, fromDate, toDate, regno);
    if (e.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/ChangeUserName_History/Index.cshtml', Model: r.list, ...ViewBag });
}));

// ---------------------------------------------------------------- [SessionExpireCheck] public void ExportReport(...)
// auth ([SessionExpireCheck])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const e = await ExportReport(req, res, B.ip(req, 'page'), B.ip(req, 'dynamicpagging'), B.sp(req, 'SearchField'), B.sp(req, 'SearchValue'),
    B.sp(req, 'fromDate'), B.sp(req, 'toDate'), B.sp(req, 'regno'));
  if (!e.sent) res.send(''); // void action => empty response
}));

module.exports = router;
