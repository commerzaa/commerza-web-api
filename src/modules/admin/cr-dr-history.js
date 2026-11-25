'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Cr_Dr_History.cs (class Cr_Dr_HistoryController => /admin/Cr_Dr_History/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const { pagePermissions, excelLink } = require('./_shared/login-log-common');
const B = require('./_shared/batch05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Cr_Dr_History';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** class DrHistory */
const DR_PROPS = ['ROWNUMBER', 'USERNAME', 'TOUSERNAME', 'NAME', 'Dr_amount', 'Cr_amount', 'CrDrType', 'PROCESSDATE'];

const trimOrThrow = (v) => { if (v === null || v === undefined) throw B.nullRef(); return String(v).trim(); };

/** public void ExportReport(string fromDate, string toDate, string SearchField, string SearchValue) */
async function ExportReport(req, res, ViewBag, fromDate, toDate, SearchField, SearchValue) {
  const userid = req.user.emp_id;
  const Filename = 'Debit_Coin_History_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); void MaxRows;
  // USP_CR_DR_HISTORY without @orderbydate (legacy passed 6 inputs + 3 OUT here)
  const AllTransferList = mapRows(await db.proc(DB, 'USP_CR_DR_HISTORY', {
    StartRowIndex: 1, MaxRows: 999999, SearchField: trimOrThrow(SearchField), SearchValue: trimOrThrow(SearchValue),
    fromDate: trimOrThrow(fromDate), ToDate: trimOrThrow(toDate),
  }), DR_PROPS);
  if (AllTransferList.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Debit_Coin_History.xls', Filename,
      headers: ['S.No.', 'Username', 'Debited By', 'MemberName', 'Debit Amt', 'CRDR Type', 'Process Date'],
      rows: AllTransferList, innerProc: 'Debit_Coin_History', outerProc: 'Usp_TransferFundToUser',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.cellStr(item, 'USERNAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'TOUSERNAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'NAME')) + ' \t');
        w(B.tab(B.dec2(item.Dr_amount)) + ' \t');
        w(B.tab(B.cellStr(item, 'CrDrType')) + ' \t'); // Regex.Replace(null) => ArgumentNullException
        w(B.tab(B.cellStr(item, 'PROCESSDATE')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField, string btnexel, string SearchValue, string fromDate, string toDate, int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("adminlogin","Index"))
// route-config: "AdminPanel/credit-debit-history" -> Cr_Dr_History/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/credit-debit-history'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let SearchField = B.nStr(req.p.SearchField);
  let btnexel = B.nStr(req.p.btnexel);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let page = B.nInt(req.p.page);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (btnexel === null) btnexel = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (toDate === null) toDate = '';
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  ViewBag.excelactive = await excelLink(url);
  const perm = await pagePermissions(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_CR_DR_HISTORY', {
    StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(), fromDate: fromDate.trim(), ToDate: toDate.trim(),
    orderbydate,
  });
  const AllTransferList = mapRows(rows, DR_PROPS);
  // PORT-NOTE: OUT params @TOTALCOUNT / @TOTALDEBITAMT read from the first result row ("totalcount" / "totaldebitamt"); no row => 0.
  // Convert.ToInt32(decimal-out.ToString()): the scale-0 decimal OUT param was an integer string; DBNull => FormatException (kept).
  const TotalRecord = rows.length ? Number(B.col(rows[0], 'totalcount') || 0) : 0;
  let TotalDebiAmt = 0;
  if (rows.length) {
    const v = B.col(rows[0], 'totaldebitamt');
    if (v === null || v === undefined || v === '') throw new Error('Input string was not in a correct format.');
    TotalDebiAmt = Math.round(Number(v));
  }
  ViewBag.TotalDebiAmt = TotalDebiAmt;
  ViewBag.CurrentPage = page; ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  if (btnexel === 'Export Excel') {
    // PORT-NOTE: legacy called ExportReport(SearchField, SearchValue, fromDate, toDate) against the signature
    // (fromDate, toDate, SearchField, SearchValue) - the arguments are swapped; kept.
    const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Cr_Dr_History/Index.cshtml', Model: AllTransferList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.fromDate), B.nStr(req.p.toDate), B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue));
  if (!r.sent) res.send('');
}));

module.exports = router;
