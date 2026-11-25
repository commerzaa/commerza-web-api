'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\CommissionWallet_M_M.cs (class CommissionWallet_M_MController => /CommissionWallet_M_M/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const B = require('./_shared/batch04B_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'CommissionWallet_M_M';

/** class Fund_Transfer_History (Controllers/AdminPanel/Fund_Transfer_History.cs) */
const PROPS = ['RowNumber', 'FromPlid', 'ToPlid', 'FromUsername', 'ToUsername', 'ToEmail', 'ToFullName', 'Amount', 'Date', 'Remark', 'Type',
  'TransactionID', 'ID', 'reversed'];

// PORT-NOTE: `private static string url, url1` kept as module variables.
let url = '';
let url1 = '';

/** [Usp_TransferFundToUser] @Mode=15,@TMFTHID,@PLID,@ToPlid,@Amount,@Remark,@StrResult OUT,@TotalCount OUT,@FromDate,@ToDate,@StartRowIndex,@MaxRows,@SearchUsername,@Typeofcrdr,@paymode,@IncomeData,@orderbydate */
function transferHistory(Type, Username, fromDate, toDate, page, MaxRows, ToUsername, orderbydate) {
  return db.proc(DB, 'Usp_TransferFundToUser', {
    Mode: '15', TMFTHID: Type, PLID: '0', ToPlid: '0', Amount: '0', Remark: Username, FromDate: fromDate, ToDate: toDate,
    StartRowIndex: page, MaxRows, SearchUsername: ToUsername, Typeofcrdr: '0', paymode: '0', IncomeData: '0', orderbydate,
  });
}

/** public void ExportReport(string fromDate, string toDate, int? page, string Username, string Type, string ToUsername, int? ddlcustpage) */
async function ExportReport(req, res, fromDate, toDate, page, Username, Type, ToUsername, ddlcustpage) {
  const ViewBag = {};
  const userid = req.user.emp_id;
  const Filename = `Fund_Transfer_History_${userid}_${B.nowStamp()}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
  await UtilityClass.GridPageSize(); // int MaxRows = UtilityClass.GridPageSize(); (unused)
  if (page === null) page = 1;
  const Obj = mapRows(await transferHistory(Type, Username, fromDate, toDate, 1, 1000000, ToUsername, ''), PROPS);
  const sent = await B.exportXls({
    req, res, rows: Obj, sheet: 'Fund_Transfer_History', procName: 'Usp_TransferFundToUser', itemProcName: 'Fund_Transfer_History', ViewBag,
    headers: ['S.No. \t', 'Date \t', 'TransferredID \t', 'TransferredFrom \t', 'TransferredTo \t', 'Amount \t'],
    row: (item, w) => {
      w(B.tab(B.ts(item.RowNumber)) + ' \t');
      w(B.tab(B.fmtDate(item.Date, 'dd-MM-yyyy')) + ' \t');
      w(B.tab(B.ts(item.TransactionID)) + ' \t');
      w(B.tab(B.ts(item.FromUsername).split(' ').join('')) + ' \t');
      w(B.tab(B.ts(item.ToUsername).split(' ').join('')) + ' \t');
      w(B.tab(Number(item.Amount || 0).toFixed(2)) + ' \t'); // decimal.ToString("0.00")
    },
  });
  return { sent, ViewBag };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string fromDate, string toDate, int? page, string Username, string Type, string ToUsername, int? ddlcustpage, string btnexel)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/CommissionWallet-Transaction" -> CommissionWallet_M_M/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/CommissionWallet-Transaction'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.ip(req, 'dynamicpagging');
  let orderbydate = B.sp(req, 'orderbydate');
  let fromDate = B.sp(req, 'fromDate');
  let toDate = B.sp(req, 'toDate');
  let page = B.ip(req, 'page');
  let Username = B.sp(req, 'Username');
  let Type = B.sp(req, 'Type');
  let ToUsername = B.sp(req, 'ToUsername');
  let ddlcustpage = B.ip(req, 'ddlcustpage');
  let btnexel = B.sp(req, 'btnexel');
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (Username === null) Username = '';
  if (ToUsername === null) ToUsername = '';
  if (Type === null) Type = '0';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = 'desc';
  if (btnexel === null) btnexel = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  const ViewBag = {};
  const perm = await B.pagePerm(req, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = await B.excelActive(url);
  try {
    const MaxRows = dynamicpagging;
    if (page === null) page = 1;
    const rows = await transferHistory(Type, Username, fromDate, toDate, page, MaxRows, ToUsername, orderbydate);
    const Obj = mapRows(rows, PROPS);
    const TotalRecord = B.toInt32(B.str(B.outVal(rows, 'TotalCount')));
    ViewBag.CurrentPage = page;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.GridPageSize = ddlcustpage;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.Username = Username;
    ViewBag.ToUsername = ToUsername;
    ViewBag.Type = Type;
    if (btnexel === 'Export Excel') {
      const e = await ExportReport(req, res, fromDate, toDate, page, Username, Type, ToUsername, ddlcustpage);
      if (e.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/CommissionWallet_M_M/Index.cshtml', Model: Obj, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'Usp_TransferFundToUser');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const e = await ExportReport(req, res, B.sp(req, 'fromDate'), B.sp(req, 'toDate'), B.ip(req, 'page'), B.sp(req, 'Username'),
    B.sp(req, 'Type'), B.sp(req, 'ToUsername'), B.ip(req, 'ddlcustpage'));
  if (!e.sent) res.send('');
}));

module.exports = router;
