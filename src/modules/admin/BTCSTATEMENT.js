'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\BTCSTATEMENT.cs (class BTCSTATEMENTController => /admin/BTCSTATEMENT/...)
// Database: affiliate (Db_Affiliate). Model class BTCSTATEMENT (same file) => BTC_PROPS.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const { str, sp, ip, outVal, ts, tab, nowStamp, exportXls } = require('./_shared/batch04B_common');
const { excelHistory, strTrim, viewPerms, dec2, decParse } = require('./_shared/batch04_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'BTCSTATEMENT';

const BTC_PROPS = ['ROWNUMBER', 'FromGeneratedDateAndTimeDate', 'Amount', 'USERNAME', 'BtcAddress', 'Status', 'COINCODE', 'COINRATE', 'TXTID', 'STATUSURL',
  'QRCODE', 'CONFIRMNEED', 'IsPaidtoEwallet', 'Name'];

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields.
let url = '';
let url1 = '';

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string btnexel, string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/BTC-STATEMENT" -> BTCSTATEMENT/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/BTC-STATEMENT'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = ip(req, 'dynamicpagging');
  let orderbydate = sp(req, 'orderbydate');
  let btnexel = sp(req, 'btnexel');
  let SearchField = sp(req, 'SearchField');
  let SearchValue = sp(req, 'SearchValue');
  let fromdate = sp(req, 'fromdate');
  let todate = sp(req, 'todate');
  let page = ip(req, 'page');
  let ddlcustpage = ip(req, 'ddlcustpage');

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  // USP_EXCEL_LINK (CommandTimeout 1000) first, then USP_GETEXCELPERMISIONSTATUS (legacy order)
  const ViewBag = await viewPerms(req, url, ['link', 'perm']);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (btnexel === null) btnexel = '';
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    // [USP_BTC_STATEMENT] @STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@SEARCHFIEL,@SEARCHVALUE,@PLID,@TOTALCOUNT OUT,@TOTALAMOUNT OUT,@orderbydate
    const rows = await db.proc(DB, 'USP_BTC_STATEMENT', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: strTrim(SearchField), SEARCHVALUE: strTrim(SearchValue),
      PLID: '0', orderbydate,
    });
    const AllFreeEpinList = mapRows(rows, BTC_PROPS);
    const tc = str(outVal(rows, 'TOTALCOUNT'));
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    const TOTALAMOUNTS = decParse(outVal(rows, 'TOTALAMOUNT')); // decimal.Parse(DBNull.ToString()) => FormatException => catch
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TOTALAMOUNTS = TOTALAMOUNTS;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    await UtilityClass.GridNumbersPerPage(); // int Noofpage (unused)
    if (btnexel === 'Export Excel') {
      if (await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate)) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/BTCSTATEMENT/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_BTC_STATEMENT');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' });
  }
}));

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate) - true when sent */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate) {
  const userid = req.user.emp_id;
  const Filename = `Coin_Payment_Status_${userid}_${nowStamp()}`;
  await excelHistory(userid, url, Filename);
  // same proc without @orderbydate
  const list = mapRows(await db.proc(DB, 'USP_BTC_STATEMENT', {
    STARTROWINDEX: 1, MAXROWS: 999999, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: strTrim(SearchField), SEARCHVALUE: strTrim(SearchValue), PLID: '0',
  }), BTC_PROPS);
  return exportXls({
    req, res, rows: list, sheet: 'Coin_Payment_Status', procName: 'Usp_TransferFundToUser', itemProcName: 'Coin_Payment_Status', ViewBag,
    headers: ['S.No. \t', 'UserName \t', 'DATE \t', 'Coin Code \t', 'Coin Rate \t', 'Amount(INR) \t', 'Confirm Needed \t', 'Status \t'],
    row: (item, w) => {
      w(tab(ts(item.ROWNUMBER)) + ' \t');
      w(tab(ts(item.USERNAME)) + ' \t');
      w(tab(ts(item.FromGeneratedDateAndTimeDate)) + ' \t');
      w(tab(ts(item.COINCODE)) + ' \t');
      w(tab(dec2(item.COINRATE)) + ' \t');
      w(tab(dec2(item.Amount)) + ' \t');
      w(tab(ts(item.CONFIRMNEED)) + ' \t');
      w(tab(ts(item.IsPaidtoEwallet)) + ' \t');
    },
  });
}

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, sp(req, 'SearchField'), sp(req, 'SearchValue'), sp(req, 'fromdate'), sp(req, 'todate'));
  if (!sent) res.send(''); // void action => empty response
}));

module.exports = router;
