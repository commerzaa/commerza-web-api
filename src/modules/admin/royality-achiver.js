'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Royality_AchiverController.cs (class Royality_AchiverController, no namespace
// => /admin/Royality_Achiver/...). Database: affiliate (Db_Affiliate). Proc Usp_RoyalityAchiver (@Mode 1).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { nInt, nStr } = require('./_shared/batch06-common');
const { strOutIntOf, writeXlsFile } = require('./_shared/batch13-05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Royality_Achiver';

/** public class RoyalityPayoutReport */
const ROYALITY_PAYOUT_REPORT_PROPS = ['ROWNUMBER', 'Year', 'MonthName', 'GroupName', 'LOGINID', 'NAME', 'MOBILE', 'EmailID', 'Amount', 'TDS',
  'AdminCharge', 'NetPayableAmount', 'GroupNoOfPairs', 'NoOFMemberCurrentPair', 'AchiveDate'];

/** [Usp_RoyalityAchiver] @Mode,@STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@StrResult OUT
 *  PORT-NOTE: the legacy also added @Year = "" and @Month = "" SqlParameters that the command text never referenced, so the proc
 *  used its defaults ('' for both); they are not sent here (same result). */
async function royalityAchiver(page, MaxRows, SearchField, SearchValue, fromDate, toDate) {
  return db.proc(DB, 'Usp_RoyalityAchiver', {
    Mode: '1', STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FROMDATE: fromDate,
    TODATE: toDate,
  });
}

/** public void ExportReport(string SearchField, string SearchValue, int? page, string fromDate, string toDate) */
async function ExportReport(req, SearchField, SearchValue, page, fromDate, toDate, ViewBag) {
  const MaxRows = await UtilityClass.GridPageSize();
  if (SearchField === null || SearchValue === null) {
    SearchField = '';
    SearchValue = '';
  }
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (page === null) page = 1;
  const Obj = mapRows(await royalityAchiver(page, MaxRows, SearchField, SearchValue, fromDate, toDate), ROYALITY_PAYOUT_REPORT_PROPS);
  // Writes ~/Royality_Achiever_Report.xls (headers only: the legacy per-row try block is empty) and never sends it.
  await writeXlsFile({
    req, relPath: 'Royality_Achiever_Report.xls', ViewBag, rows: Obj,
    headers: ['S.No.', 'Date', 'LoginID', 'Name', 'Mobile_No.', 'EmailID', 'Group_Name', 'Current_Pair'],
    innerProc: 'RoyalityPayoutReport', outerProc: 'Usp_RoyalityAchiver',
    cells: () => { /* empty in the legacy code */ },
  });
}

// ---------------------------------------------------------------- ActionResult Index(string SearchField, string SearchValue, int? page, string fromDate, string toDate)
// auth (PORT-NOTE: legacy had no session check; admin report data => adminAuth)
// route-config: "AdminPanel/royality-achiver" -> Royality_Achiver/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/royality-achiver{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let page = nInt(req.p.page);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  const ViewBag = {};
  // (no try/catch in the legacy action: exceptions => 500)
  const MaxRows = await UtilityClass.GridPageSize();
  if (SearchField === null || SearchValue === null) {
    SearchField = '';
    SearchValue = '';
  }
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (page === null) page = 1;
  const rows = await royalityAchiver(page, MaxRows, SearchField, SearchValue, fromDate, toDate);
  const Obj = mapRows(rows, ROYALITY_PAYOUT_REPORT_PROPS);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = strOutIntOf(rows, 'StrResult'); // Convert.ToInt32(spOutput.Value.ToString())
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  await ExportReport(req, SearchField, SearchValue, page, fromDate, toDate, ViewBag);
  return res.json({ view: '~/Views/AdminPanel/Royality_Achiver/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, int? page, string fromDate, string toDate)
// auth (PORT-NOTE: public method => routable in legacy; no session check; admin data => adminAuth)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await ExportReport(req, nStr(req.p.SearchField), nStr(req.p.SearchValue), nInt(req.p.page), nStr(req.p.fromDate), nStr(req.p.toDate), {});
  res.send(''); // void action => empty response
}));

module.exports = router;
