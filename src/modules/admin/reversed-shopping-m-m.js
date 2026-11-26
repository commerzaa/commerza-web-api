'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ReversedShopping_M_M.cs
// (class ReversedShopping_M_MController => /admin/ReversedShopping_M_M/...). Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nint, nstr, view, perms, n2, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows, outParseInt, outStr, outRaw,
} = require('./_shared/batch13-04-common');

const router = express.Router();
const C = 'ReversedShopping_M_M';

/** class EwalletReversetransactionlist (declared in EwalletReverse_TransactionController.cs) - used by Index */
const EWALLET_REV_PROPS = ['Rownumber', 'TMIFTID', 'FROMPLID', 'FROMUSERNAME', 'TOUSERNAME', 'AMOUNT', 'TRANSFER_DATE', 'MOBILE',
  'ReverseTransactionID', 'TransactionID', 'SWRID'];
/** class Reversetransactionlist (declared in Reverse_TransactionController.cs) - used by ExportReport */
const REVERSE_PROPS = ['Rownumber', 'TMAFTID', 'FROMPLID', 'FROMUSERNAME', 'TOUSERNAME', 'AMOUNT', 'TRANSFER_DATE', 'MOBILE',
  'ReverseTransactionID', 'TransactionID'];
// (class ReversedShopping_M_M in this file is an unused model)

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

// public void ExportReport(string fromDate, string toDate, int? page, string fromusername, string tousername)
async function ExportReport(req, res, fromDate, toDate, page, fromusername, tousername, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'ShoppingWalletReversed_List_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  const MaxRows = await UtilityClass.GridPageSize(); // (unused, like legacy)
  void MaxRows;
  if (page === null) page = 1;
  // (no @orderbydate => proc default)
  const rows = await db.proc(DB, 'USP_REVERSETRANSACTIONLIST_SHOPPINGWallet', {
    FROMDATE: fromDate, TODATE: toDate, FROMUSERNAME: fromusername, TOUSERNAME: tousername, STARTROWINDEX: page, MAXROWS: '100000000',
  });
  const Obj = mapRows(rows, REVERSE_PROPS);
  if (Obj.length > 0) {
    return tsvDownload({
      req, res, ViewBag, xlsName: 'Payit_Forward_List.xls', Filename,
      headers: ['S.No.', 'Date', 'TransactionID', 'FromUsername', 'ToUsername', 'Amount', 'ReverseTransactionID'],
      rows: Obj,
      innerProc: 'Reversetransactionlist',
      outerProc: 'USP_REVERSETRANSACTIONLIST_EWallet',
      cells: (item, w) => {
        w(tab(cs(item.Rownumber)) + ' \t');
        w(tab(cs(item.TRANSFER_DATE)) + ' \t');
        w(tab(cs(item.TransactionID)) + ' \t');
        const From_Username = cs(item.FROMUSERNAME).split(' ').join('');
        w(tab(From_Username) + ' \t');
        const ToUser_name = cs(item.TOUSERNAME).split(' ').join('');
        w(tab(ToUser_name) + ' \t');
        w(tab(n2(item.AMOUNT)) + ' \t');
        w(tab(cs(item.ReverseTransactionID)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string fromDate, string toDate, int? page, string fromusername, string tousername, string btnexel)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/Shopping-Reverse-Transaction" (id optional) -> ReversedShopping_M_M/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Shopping-Reverse-Transaction{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = nstr(req.p.orderbydate);
  let fromDate = nstr(req.p.fromDate);
  let toDate = nstr(req.p.toDate);
  let page = nint(req.p.page);
  let fromusername = nstr(req.p.fromusername);
  let tousername = nstr(req.p.tousername);
  let btnexel = nstr(req.p.btnexel);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (btnexel === null) btnexel = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (fromusername === null) fromusername = '';
  if (tousername === null) tousername = '';
  const Empid = req.user.emp_id;
  await perms(url, Empid, ViewBag);
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_REVERSETRANSACTIONLIST_SHOPPINGWallet', {
      FROMDATE: fromDate, TODATE: toDate, FROMUSERNAME: fromusername, TOUSERNAME: tousername, STARTROWINDEX: page, MAXROWS: MaxRows,
      orderbydate,
    });
    const Obj = mapRows(rows, EWALLET_REV_PROPS);
    const TotalRecord = outParseInt(rows, 'RECORDCOUNT'); // Convert.ToInt32(spOutput.Value.ToString())
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
      const r = await ExportReport(req, res, fromDate, toDate, page, fromusername, tousername, ViewBag);
      if (r.sent) return undefined;
    }
    return view(res, '~/Views/AdminPanel/ReversedShopping_M_M/Index.cshtml', Obj, ViewBag);
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_REVERSETRANSACTIONLIST_EWallet');
    return view(res, '~/Views/PageNotFound/Index.cshtml', undefined, ViewBag);
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, int? page, string fromusername, string tousername)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nstr(req.p.fromDate), nstr(req.p.toDate), nint(req.p.page), nstr(req.p.fromusername),
    nstr(req.p.tousername), {});
  if (!r.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult ReverseTransaction(string TASMID)
// auth (reads Session["Admin_User"] outside the try)
router.all(`/admin/${C}/ReverseTransaction{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TASMID = nstr(req.p.TASMID);
  const Empid = req.user.emp_id;
  let RetMsg = '';
  try {
    const rows = await db.proc(DB, 'USP_REVERSETRANSACTION_SHOPPINGWALLET', { TASMID, EID: Empid });
    RetMsg = outStr(outRaw(rows, 'STRRESULT')); // SpOutput.Value.ToString() (DBNull => "")
    return res.json(RetMsg);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_REVERSETRANSACTION_EWallet');
    RetMsg = 'Error occurred. Please try later';
    return res.json(RetMsg);
  }
}));

module.exports = router;
