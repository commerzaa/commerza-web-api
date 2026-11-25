'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Binary_LockingController.cs
// (namespace Common.Controllers.AdminPanel, class Binary_LockingController => /Binary_Locking/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const CheckPermissions = require('../../lib/admin/CheckPermissions');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const { DB, col, str, sv, nint, toInt32, toDecimal, toStr, nullRef, tab, nowStamp, tsvExport } = require('./_shared/batch03-common');

const router = express.Router();
const C = 'Binary_Locking';

/** class Income_Locking */
const PROPS = ['ROWNUMBER', 'NAME', 'USERNAME', 'MOBILE', 'PAYDATE', 'TotalBinary', 'ReleasedBinary', 'LockBinary', 'LastReleaseDate'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (module state).
let url = '';
let url1 = '';

const fix2 = (v) => { if (v === null || v === undefined) nullRef(); return Number(v).toFixed(2); };
const parseIntOut = (v) => toInt32(str(v) || 'x'); // int.Parse(Output.Value.ToString()) (DBNull => FormatException)
const parseDecOut = (v) => toDecimal(str(v) || 'x');

/** public void ExportReport(string ddldate, string fromDate, string toDate, string SearchValue, string Searchfield) */
async function ExportReport(req, res, ViewBag, ddldate, fromDate, toDate, SearchValue, Searchfield) {
  const userid = req.user.emp_id;
  const Filename = `Binary_Loking_${userid}_${nowStamp()}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
  const rows = await db.proc(DB, 'USP_BINARY_LOCKING', {
    REGNO: '', DATEFILTER: ddldate, FROMDATE: fromDate, TODATE: toDate, SEARCHFIELD: Searchfield, SEARCHVALUE: SearchValue, STARTROWINDEX: 1, MAXROWS: 999999,
  });
  const Obj = mapRows(rows, PROPS);
  parseIntOut(col(rows[0], 'totalcount')); // int TotalRecord = int.Parse(TotalCount.Value.ToString()) (unused, may throw)
  if (Obj.length > 0) {
    return tsvExport({
      req, res, ViewBag, sheet: 'Binary_Loking.xls', filename: Filename, rows: Obj, innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      headers: ['S.No. \t', 'Name \t', 'Mobile \t', 'Paydate \t', 'Total Binary \t', 'Released Binary \t', 'Lock Binary \t', 'Last Release Date \t'],
      cells: (item, w) => {
        for (const k of ['ROWNUMBER', 'NAME', 'USERNAME', 'MOBILE', 'PAYDATE']) w(tab(toStr(item[k])) + ' \t');
        for (const k of ['TotalBinary', 'ReleasedBinary', 'LockBinary']) w(tab(fix2(item[k])) + ' \t');
        w(tab(toStr(item.LastReleaseDate)) + ' \t');
      },
    });
  }
  return false;
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string fromDate, string btnexel, string toDate, string Searchfield, string SearchValue, string ddldate, int? page, int? ddlcustpage)
// auth (reads Session["Admin_User"])
// route-config: "AdminPanel/lock-binary" -> Binary_locking/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/lock-binary'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = sv(req.p.orderbydate);
  let fromDate = sv(req.p.fromDate);
  let btnexel = sv(req.p.btnexel);
  let toDate = sv(req.p.toDate);
  let Searchfield = sv(req.p.Searchfield);
  let SearchValue = sv(req.p.SearchValue);
  let ddldate = sv(req.p.ddldate);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (Searchfield === null) Searchfield = '';
  if (SearchValue === null) SearchValue = '';
  if (ddldate === null) ddldate = '';
  if (ddlcustpage === null) ddlcustpage = 10;
  if (btnexel === null) btnexel = '';
  const Empid = req.user.emp_id;
  const perm = await CheckPermissions.GetPageActionPermission(url, Empid);
  ViewBag.isactive = perm._opIsDownloadAllowed;
  ViewBag.isedit = perm._opIsEditAllowed;
  ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_BINARY_LOCKING', {
    REGNO: '', DATEFILTER: ddldate, FROMDATE: fromDate, TODATE: toDate, SEARCHFIELD: Searchfield, SEARCHVALUE: SearchValue, STARTROWINDEX: page, MAXROWS: MaxRows,
  });
  const Obj = mapRows(rows, PROPS);
  const r0 = rows[0];
  const TotalRecord = parseIntOut(col(r0, 'totalcount'));
  const TotalBinarys = parseDecOut(col(r0, 'totalbinary'));
  const TOTALReleasedBinarys = parseDecOut(col(r0, 'totalreleasedbinary'));
  const TOTALLockBinarys = parseDecOut(col(r0, 'totallockbinary'));
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.TotalBinarys = TotalBinarys;
  ViewBag.TOTALReleasedBinarys = TOTALReleasedBinarys;
  ViewBag.TOTALLockBinarys = TOTALLockBinarys;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = Searchfield;
  ViewBag.SearchValue = SearchValue;
  ViewBag.ddldate = ddldate;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.ddlcustpage = ddlcustpage;
  if (btnexel === 'Export Excel') {
    if (await ExportReport(req, res, ViewBag, ddldate, fromDate, toDate, SearchValue, Searchfield)) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Binary_Locking/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string ddldate, string fromDate, string toDate, string SearchValue, string Searchfield)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, sv(req.p.ddldate), sv(req.p.fromDate), sv(req.p.toDate), sv(req.p.SearchValue), sv(req.p.Searchfield));
  if (!sent) res.send('');
}));

module.exports = router;
