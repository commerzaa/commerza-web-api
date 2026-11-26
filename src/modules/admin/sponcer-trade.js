'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Sponcer_Trade.cs (class Sponcer_TradeController, no namespace => /admin/Sponcer_Trade/...)
// Database: affiliate (Db_Affiliate). Procs USP_SPONSORTRADEPROFITDETAILS, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, col, str, perms, cvtInt, cvtDec, nowStamp, excelHistory, writeXlsExport, cellStr, tab, netFormat, dec2, trimS,
} = require('./_shared/batch11-common');

const router = express.Router();
const C = 'Sponcer_Trade';

/** public class SponcerTrade */
const SPONCER_TRADE_PROPS = ['ROWNUMBER', 'TDTPID', 'FROMID', 'TOID', 'PAYID', 'DATE', 'STATUS', 'STP'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, page, ddlcustpage) {
  const userid = req.user.emp_id;
  const Filename = 'Sponcer_trade_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = ddlcustpage === null ? 0 : Number(ddlcustpage); // Convert.ToInt32(int?) (null => 0)
  if (page === null) page = 1;
  // [USP_SPONSORTRADEPROFITDETAILS] @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@LOGINID,@TOTALCOUNT OUT,@TOTALAMOUNT OUT
  const SponcerTrade = mapRows(await db.proc(DB, 'USP_SPONSORTRADEPROFITDETAILS', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: trimS(SearchField), SEARCHVALUE: trimS(SearchValue), FROMDATE: fromdate, TODATE: todate, LOGINID: '',
  }), SPONCER_TRADE_PROPS);
  if (SponcerTrade.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'Sponcer_trade.xls', downloadName: '/Sponcer_trade.xls', Filename, ViewBag, rows: SponcerTrade,
      headers: ['S.No.', 'From Username', 'To Username', 'Date', 'Amount'],
      innerProc: 'SponcerTrade', outerProc: 'USP_SPONSORTRADEPROFITDETAILS',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'FROMID')) + ' \t');
        w(tab(cellStr(item, 'TOID')) + ' \t');
        w(tab(netFormat(item.DATE, 'dd-MM-yyyy')) + ' \t');
        w(tab(dec2(item.STP)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue,
//   string fromdate, string todate, int? page, int? ddlcustpage, string btnexel)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Sponcer-Trade" -> Sponcer_Trade/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Sponcer-Trade'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromdate = nStr(req.p.fromdate);
  let todate = nStr(req.p.todate);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  let btnexel = nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (btnexel === null) btnexel = '';
  const ViewBag = {};
  const Empid = req.user.emp_id;
  Object.assign(ViewBag, await perms(Empid, url)); // CheckPermissions.GetPageActionPermission / GetExcelPermission
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  // [USP_SPONSORTRADEPROFITDETAILS] @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@LOGINID,@TOTALCOUNT OUT,@TOTALAMOUNT OUT,@orderbydate
  const rows = await db.proc(DB, 'USP_SPONSORTRADEPROFITDETAILS', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FROMDATE: fromdate, TODATE: todate,
    LOGINID: '', orderbydate,
  });
  const SponcerTrade = mapRows(rows, SPONCER_TRADE_PROPS);
  const tc = str(col(rows[0], 'TOTALCOUNT'));
  const TotalRecord = cvtInt(tc === '' ? '0' : tc);
  const ta = str(col(rows[0], 'TOTALAMOUNT'));
  const TotalAmount = cvtDec(ta === '' ? '0' : ta);
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
  ViewBag.TotalAmount = TotalAmount;
  ViewBag.ddlcustpage = ddlcustpage;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, page, ddlcustpage);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Sponcer_Trade/Index.cshtml', Model: SponcerTrade, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.fromdate), nStr(req.p.todate),
    nInt(req.p.page), nInt(req.p.ddlcustpage));
  if (!r.sent && !res.headersSent) res.send(''); // void action => empty response
}));

module.exports = router;
