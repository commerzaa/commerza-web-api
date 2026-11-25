'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\CoinWithdrawalController.cs
// (class Common.Controllers.AdminPanel.CoinWithdrawalController => /CoinWithdrawal/...). Database: affiliate (Db_Affiliate).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch04-b-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'CoinWithdrawal';

/** class CoinWithdrawal */
const PROPS = ['ROWNUMBER', 'WDID', 'COIN', 'WALLET_ADDRESS', 'STATUS', 'DATE', 'USERNAME', 'MOBILE', 'Name', 'TRANS_ID'];

// PORT-NOTE: `private static string url, url1` kept as module variables (ExportReport logs the url of the last Index call).
let url = '';
let url1 = '';

/** [DBO].[USP_COINWITHDRAWALS] @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@PAYMODE,@TOTALCOUNT OUT,@Userdownlinemember,@SIDE */
async function coinWithdrawals(page, MaxRows, SearchField, SearchValue, fromdate, todate, Userdownlinemember, Side) {
  if (fromdate === null || todate === null || SearchField === null || SearchValue === null) throw B.NRE(); // .Trim() on null
  return db.proc(DB, 'USP_COINWITHDRAWALS', {
    STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate.trim(), TODATE: todate.trim(), SEARCHFIELD: SearchField.trim(),
    SEARCHVALUE: SearchValue.trim(), PAYMODE: '8', Userdownlinemember, SIDE: Side,
  });
}

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, string Paymode, string Userdownlinemember, int? Side) */
async function ExportReport(req, res, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, Paymode, Userdownlinemember, Side) {
  const ViewBag = {};
  const userid = req.user.emp_id;
  const Filename = `Coin_Withdrawal_${userid}_${B.nowStamp()}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
  const MaxRows = await UtilityClass.GridPageSize(); // unused (legacy)
  void MaxRows;
  if (page === null) page = 1;
  const Withdrawal_Coin = mapRows(await coinWithdrawals(page, 10000, SearchField, SearchValue, fromdate, todate, Userdownlinemember, Side), PROPS);
  const sent = await B.exportXls({
    req, res, rows: Withdrawal_Coin, sheet: 'Coin_Withdrawal', procName: 'ExportReport', itemProcName: 'Withdrawal_Coin', ViewBag,
    headers: ['S.No. \t', 'Username \t', 'Mobile \t', 'Date \t', 'COIN \t', 'TRANSACTION ID \t', 'WALLET ADDRESS \t', 'STATUS \t'],
    row: (item, w) => {
      w(B.tab(B.ts(item.ROWNUMBER)) + ' \t');
      w(B.tab(B.ts(item.USERNAME)) + ' \t');
      w(B.tab(B.ts(item.MOBILE)) + ' \t');
      w(B.tab(B.netDefault(item.DATE)) + ' \t');
      w(B.tab(B.ts(item.COIN)) + ' \t');
      w(B.tab(B.ts(item.TRANS_ID)) + ' \t');
      w(B.tab(B.ts(item.WALLET_ADDRESS)) + ' \t');
      w(B.tab(B.ts(item.STATUS)) + ' \t');
    },
  });
  return { sent, ViewBag };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, string Paymode, string Userdownlinemember, int? Side, string btnexel)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Coin-Withdrawal" -> CoinWithdrawal/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Coin-Withdrawal'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.ip(req, 'dynamicpagging');
  let SearchField = B.sp(req, 'SearchField');
  let SearchValue = B.sp(req, 'SearchValue');
  let fromdate = B.sp(req, 'fromdate');
  let todate = B.sp(req, 'todate');
  let page = B.ip(req, 'page');
  let ddlcustpage = B.ip(req, 'ddlcustpage');
  let Paymode = B.sp(req, 'Paymode');
  let Userdownlinemember = B.sp(req, 'Userdownlinemember');
  let Side = B.ip(req, 'Side');
  const btnexel = B.sp(req, 'btnexel');
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (dynamicpagging === null) dynamicpagging = config.app.DynamicPagging == null ? 0 : B.toInt32(config.app.DynamicPagging); // Convert.ToInt16
  if (todate === null) todate = '';
  if (Paymode === null) Paymode = '';
  if (Side === null) Side = 0;
  if (Userdownlinemember === null) Userdownlinemember = '';
  const ViewBag = {};
  const perm = await B.pagePerm(req, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = await B.excelActive(url);
  const MaxRows = dynamicpagging;
  if (page === null) page = 1;
  const rows = await coinWithdrawals(page, MaxRows, SearchField, SearchValue, fromdate, todate, Userdownlinemember, Side);
  const Withdrawal_Coin = mapRows(rows, PROPS);
  const tc = B.str(B.outVal(rows, 'TOTALCOUNT'));
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = B.toInt32(tc === '' ? '0' : tc);
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.ddlcustpage = ddlcustpage;
  if (btnexel === 'Export Excel') {
    const e = await ExportReport(req, res, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, Paymode, Userdownlinemember, Side);
    if (e.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Coin_Withdrawal/Index.cshtml', Model: Withdrawal_Coin, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const e = await ExportReport(req, res, B.sp(req, 'SearchField'), B.sp(req, 'SearchValue'), B.sp(req, 'fromdate'), B.sp(req, 'todate'),
    B.ip(req, 'page'), B.ip(req, 'ddlcustpage'), B.sp(req, 'Paymode'), B.sp(req, 'Userdownlinemember'), B.ip(req, 'Side'));
  if (!e.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult GetWithdrawalDetailsByWdid(int WDID)
// auth (member withdrawal data; legacy had no session check)
router.all(`/admin/${C}/GetWithdrawalDetailsByWdid{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const WDID = B.reqNum(req, 'WDID');
  const BtcWithdrawal = mapRows(await db.proc(DB, 'USP_UPDATECOINWITHDRAWALSTATUS', {
    MODE: 2, WDID, COIN: '', STATUS: '', REMARK: '',
  }), PROPS);
  return res.json(BtcWithdrawal);
}));

// ---------------------------------------------------------------- JsonResult UpdateStatusForWithdrawal(string COIN, string Status, int WDID, string Remark, string Date)
// auth (changes withdrawal status; legacy had no session check)
router.all(`/admin/${C}/UpdateStatusForWithdrawal{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const WDID = B.reqNum(req, 'WDID');
  const out = await db.proc(DB, 'USP_UPDATECOINWITHDRAWALSTATUS', {
    MODE: '1', WDID, COIN: B.sp(req, 'COIN'), STATUS: B.sp(req, 'Status'), REMARK: B.sp(req, 'Remark'), DATE: B.sp(req, 'Date'),
  });
  const ret = B.str(B.outVal(out, 'RESULT'));
  return res.json(ret);
}));

module.exports = router;
