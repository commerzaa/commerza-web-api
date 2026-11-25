'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Monthwise_TDS_Report.cs (class Monthwise_TDS_ReportController => /Monthwise_TDS_Report/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const { DB, nInt, nStr, perms, excelHistory, nowStamp, outIntOf, trimS } = require('./_shared/batch10-common');
const { outDecRaw } = require('./_shared/batch10-c-common');

const router = express.Router();
const C = 'Monthwise_TDS_Report';

/** class Monthwise_TDS_Report */
const PROPS = ['ROWNUMBER', 'REGNO', 'Username', 'Name', 'MOBILE', 'PANNO', 'TDSAMOUNT', 'DATE'];

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

// public void ExportReport(string fromDate, string toDate, string datetype, string SearchField, string SearchValue)
async function ExportReport(req, res, fromDate, toDate, datetype, SearchField, SearchValue) {
  const userid = req.user.emp_id;
  const Filename = 'Monthwise_TDS_Report_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  await UtilityClass.GridPageSize(); // int MaxRows = UtilityClass.GridPageSize(); (unused)
  trimS(SearchField); trimS(SearchValue); // SearchField.Trim() / SearchValue.Trim() (NullReferenceException on null)
  // PORT-NOTE: legacy called "DBO.Usp_Monthwise_TDS_Report @SEARCHFIELD,...,@MAXROWS,@TotalRecord out,@orderbydate" POSITIONALLY, which bound
  // the 9th argument @orderbydate ("" nvarchar) to the proc's 9th parameter @TotalTDS decimal(18,8) => SQL Server raised
  // "Error converting data type nvarchar to numeric." before the proc ran, and the exception (outside any try) became a 500.
  // The export therefore never produced a file; this is reproduced (the dead download code below the call is not ported).
  // (fromDate, toDate, datetype were passed unchanged)
  void fromDate; void toDate; void datetype; void res;
  throw new Error('Error converting data type nvarchar to numeric.');
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue,
//   string datetype, string btnexel, string fromDate, string toDate, int? page)
// auth (reads Session["Admin_User"] without a null check => NullReferenceException without a session)
// route-config: "AdminPanel/monthwise-tds-report" -> Monthwise_TDS_Report/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/monthwise-tds-report'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let btnexel = nStr(req.p.btnexel); if (btnexel === null) btnexel = '';
  let fromDate = nStr(req.p.fromDate); if (fromDate === null) fromDate = '';
  let toDate = nStr(req.p.toDate); if (toDate === null) toDate = '';
  let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
  let orderbydate = nStr(req.p.orderbydate); if (orderbydate === null) orderbydate = '';
  let datetype = nStr(req.p.datetype); if (datetype === null) datetype = '';
  let SearchField = nStr(req.p.SearchField); if (SearchField === null) SearchField = '';
  let SearchValue = nStr(req.p.SearchValue); if (SearchValue === null) SearchValue = '';
  const Empid = req.user.emp_id;
  const ViewBag = {};
  Object.assign(ViewBag, await perms(Empid, url)); // CheckPermissions.GetPageActionPermission + GetExcelPermission
  const MaxRows = dynamicpagging;
  let page = nInt(req.p.page); if (page === null) page = 1;
  // DBO.Usp_Monthwise_TDS_Report @SEARCHFIELD,@SEARCHVALUE,@fromDate,@Todate,@datetype,@STARTROWINDEX,@MAXROWS,@TotalRecord out,@TotalTDS out,@orderbydate
  const rows = await db.proc(DB, 'Usp_Monthwise_TDS_Report', {
    SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), fromDate, Todate: toDate, datetype, STARTROWINDEX: page, MAXROWS: MaxRows,
    orderbydate,
  });
  const list = mapRows(rows, PROPS);
  const TotalRecord = outIntOf(rows, 'totalrecord');
  const tds = outDecRaw(rows, 'totaltds');
  if (tds !== null) ViewBag.TotalTDS = tds;
  Object.assign(ViewBag, {
    GridPageSize: MaxRows, dynamicpagging, orderbydate, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), CurrentPage: page,
    fromDate, toDate,
  });
  if (btnexel === 'Export Excel') {
    await ExportReport(req, res, fromDate, toDate, datetype, SearchField, SearchValue);
  }
  return res.json({ view: '~/Views/AdminPanel/Monthwise_TDS_Report/Index.cshtml', Model: list, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, string datetype, string SearchField, string SearchValue)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await ExportReport(req, res, nStr(req.p.fromDate), nStr(req.p.toDate), nStr(req.p.datetype), nStr(req.p.SearchField), nStr(req.p.SearchValue));
  res.send('');
}));

// ---------------------------------------------------------------- JsonResult tdsDetails(string username, string date)
// auth (legacy had no session check; admin-only data => adminAuth)
router.all(`/admin/${C}/tdsDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let username = nStr(req.p.username); if (username === null) username = '';
  let date = nStr(req.p.date); if (date === null) date = '';
  // Usp_Monthwise_TDS_UserDetail @Username,@Date (ExecuteSqlCommand, result ignored)
  await db.proc(DB, 'Usp_Monthwise_TDS_UserDetail', { Username: username, Date: date });
  return res.json('success');
}));

module.exports = router;
