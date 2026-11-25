'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ROI_Status.cs
// (class ROI_StatusController => /admin/ROI_Status/...). Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nint, nstr, view, inlinePerms, excelLink, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows, outParseInt, nre,
} = require('./_shared/batch13-04-common');

const router = express.Router();
const C = 'ROI_Status';

/** class ROISatus */
const ROI_PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'PACKAGENAME', 'INVESTAMOUNT', 'INVESTDATE', 'RETURNAMT', 'ROIDAYS', 'PAIDDAYS', 'CURRENTAMOUNT'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

const trimS = (v) => { if (v === null || v === undefined) throw nre(); return String(v).trim(); };

// public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate)
async function ExportReport(req, res, SearchField, SearchValue, fromdate, todate, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Roi_Status_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  const MaxRows = await UtilityClass.GridPageSize(); // (unused, like legacy)
  void MaxRows;
  // (no @orderbydate => proc default)
  const rows = await db.proc(DB, 'USP_ROISTATUS_DETAILS', {
    StartRowIndex: 1, MaxRows: 99999999, SearchField: trimS(SearchField), SearchValue: trimS(SearchValue), fromDate: trimS(fromdate),
    ToDate: trimS(todate),
  });
  const ROISatus = mapRows(rows, ROI_PROPS);
  if (ROISatus.length > 0) {
    return tsvDownload({
      req, res, ViewBag, xlsName: 'Roi_Status.xls', Filename,
      // (8 headers, 9 cells per row: kept as in legacy)
      headers: ['S.No.', 'Username', 'Name', 'Package Name', 'PH', 'Joining Date', 'Assign Date', 'Status'],
      rows: ROISatus,
      innerProc: 'getblockedMemberList',
      outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w(tab(cs(item.ROWNUMBER)) + ' \t');
        w(tab(cs(item.USERNAME)) + ' \t');
        w(tab(cs(item.NAME)) + ' \t');
        w(tab(cs(item.PACKAGENAME)) + ' \t');
        w(tab(cs(item.INVESTAMOUNT)) + ' \t');
        w(tab(cs(item.INVESTDATE)) + ' \t');
        w(tab(cs(item.ROIDAYS)) + ' \t');
        w(tab(cs(item.PAIDDAYS)) + ' \t');
        w(tab(cs(item.CURRENTAMOUNT)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string SearchField, string btnexel, string SearchValue, string fromdate, string todate, string Username, int? page, int? ddlcustpage)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/roi-status" -> ROI_Status/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/roi-status'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = nstr(req.p.orderbydate);
  let SearchField = nstr(req.p.SearchField);
  let btnexel = nstr(req.p.btnexel);
  let SearchValue = nstr(req.p.SearchValue);
  let fromdate = nstr(req.p.fromdate);
  let todate = nstr(req.p.todate);
  const Username = nstr(req.p.Username); // (unused, like legacy)
  void Username;
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  const ViewBag = {};
  // (no try/catch in legacy: errors are unhandled => 500)
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (btnexel === null) btnexel = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK @url,@ISACTIVE out
  if (SearchField === '0') ViewBag.lable = '0';
  if (SearchField === '1') ViewBag.lable = '1';
  const Employeeid = req.user.emp_id;
  const p = await inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_ROISTATUS_DETAILS', {
    StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(), fromDate: fromdate.trim(),
    ToDate: todate.trim(), orderbydate,
  });
  const ROISatus = mapRows(rows, ROI_PROPS);
  const TotalRecord = outParseInt(rows, 'TotalCount');
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows; ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.ddlcustpage = ddlcustpage;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, SearchField, SearchValue, fromdate, todate, ViewBag);
    if (r.sent) return undefined;
  }
  return view(res, '~/Views/AdminPanel/ROI_Status/Index.cshtml', ROISatus, ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nstr(req.p.SearchField), nstr(req.p.SearchValue), nstr(req.p.fromdate), nstr(req.p.todate), {});
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
