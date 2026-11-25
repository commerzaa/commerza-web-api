'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\CommissionStatementController.cs
// (class Common.Controllers.AdminPanel.CommissionStatementController => /CommissionStatement/...). Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const { pagePermissions, excelLink } = require('./_shared/loginLogCommon');
const B = require('./_shared/batch04B_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'CommissionStatement';

/** class Comm_Statement */
const PROPS = ['RowNumber', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance', 'USERNAME', 'Name', 'Particular'];

// PORT-NOTE: `private static string url, url1` kept as module variables.
let url = '';
let url1 = '';

/**
 * [USP_COMMISSIONTRANSACTIONHISTORY] @PLID,@SEARCHFIELD,@SEARCHVALUE,@FromDate,@ToDate,@StartRowIndex,@MaxRows,@StrResult OUT,@TotalCount OUT,
 *   @CrDrType,@TrType,@cramount out,@dramount out,@avalibalefund out,@GrossCoinWallet,@UsedCoinWallet,@GrossCommissionWallet,
 *   @UsedCommissionWallet,@AvailableCommissionWallet,@orderbydate,@Particular
 * PORT-NOTE: @GrossCoinWallet..@AvailableCommissionWallet are OUT parameters of the proc that legacy fed "0" as inputs (values never read);
 * PostgreSQL OUT parameters cannot be passed, so they are omitted.
 */
async function history(PLID, SearchField, SearchValue, fromDate, toDate, page, MaxRows, CrDrType, orderbydate, Particular) {
  if (SearchField === null || SearchValue === null || Particular === null) throw B.NRE(); // .Trim() on null
  return db.proc(DB, 'USP_COMMISSIONTRANSACTIONHISTORY', {
    PLID, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FromDate: fromDate, TrType: 6, StartRowIndex: page,
    MaxRows, ToDate: toDate, CrDrType, orderbydate, Particular: Particular.trim(),
  });
}

/** public void ExportReport(string fromDate, int? page, string orderbydate, string toDate, string CrDrType, string TrType, string username, string Particular, string SearchField, string SearchValue) */
async function ExportReport(req, res, fromDate, page, orderbydate, toDate, CrDrType, TrType, username, Particular, SearchField, SearchValue) {
  const ViewBag = {};
  const userid = req.user.emp_id;
  const Filename = `Working_statement_${userid}_${B.nowStamp()}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
  if (page === null) page = 1;
  if (orderbydate === null) orderbydate = '';
  // Int64 Regno = SqlQuery("select REGNO from MEMBER_MASTER where username='<username>'") - computed, but @PLID is passed as 0 (legacy)
  await db.queryOne(DB, 'select regno from member_master where username = @u limit 1', { u: B.str(username) });
  const Obj = mapRows(await history(0, SearchField, SearchValue, fromDate, toDate, page, 1000000000, CrDrType, orderbydate, Particular), PROPS);
  const sent = await B.exportXls({
    req, res, rows: Obj, sheet: 'Working_statement', procName: '', itemProcName: 'Working_statement', noCatch: true, ViewBag,
    headers: ['S.No. \t', 'Date \t', 'Username \t', 'Name \t', 'Type \t', 'Amount \t', 'Balance \t', 'Particulars \t'],
    row: (item, w) => {
      w(B.tab(B.ts(item.RowNumber)) + ' \t');
      w(B.tab(B.ts(item.ProcessDate)) + ' \t');
      w(B.tab(B.ts(item.USERNAME)) + ' \t');
      w(B.tab(B.ts(item.Name)) + ' \t');
      if (Number(item.Dr_Amount || 0) > 0) w('Dr. \t');
      else if (Number(item.Cr_Amount || 0) > 0) w('Cr. \t');
      w(B.tab(B.str(item.Dr_Amount === null ? 0 : item.Dr_Amount)) + ' \t');
      w(B.tab(Number(item.Balance || 0).toFixed(2)) + ' \t'); // decimal.ToString("0.00")
      w(B.tab(B.ts(item.Particular)) + ' \t');
    },
  });
  return { sent, ViewBag };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string btnexel, int? page, string fromDate, string toDate, string CrDrType, string TrType, string username, int? ddlcustpage, string myquery1, string myquery, string Particular, string SearchField, string SearchValue)
// auth (reads Session["Admin_User"])
// route-config: "AdminPanel/Working-Statement" -> CommissionStatement/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Working-Statement'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.ip(req, 'dynamicpagging');
  let orderbydate = B.sp(req, 'orderbydate');
  let btnexel = B.sp(req, 'btnexel');
  let page = B.ip(req, 'page');
  let fromDate = B.sp(req, 'fromDate');
  let toDate = B.sp(req, 'toDate');
  let CrDrType = B.sp(req, 'CrDrType');
  let TrType = B.sp(req, 'TrType');
  let username = B.sp(req, 'username');
  let ddlcustpage = B.ip(req, 'ddlcustpage');
  const myquery1 = B.sp(req, 'myquery1');
  const myquery = B.sp(req, 'myquery');
  let Particular = B.sp(req, 'Particular');
  let SearchField = B.sp(req, 'SearchField');
  let SearchValue = B.sp(req, 'SearchValue');
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  if (ddlcustpage === null) ddlcustpage = 100;
  if (Particular === null) Particular = '';
  ViewBag.back = 0;
  if (myquery !== null && myquery !== '') {
    CrDrType = await UtilityClass.Decryptword(myquery);
    ViewBag.back = 1;
  }
  if (myquery1 !== null && myquery1 !== '') {
    fromDate = await UtilityClass.Decryptword(myquery1);
    ViewBag.back = 1;
  }
  if (fromDate === null) fromDate = '';
  if (btnexel === null) btnexel = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (toDate === null) toDate = '';
  if (CrDrType === null) CrDrType = '';
  if (TrType === null) TrType = '0';
  if (TrType === '') TrType = '0';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (username === null) username = '';
  ViewBag.excelactive = await excelLink(url); // inline USP_EXCEL_LINK
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const perm = await pagePermissions(Employeeid, url); // inline USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  // (the legacy repeated the null defaults here - no effect)
  let Obj = [];
  try {
    const MaxRows = dynamicpagging;
    if (page === null) page = 1;
    let Regno = 0;
    if (username !== '' && username !== null) {
      const r = await db.queryOne(DB, 'select regno from member_master where username = @u limit 1', { u: username });
      Regno = r ? r.regno : 0;
    } else {
      Regno = 0;
    }
    const rows = await history(Number(Regno), SearchField, SearchValue, fromDate, toDate, page, MaxRows, CrDrType, orderbydate, Particular);
    Obj = mapRows(rows, PROPS);
    ViewBag.fromDate = fromDate;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.toDate = toDate;
    ViewBag.username = username;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    const TotalRecord = B.toInt32(B.str(B.outVal(rows, 'TotalCount')));
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_TransactionHistory');
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect ends the request
  }
  if (btnexel === 'Export Excel') {
    const e = await ExportReport(req, res, fromDate, page, orderbydate, toDate, CrDrType, TrType, username, Particular, SearchField, SearchValue);
    if (e.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/CommissionStatement/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const e = await ExportReport(req, res, B.sp(req, 'fromDate'), B.ip(req, 'page'), B.sp(req, 'orderbydate'), B.sp(req, 'toDate'),
    B.sp(req, 'CrDrType'), B.sp(req, 'TrType'), B.sp(req, 'username'), B.sp(req, 'Particular'), B.sp(req, 'SearchField'), B.sp(req, 'SearchValue'));
  if (!e.sent) res.send('');
}));

module.exports = router;
