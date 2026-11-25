'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ETHWithdrawal.cs (class ETHWithdrawalController, no namespace => /ETHWithdrawal/...)
// Database: affiliate (Db_Affiliate). Procs USP_COINWITHDRAWALS, USP_UPDATEETHWITHDRAWALSTATUS, USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK,
// USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  nInt, nStr, reqInt, col, str, cvtInt, inlinePerms, nowStamp, excelHistory, writeXlsExport, cellStr, tab, trimNull,
} = require('./_shared/batch06-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'ETHWithdrawal';

/** public class ETHWithdrawal */
const ETH_WITHDRAWAL_PROPS = ['ROWNUMBER', 'WDID', 'COIN', 'WALLET_ADDRESS', 'STATUS', 'DATE', 'USERNAME', 'MOBILE', 'Name', 'TRANS_ID', 'Withdrawal_BTC',
  'TRANS_IDETH'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** [DBO].[USP_COINWITHDRAWALS] @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@PAYMODE,@TOTALCOUNT OUT */
const coinWithdrawals = (STARTROWINDEX, MAXROWS, FROMDATE, TODATE, SEARCHFIELD, SEARCHVALUE) => db.proc(DB, 'USP_COINWITHDRAWALS', {
  STARTROWINDEX, MAXROWS, SEARCHFIELD, SEARCHVALUE, FROMDATE, TODATE, PAYMODE: '3',
});

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, string Paymode) */
async function ExportReport(req, res, SearchField, SearchValue, fromdate, todate, Paymode, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'All_Downline_Member_List_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const list = mapRows(await coinWithdrawals(1, 999999, trimNull(fromdate), trimNull(todate), trimNull(SearchField), trimNull(SearchValue)),
    ETH_WITHDRAWAL_PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'All_Downline_Member_List.xls', Filename, ViewBag, rows: list,
      headers: ['s.No.', 'USERNAME', 'MOBILE', 'DATE', 'ETH', 'TRANSACTION ID', 'WALLET ADDRESS', 'STATUS'],
      // (legacy inner catch had no ErrorInsert; outer catch only set ViewBag.filepath)
      cells: (item, w) => {
        w('\n');
        for (const k of ['ROWNUMBER', 'USERNAME', 'MOBILE', 'DATE', 'Withdrawal_BTC', 'TRANS_IDETH', 'WALLET_ADDRESS', 'STATUS']) w(tab(cellStr(item, k)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(string btnexel, string SearchField, string SearchValue, string fromdate, string todate,
//   int? page, int? ddlcustpage, string Paymode)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/ETH-Withdrawal" -> ETHWithdrawal/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/ETH-Withdrawal'], adminAuth, asyncHandler(async (req, res) => {
  let btnexel = nStr(req.p.btnexel);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromdate = nStr(req.p.fromdate);
  let todate = nStr(req.p.todate);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  let Paymode = nStr(req.p.Paymode);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (btnexel === null) btnexel = '';
  const ViewBag = {};
  const perm = await inlinePerms(req.user.emp_id, url); // USP_EXCEL_LINK + USP_GETEXCELPERMISIONSTATUS
  ViewBag.excelactive = perm.excelactive;
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (Paymode === null) Paymode = '';
  const MaxRows = Number(ddlcustpage);
  if (page === null) page = 1;
  const rows = await coinWithdrawals(page, MaxRows, fromdate.trim(), todate.trim(), SearchField.trim(), SearchValue.trim());
  const list = mapRows(rows, ETH_WITHDRAWAL_PROPS);
  const tc = str(col(rows[0], 'TOTALCOUNT'));
  const TotalRecord = cvtInt(tc === '' ? '0' : tc);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.ddlcustpage = ddlcustpage;
  if (btnexel === 'Export Excel') {
    const x = await ExportReport(req, res, SearchField, SearchValue, fromdate, todate, Paymode, ViewBag);
    if (x.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/ETHWithdrawal/Index.cshtml', Model: list, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, string Paymode)
// auth (PORT-NOTE: public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.fromdate), nStr(req.p.todate),
    nStr(req.p.Paymode), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult GetWithdrawalDetailsByWdid(int WDID)
// auth (PORT-NOTE: legacy had no session check; withdrawal data => adminAuth)
router.all(`/admin/${C}/GetWithdrawalDetailsByWdid{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const WDID = reqInt(req.p.WDID, 'WDID');
  // [USP_UPDATEETHWITHDRAWALSTATUS] @MODE,@WDID,@COIN,@STATUS,@REMARK,@RESULT OUT
  const list = mapRows(await db.proc(DB, 'USP_UPDATEETHWITHDRAWALSTATUS', { MODE: 2, WDID, COIN: '', STATUS: '', REMARK: '' }), ETH_WITHDRAWAL_PROPS);
  return res.json(list);
}));

// ---------------------------------------------------------------- JsonResult UpdateStatusForWithdrawal(string COIN, string Status, int WDID, string Remark, string Date)
// auth (PORT-NOTE: legacy had no session check; approves/rejects withdrawals => adminAuth)
router.all(`/admin/${C}/UpdateStatusForWithdrawal{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const WDID = reqInt(req.p.WDID, 'WDID');
  // [USP_UPDATEETHWITHDRAWALSTATUS] @MODE,@WDID,@COIN,@STATUS,@REMARK,@RESULT OUT,@DATE
  const row = await db.procOne(DB, 'USP_UPDATEETHWITHDRAWALSTATUS', {
    MODE: '1', WDID, COIN: nStr(req.p.COIN), STATUS: nStr(req.p.Status), REMARK: nStr(req.p.Remark), DATE: nStr(req.p.Date),
  });
  const ret = str(col(row, 'RESULT'));
  return res.json(ret);
}));

module.exports = router;
