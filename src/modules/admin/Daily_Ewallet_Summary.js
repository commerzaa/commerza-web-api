'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Daily_Ewallet_Summary.cs (class Daily_Ewallet_SummaryController => /admin/Daily_Ewallet_Summary/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const { DES_PROPS, scale0 } = require('./_shared/batch05_dailySummary');
const B = require('./_shared/batch05_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Daily_Ewallet_Summary';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** public void ExportReport(string From, string To, int? page, int? ddlcustpage) */
async function ExportReport(req, res, ViewBag, From, To, page, ddlcustpage) {
  void From; void To; void ddlcustpage; // not used by the legacy export query (@FROM/@TO = "", @MaxRowIndex = 1000000)
  const userid = req.user.emp_id;
  const Filename = 'Daily_Ewallet_Summary' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); void MaxRows;
  if (page === null || page === undefined) page = 1;
  // dbo.Usp_Daily_EWALLET_REPORT ... ,@TotalRequested,@TotalPending,@TotalRejected (no OUT keyword: sent as NULL inputs - no effect)
  const AllEPinRequestsList = mapRows(await db.proc(DB, 'Usp_Daily_EWALLET_REPORT', {
    StartRowIndex: page, MaxRowIndex: 1000000, FROM: '', TO: '',
  }), DES_PROPS);
  if (AllEPinRequestsList.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Daily_Ewallet_Summary.xls', Filename,
      headers: ['S.No.', 'Date', 'Requested', 'Pending', 'Rejected', 'Approved', 'Used', 'Available'],
      rows: AllEPinRequestsList, innerProc: 'Usp_Daily_Ewallet_Summary', outerProc: 'USP_ALL_MEMBERLIST',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.cellStr(item, 'Date')) + ' \t');
        for (const k of ['Requested', 'Pending', 'Rejected', 'Credit', 'Debit', 'Balance']) w(B.tab(B.dec2(item[k])) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string orderbydate, string From, string To, int? page, int? ddlcustpage, string btnexel)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Daily-Ewallet-Summary" -> Daily_Ewallet_Summary/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Daily-Ewallet-Summary'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let From = B.nStr(req.p.From);
  let To = B.nStr(req.p.To);
  let page = B.nInt(req.p.page);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  let btnexel = B.nStr(req.p.btnexel);
  sessionStore.set(req, 'DATE', '');
  sessionStore.set(req, 'TYPE', '');
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (From === null) From = '';
  if (To === null) To = '';
  if (btnexel === null) btnexel = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  const MaxRows = Number(dynamicpagging);
  const Empid = req.user.emp_id;
  const ViewBag = {};
  Object.assign(ViewBag, await B.perms(Empid, url));
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'Usp_Daily_EWALLET_REPORT', { StartRowIndex: page, MaxRowIndex: MaxRows, FROM: From, TO: To });
  const AllEPinRequestsList = mapRows(rows, DES_PROPS);
  const r0 = rows[0] || null;
  // PORT-NOTE: OUT params read from the first result row; decimal OUT params had scale 0 (rounded) in SqlClient.
  const tc = B.str(B.col(r0, 'totalcount'));
  const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  const set = (key, col) => { const v = scale0(B.col(r0, col)); if (v !== undefined) ViewBag[key] = v; };
  set('TotalCr', 'totalcredit');
  set('TotalDr', 'totaldebit');
  set('totalBal', 'totalbalance');
  set('TotalRequested', 'totalrequested');
  set('TotalPending', 'totalpending');
  set('TotalRejected', 'totalrejected');
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = ddlcustpage;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, From, To, page, ddlcustpage);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Daily_Ewallet_Summary/Index.cshtml', Model: AllEPinRequestsList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string From, string To, int? page, int? ddlcustpage)
// auth (public method => routable; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.From), B.nStr(req.p.To), B.nInt(req.p.page), B.nInt(req.p.ddlcustpage));
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult usedsummerudetails(string type, string Date)
// auth (admin report; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/usedsummerudetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const type = B.nStr(req.p.type); void type;
  let DateV = B.nStr(req.p.Date);
  let ret = '';
  try {
    DateV = await UtilityClass.Decryptword(DateV);
    const rows = await db.proc(DB, 'Usp_USED_E_EWALLET_REPORT', { DATE: DateV }); // List<TRANSACTION> Obj (unused)
    const r0 = rows[0] || null;
    // Convert.ToDecimal(OUT.Value): DBNull => InvalidCastException; scale-0 decimal OUT params => rounded.
    const dec = (c) => {
      const v = B.col(r0, c);
      if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
      return Math.round(Number(v));
    };
    const SHOPPINGS = dec('shopping');
    const VOUCHERGERNATES = dec('vouchergernate');
    const WITHDRAWALS = dec('withdrawal');
    const PACKAGEPURCHASES = dec('packagepurchase');
    const INTERNALTRANFERS = dec('internaltranfer');
    const DEBITBYADMINS = dec('debitbyadmin');
    ret = 'success|^' + SHOPPINGS + '^' + VOUCHERGERNATES + '^' + WITHDRAWALS + '^' + PACKAGEPURCHASES + '^' + INTERNALTRANFERS + '^' + DEBITBYADMINS;
    return res.json(ret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_TRANSACTION_COUNT');
    ret = String(ExpObj.message);
    return res.json(ret);
  }
}));

module.exports = router;
