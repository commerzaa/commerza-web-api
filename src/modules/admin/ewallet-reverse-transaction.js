'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\EwalletReverse_TransactionController.cs
// (class EwalletReverse_TransactionController => /admin/EwalletReverse_Transaction/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch07-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'EwalletReverse_Transaction';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** class EwalletReversetransactionlist */
const EWALLET_REV_PROPS = ['Rownumber', 'TMIFTID', 'FROMPLID', 'FROMUSERNAME', 'TOUSERNAME', 'AMOUNT', 'TRANSFER_DATE', 'MOBILE',
  'ReverseTransactionID', 'TransactionID', 'SWRID'];

/** public void ExportReport(string fromDate, string toDate, int? page, string fromusername, string tousername) */
async function ExportReport(req, res, ViewBag, fromDate, toDate, page, fromusername, tousername) {
  const userid = req.user.emp_id;
  const Filename = 'ReverseTransactionHistory_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); // assigned but unused (MAXROWS = "100000000")
  void MaxRows;
  if (page === null) page = 1;
  // USP_REVERSETRANSACTIONLIST_EWallet without @orderbydate (legacy passed 7 parameters here)
  const Obj = mapRows(await db.proc(DB, 'USP_REVERSETRANSACTIONLIST_EWallet', {
    FROMDATE: fromDate, TODATE: toDate, FROMUSERNAME: fromusername, TOUSERNAME: tousername, STARTROWINDEX: page, MAXROWS: '100000000',
  }), EWALLET_REV_PROPS);
  // (no Count > 0 check in this controller: the file is written even when empty)
  return B.writeXlsExport({
    req, res, ViewBag, sheet: 'ReverseTransactionHistory.xls', Filename,
    headers: ['S.No.', 'Date', 'TransactionID', 'FromUsername', 'ToUsername', 'Amount', 'ReverseTransactionID'],
    rows: Obj,
    innerProc: 'Reversetransactionlist',
    outerProc: 'USP_REVERSETRANSACTIONLIST_EWallet',
    cells: (item, w) => {
      w('\n');
      w(B.tab(B.cellStr(item, 'Rownumber')) + ' \t');
      w(B.tab(B.cellStr(item, 'TRANSFER_DATE')) + ' \t');
      w(B.tab(B.cellStr(item, 'TransactionID')) + ' \t');
      w(B.tab(B.cellStr(item, 'FROMUSERNAME').replace(/ /g, '')) + ' \t');
      w(B.tab(B.cellStr(item, 'TOUSERNAME').replace(/ /g, '')) + ' \t');
      w(B.tab(B.dec2(item.AMOUNT)) + ' \t');
      w(B.tab(B.cellStr(item, 'ReverseTransactionID')) + ' \t');
    },
  });
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string fromDate, string toDate, int? page, string fromusername, string tousername, string btnexel)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Ewallet-Reverse-Transaction" -> EwalletReverse_Transaction/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Ewallet-Reverse-Transaction'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let page = B.nInt(req.p.page);
  let fromusername = B.nStr(req.p.fromusername);
  let tousername = B.nStr(req.p.tousername);
  let btnexel = B.nStr(req.p.btnexel);

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  if (btnexel === null) btnexel = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (fromusername === null) fromusername = '';
  if (tousername === null) tousername = '';
  const Empid = req.user.emp_id;
  Object.assign(ViewBag, await B.perms(Empid, url));
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_REVERSETRANSACTIONLIST_EWallet', {
      FROMDATE: fromDate, TODATE: toDate, FROMUSERNAME: fromusername, TOUSERNAME: tousername, STARTROWINDEX: page, MAXROWS: MaxRows, orderbydate,
    });
    const Obj = mapRows(rows, EWALLET_REV_PROPS);
    // PORT-NOTE: @RECORDCOUNT OUT is read from the result row column "recordcount" (0 when the proc returned no row).
    const TotalRecord = rows.length ? B.outInt(rows[0], 'recordcount') : 0;
    ViewBag.CurrentPage = page; ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.fromusername = fromusername;
    ViewBag.tousername = tousername;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, fromDate, toDate, page, fromusername, tousername);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/EwalletReverse_Transaction/Index.cshtml', Model: Obj, ...ViewBag });
  } catch (ExpObj) {
    return B.errorView(req, res, ExpObj, 'USP_REVERSETRANSACTIONLIST_EWallet');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, int? page, string fromusername, string tousername)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.fromDate), B.nStr(req.p.toDate), B.nInt(req.p.page),
    B.nStr(req.p.fromusername), B.nStr(req.p.tousername));
  if (!r.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult ReverseTransaction(string TASMID)
// auth (reads Session["Admin_User"] outside the try)
router.all(`/admin/${C}/ReverseTransaction{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TASMID = B.nStr(req.p.TASMID);
  const Empid = req.user.emp_id;
  let RetMsg = '';
  try {
    const row = await db.procOne(DB, 'USP_REVERSETRANSACTION_EWallet', { TASMID, EID: Empid });
    const v = B.col(row, 'strresult');
    if (v === null || v === undefined) throw B.nullRef(); // SpOutput.Value.ToString()
    RetMsg = B.str(v);
    return res.json(RetMsg);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_REVERSETRANSACTION_EWallet');
    RetMsg = 'Error occurred. Please try later';
    return res.json(RetMsg);
  }
}));

module.exports = router;
