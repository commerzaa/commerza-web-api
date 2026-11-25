'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Credit_Coin_History.cs (class Credit_Coin_HistoryController => /admin/Credit_Coin_History/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const { pagePermissions, excelLink } = require('./_shared/loginLogCommon');
const B = require('./_shared/batch05_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Credit_Coin_History';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests. (`private string regno` is unused.)
let url = '';
let url1 = '';

/** class CrHistory */
const CR_PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'Dr_amount', 'Cr_amount', 'CrDrType', 'PROCESSDATE', 'TOUSERNAME', 'Remarks'];

const trimOrThrow = (v) => { if (v === null || v === undefined) throw B.nullRef(); return String(v).trim(); };

/** public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, string type, string orderbydate) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, type, orderbydate) {
  const userid = req.user.emp_id;
  const Filename = 'Credit_Coin_History_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); void MaxRows;
  const AllTransferList = mapRows(await db.proc(DB, 'USP_CREDIT_COIN_HISTORY', {
    StartRowIndex: 1, MaxRows: 999999999, SearchField: trimOrThrow(SearchField), SearchValue: trimOrThrow(SearchValue),
    fromDate: trimOrThrow(fromDate), ToDate: trimOrThrow(toDate), orderbydate, type,
  }), CR_PROPS);
  if (AllTransferList.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Credit_Coin_History.xls', Filename,
      headers: ['S.No.', 'Process Date', 'Username', 'MemberName', 'CRDR Type', 'Credit Amt', 'Created By'],
      rows: AllTransferList, innerProc: 'Credit_Coin_History', outerProc: 'Usp_TransferFundToUser',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.cellStr(item, 'PROCESSDATE')) + ' \t');
        w(B.tab(B.cellStr(item, 'USERNAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'NAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'CrDrType')) + ' \t');
        w(B.tab(B.dec2(item.Dr_amount)) + ' \t');
        w(B.tab(B.cellStr(item, 'TOUSERNAME')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField, string btnexel, string SearchValue, string fromDate, string toDate, int? page, string type)
// auth (Session["Admin_User"] == null => RedirectToAction("adminlogin","Index"))
// route-config: "AdminPanel/credit-coin-history" -> Credit_Coin_History/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/credit-coin-history'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let SearchField = B.nStr(req.p.SearchField);
  let btnexel = B.nStr(req.p.btnexel);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let page = B.nInt(req.p.page);
  let type = B.nStr(req.p.type);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (SearchField === null) SearchField = '';
  if (btnexel === null) btnexel = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (toDate === null) toDate = '';
  if (type === null) type = '';
  const Empid = req.user.emp_id;
  const ViewBag = {};
  Object.assign(ViewBag, await B.perms(Empid, url)); // CheckPermissions (overwritten below, legacy order kept)
  ViewBag.excelactive = await excelLink(url);
  const perm = await pagePermissions(Empid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_CREDIT_COIN_HISTORY', {
    StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(), fromDate: fromDate.trim(), ToDate: toDate.trim(),
    orderbydate, type,
  });
  const AllTransferList = mapRows(rows, CR_PROPS);
  // PORT-NOTE: OUT params @TOTALCOUNT / @TOTALDEBITAMT read from the first result row; no row => 0.
  const TotalRecord = rows.length ? Number(B.col(rows[0], 'totalcount') || 0) : 0;
  const TotalDebiAmt = rows.length ? B.decOutToInt(rows[0], 'totaldebitamt') : 0;
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
    const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, type, orderbydate);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Credit_Coin_History/Index.cshtml', Model: AllTransferList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, string type, string orderbydate)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const s = (k) => B.nStr(req.p[k]);
  const r = await ExportReport(req, res, {}, s('SearchField'), s('SearchValue'), s('fromDate'), s('toDate'), s('type'), s('orderbydate'));
  if (!r.sent) res.send('');
}));

module.exports = router;
