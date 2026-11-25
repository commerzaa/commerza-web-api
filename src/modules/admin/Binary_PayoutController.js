'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Binary_PayoutController.cs
// (namespace Common.Controllers.AdminPanel, class Binary_PayoutController => /Binary_Payout/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const CheckPermissions = require('../../lib/admin/CheckPermissions');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const { DB, col, str, sv, nint, toInt32, toDecimal, toStr, nullRef, tab, netFormat, nowStamp, tsvExport } = require('./_shared/batch03_common');

const router = express.Router();
const C = 'Binary_Payout';

/** class BinaryPayout */
const PROPS = ['ROWNUMBER', 'MPID', 'LOGINID', 'PAYFROM', 'PAYTO', 'BINARYINCOME', 'GROUPBONUS', 'ACTIVE', 'PAYID', 'USERNAME', 'NAME', 'OLBV',
  'ORBV', 'CRBV', 'CLBV', 'TLBV', 'TRBV', 'MATCHBV', 'PAIDBV', 'FLUSHBV', 'CFLBV', 'CFRBV', 'Mobile', 'EmailID', 'PAYDATE', 'TDS', 'ADMINCHARGE',
  'Earned', 'Net', 'Repurchase'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (module state).
let url = '';
let url1 = '';

const fix2 = (v) => { if (v === null || v === undefined) nullRef(); return Number(v).toFixed(2); };
const parseIntOut = (v) => toInt32(str(v) || 'x'); // int.Parse(Output.Value.ToString()) (DBNull => FormatException)
const parseDecOut = (v) => toDecimal(str(v) || 'x');
function toDateTime(s) {
  if (s === null || s === undefined) return new Date(1, 0, 1);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error('String was not recognized as a valid DateTime.');
  return d;
}

/** public void ExportReport(int? payid, string SearchField, string SearchValue, string fromDate, string toDate, int? page) */
async function ExportReport(req, res, ViewBag, payid, SearchField, SearchValue, fromDate, toDate, page) {
  const userid = req.user.emp_id;
  const Filename = `Binary_Payout_${userid}_${nowStamp()}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
  // eslint-disable-next-line no-unused-vars
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  // dbo.UspGetMemberPayoutReport (12 params here: no @TOTALADMINCHARGE/@TOTALTDS; @SearchField/@SearchValue passed as "")
  const MemberPayReport = mapRows(await db.proc(DB, 'UspGetMemberPayoutReport', {
    StartRowIndex: page, MaxRows: '100000', PayID: payid, REGNO: 0, SearchField: '', SearchValue: '', fromDate, ToDate: toDate, LoginId: '', Mode: 0,
  }), PROPS);
  if (MemberPayReport.length > 0) {
    return tsvExport({
      req, res, ViewBag, sheet: 'Binary_Payout.xls', filename: Filename, rows: MemberPayReport, innerProc: 'MemberPayReport', outerProc: 'UspGetMemberPayoutReport',
      headers: ['S.No. \t', 'Payout Date \t', 'Username \t', 'TLBV \t', 'TRBV \t', 'CLBV \t', 'CRBV \t', 'Match BV \t', 'Binary Income \t', 'Tds\t', 'Admin Charge\t'],
      cells: (item, w) => {
        w(tab(toStr(item.ROWNUMBER)) + ' \t');
        w(tab(netFormat(item.PAYDATE, 'dd-MM-yyyy')) + ' \t');
        w(tab(toStr(item.USERNAME)) + ' \t');
        for (const k of ['TLBV', 'TRBV', 'CLBV', 'CRBV', 'MATCHBV', 'BINARYINCOME', 'TDS', 'ADMINCHARGE']) w(tab(fix2(item[k])) + ' \t');
      },
    });
  }
  return false;
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string myquery, string myquery1, int? payid, string SearchField, string SearchValue, string fromDate, string toDate, int? page, int? ddlcustpage, string btnexel, string Date)
// auth (Session null => RedirectToAction("Index","Home"))
// route-config: "AdminPanel/binary-payout" -> Binary_Payout/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/binary-payout'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = sv(req.p.orderbydate);
  const myquery = sv(req.p.myquery);
  const myquery1 = sv(req.p.myquery1);
  let payid = nint(req.p.payid);
  let SearchField = sv(req.p.SearchField);
  let SearchValue = sv(req.p.SearchValue);
  let fromDate = sv(req.p.fromDate);
  let toDate = sv(req.p.toDate);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  let btnexel = sv(req.p.btnexel);
  const Date_ = sv(req.p.Date);
  const ViewBag = {};
  if (myquery !== null) {
    ViewBag.date = netFormat(toDateTime(await UtilityClass.Decryptword(myquery)), 'yyyy-MM-dd');
    fromDate = String(ViewBag.date);
    toDate = String(ViewBag.date);
    ViewBag.PayID = await UtilityClass.Decryptword(myquery1);
    payid = toInt32(ViewBag.PayID); // Convert.ToInt32(string)
  }
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  // binaryUrl = Request.Url.ToString(); split('?') => text after the first '?' decrypted as a user name
  // PORT-NOTE: raw (URL-encoded) query text is used; legacy Uri.ToString() unescaped it. Any plain query string goes to Decryptword like legacy.
  const binaryrequesturl = req.originalUrl.split('?');
  let username = '';
  if (binaryrequesturl.length >= 2) {
    username = await UtilityClass.Decryptword(binaryrequesturl[1]);
    if (username !== '') {
      SearchField = 'USERNAME';
      SearchValue = username;
    }
  }
  if (Date_ !== null) fromDate = await UtilityClass.Decryptword(Date_);
  if (payid === null) payid = 0;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (toDate === null) toDate = '';
  if (fromDate === null) fromDate = '';
  if (btnexel === null) btnexel = '';
  const Empid = req.user.emp_id;
  const perm = await CheckPermissions.GetPageActionPermission(url, Empid);
  ViewBag.isactive = perm._opIsDownloadAllowed;
  ViewBag.isedit = perm._opIsEditAllowed;
  ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'UspGetMemberPayoutReport', {
    StartRowIndex: page, MaxRows, PayID: payid, REGNO: 0, SearchField, SearchValue, fromDate, ToDate: toDate, LoginId: '', Mode: 0,
  });
  const MemberPayReport = mapRows(rows, PROPS);
  const r0 = rows[0];
  const TotalRecord = parseIntOut(col(r0, 'totalcount'));
  const TOTALBINARYINCOMEs = parseDecOut(col(r0, 'totalbinaryincome'));
  const TOTALAdminCharge = parseDecOut(col(r0, 'totaladmincharge'));
  const TOTALTDSCharge = parseDecOut(col(r0, 'totaltds'));
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.TOTALBINARYINCOME = TOTALBINARYINCOMEs;
  ViewBag.TOTALAdminCharge = TOTALAdminCharge;
  ViewBag.TOTALTDSCharge = TOTALTDSCharge;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.payid = payid;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  if (btnexel === 'Export Excel') {
    if (await ExportReport(req, res, ViewBag, payid, SearchField, SearchValue, fromDate, toDate, page)) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Binary_Payout/Index.cshtml', Model: MemberPayReport, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(int? payid, string SearchField, string SearchValue, string fromDate, string toDate, int? page)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, nint(req.p.payid), sv(req.p.SearchField), sv(req.p.SearchValue), sv(req.p.fromDate),
    sv(req.p.toDate), nint(req.p.page));
  if (!sent) res.send('');
}));

module.exports = router;
