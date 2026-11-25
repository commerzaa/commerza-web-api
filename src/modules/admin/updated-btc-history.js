'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Updated_Btc_History.cs (class Updated_Btc_HistoryController => /admin/Updated_Btc_History/...)
// Database: affiliate (Db_Affiliate). Procs USP_EXCEL_LINK, USP_GETEXCELPERMISIONSTATUS, USP_BTCHISTORY, USP_EXCEL_DOWNLOAD_HISTORY; table tbl_paymode.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, nowStamp, excelHistory, writeXlsExport, cellStr, tab, errorView, excelLink, inlinePerms, cvtInt,
} = require('./_shared/batch11-common');
const { strictIntOut } = require('./_shared/batch13-10-common');

const router = express.Router();
const C = 'Updated_Btc_History';

/** class BtcHistory */
const BTC_HISTORY_PROPS = ['ROWNUMBER', 'Regno', 'Address', 'AddressType', 'ACTIVE', 'LastUpdate', 'IPAddress', 'USERNAME', 'MemberName', 'mobileno'];
/** class PayMode */
const PAY_MODE_PROPS = ['PMOID', 'PAYMODE'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** public void ExportReport(string SearchField, string SearchValue, int? page) */
async function ExportReport(req, res, SearchField, SearchValue, page, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Updated_Btc_History' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  if (SearchField === null || SearchValue === null) throw new Error('Object reference not set to an instance of an object.');
  // USP_BTCHISTORY @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@ADDRESSTYPE,@TOTALCOUNT out,@STRRESULT out
  const list = mapRows(await db.proc(DB, 'USP_BTCHISTORY', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FROMDATE: '', TODATE: '', ADDRESSTYPE: 0,
  }), BTC_HISTORY_PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'Updated_Btc_History.xls', Filename, ViewBag, rows: list,
      headers: ['S.No.', 'Username', 'LastUpdate', 'Address', 'IPAddress'],
      innerProc: 'BtcHistory', outerProc: 'USP_BTCHISTORY',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(cellStr(item, 'LastUpdate')) + ' \t');
        w(tab(cellStr(item, 'Address')) + ' \t');
        w(tab(cellStr(item, 'IPAddress')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue,
//   int? page, string btnexel, string ddlsearchDownline, string fromDate, string toDate, int? ddlpaymode)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Updated-Btc-History" -> Updated_Btc_History/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Updated-Btc-History'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let page = nInt(req.p.page);
  let btnexel = nStr(req.p.btnexel);
  let ddlsearchDownline = nStr(req.p.ddlsearchDownline);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let ddlpaymode = nInt(req.p.ddlpaymode);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (SearchField === null) SearchField = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ddlsearchDownline === null) ddlsearchDownline = '';
  if (SearchValue === null) SearchValue = '';
  if (btnexel === null) btnexel = '';
  if (ddlpaymode === null) ddlpaymode = 0;
  const ViewBag = {};
  // USP_EXCEL_LINK @url,@ISACTIVE out
  ViewBag.excelactive = await excelLink(url);
  const Employeeid = req.user.emp_id;
  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
  const ip = await inlinePerms(Employeeid, url);
  ViewBag.isactive = ip.isactive;
  ViewBag.isedit = ip.isedit;
  try {
    const MaxRows = cvtInt(dynamicpagging);
    if (page === null) page = 1;
    // USP_BTCHISTORY @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@ADDRESSTYPE,@TOTALCOUNT out,@STRRESULT out,@orderbydate
    const rows = await db.proc(DB, 'USP_BTCHISTORY', {
      STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FROMDATE: fromDate, TODATE: toDate,
      ADDRESSTYPE: ddlpaymode, orderbydate,
    });
    const BtcHistory = mapRows(rows, BTC_HISTORY_PROPS);
    const TotalRecord = strictIntOut(rows, 'TOTALCOUNT');
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.SearchField = SearchField;
    ViewBag.ddlpaymode = ddlpaymode;
    ViewBag.SearchValue = SearchValue;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    if (btnexel === 'Export Excel') {
      const x = await ExportReport(req, res, SearchField, SearchValue, page, ViewBag);
      if (x.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Updated_Btc_History/Index.cshtml', Model: BtcHistory, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_BTCHISTORY');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, int? page)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.SearchField), nStr(req.p.SearchValue), nInt(req.p.page), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult AllPayMode()
// public (master-data dropdown; no session check in legacy)
router.all(`/admin/${C}/AllPayMode{/:id}`, asyncHandler(async (req, res) => {
  let PayMode = [];
  try {
    PayMode = mapRows(await db.query(DB, "select pmoid, coalesce(paymode, '') as paymode from tbl_paymode where status = 1", {}), PAY_MODE_PROPS);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'AllPayMode');
  }
  return res.json(PayMode);
}));

module.exports = router;
