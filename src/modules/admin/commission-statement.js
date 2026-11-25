'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Commission_StatementController.cs
// (class Common.Controllers.AdminPanel.Commission_StatementController => /Commission_Statement/...). Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const { pagePermissions, excelLink } = require('./_shared/login-log-common');
const B = require('./_shared/batch04-b-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Commission_Statement';

/** class Commission_Statement */
const PROPS = ['RowNumber', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance', 'USERNAME', 'TOUSERNAME'];

// PORT-NOTE: `private static string url, url1` kept as module variables. `private Int64 Regno` is per controller instance
// (per request): ExportReport sees the Regno of the Index call that invoked it, or 0 when routed directly.
let url = '';
let url1 = '';

/**
 * [USP_COMMISSION_STATEMENT] @PLID,@FromDate,@ToDate,@StartRowIndex,@MaxRows,@StrResult OUT,@TotalCount OUT,@CrDrType,@TrType,
 *   @cramount out,@dramount out,@avalibalefund out,'','','','','',@mode[,@orderbydate]
 * PORT-NOTE: the five '' positional values went to the OUT parameters @GrossCoinWallet..@AvailableCommissionWallet (as inputs, so
 * they were not read back); PostgreSQL OUT parameters are not passed, they come back as result columns (ignored like legacy).
 */
function commissionStatement(p) {
  return db.proc(DB, 'USP_COMMISSION_STATEMENT', p);
}

/** public void ExportReport(string CrDrType, string fromDate, string toDate) */
async function ExportReport(req, res, Regno, CrDrType, fromDate, toDate) {
  const ViewBag = {};
  const userid = req.user.emp_id;
  const Filename = `Commission_Statement_${userid}_${B.nowStamp()}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
  await UtilityClass.GridPageSize(); // int MaxRows = UtilityClass.GridPageSize(); (unused)
  const Obj = mapRows(await commissionStatement({
    PLID: Regno, FromDate: fromDate, TrType: '0', StartRowIndex: 1, MaxRows: 9999999, ToDate: toDate, CrDrType,
    mode: 'COMMISSION Debit BY ADMIN',
  }), PROPS);
  let rownumber = 1;
  const sent = await B.exportXls({
    req, res, rows: Obj, sheet: 'Commission_Statement', procName: 'Usp_TransferFundToUser', itemProcName: 'Commission_Statement', ViewBag,
    headers: ['S.No. \t', 'Username \t', 'Debited By \t', 'Date \t', 'Particulars \t', 'Dr \t', 'Balance \t'],
    row: (item, w) => {
      w(B.tab(String(rownumber)) + ' \t');
      w(B.tab(B.ts(item.USERNAME)) + ' \t');
      w(B.tab(B.ts(item.TOUSERNAME)) + ' \t');
      w(B.tab(B.ts(item.ProcessDate)) + ' \t');
      w(B.tab(B.ts(item.Remark)) + ' \t');
      w(B.tab(Number(item.Dr_Amount || 0).toFixed(2)) + ' \t'); // decimal.ToString("0.00")
      w(B.tab(B.str(item.Balance === null ? 0 : item.Balance)) + ' \t');
      rownumber += 1;
    },
  });
  return { sent, ViewBag };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, int? page, string btnexel, string fromDate, string toDate, string CrDrType, string TrType, string username, int? ddlcustpage)
// auth (reads Session["Admin_User"])
// route-config: "AdminPanel/Commission-Statement" -> Commission_Statement/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Commission-Statement'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.ip(req, 'dynamicpagging');
  let orderbydate = B.sp(req, 'orderbydate');
  let page = B.ip(req, 'page');
  let btnexel = B.sp(req, 'btnexel');
  let fromDate = B.sp(req, 'fromDate');
  let toDate = B.sp(req, 'toDate');
  let CrDrType = B.sp(req, 'CrDrType');
  let TrType = B.sp(req, 'TrType');
  let username = B.sp(req, 'username');
  let ddlcustpage = B.ip(req, 'ddlcustpage');
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (btnexel === null) btnexel = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (CrDrType === null) CrDrType = '';
  if (TrType === null) TrType = '0';
  if (TrType === '') TrType = '0';
  if (username === null) username = '';
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  // inline USP_GETEXCELPERMISIONSTATUS / USP_EXCEL_LINK
  const perm = await pagePermissions(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = await excelLink(url);
  let Obj = [];
  let Regno = 0;
  try {
    const MaxRows = dynamicpagging;
    if (page === null) page = 1;
    // select REGNO from MEMBER_MASTER where username='<username>'  (parameterised; FirstOrDefault => 0)
    const r = await db.queryOne(DB, 'select regno from member_master where username = @u limit 1', { u: username });
    Regno = r ? r.regno : 0;
    const rows = await commissionStatement({
      PLID: Regno, FromDate: fromDate, TrType: B.toInt32(TrType), StartRowIndex: page, MaxRows, ToDate: toDate, CrDrType,
      mode: 'COMMISSION Debit BY ADMIN', orderbydate,
    });
    Obj = mapRows(rows, PROPS);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    const TotalRecord = B.toInt32(B.str(B.outVal(rows, 'TotalCount')));
    // PORT-NOTE: Convert.ToInt32(dramount.Value.ToString()) throws FormatException for a decimal string ("12.50") or NULL ("")
    // => the catch below (page-not-found). Kept.
    const TotalDrAmt = B.toInt32(B.str(B.outVal(rows, 'dramount')));
    ViewBag.CurrentPage = page;
    ViewBag.username = username;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TotalDrAmt = TotalDrAmt;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Index');
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect ends the request
  }
  if (btnexel === 'Export Excel') {
    const e = await ExportReport(req, res, Regno, CrDrType, fromDate, toDate);
    if (e.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Commission_Statement/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string CrDrType, string fromDate, string toDate)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const e = await ExportReport(req, res, 0, B.sp(req, 'CrDrType'), B.sp(req, 'fromDate'), B.sp(req, 'toDate'));
  if (!e.sent) res.send('');
}));

module.exports = router;
