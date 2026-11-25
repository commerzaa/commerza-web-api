'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Excel_Downloaded_HistoryController.cs
// (class Excel_Downloaded_HistoryController => /admin/Excel_Downloaded_History/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const CheckPermissions = require('../../lib/admin/CheckPermissions');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const { pagePermissions, excelLink } = require('./_shared/login-log-common');
const B = require('./_shared/batch07-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Excel_Downloaded_History';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** class ExcelDownloadedHistory */
const PROPS = ['ROWNUMBER', 'LOGINID', 'NAME', 'EMAIL', 'MOBILE', 'TITLE', 'DATE', 'FILENAME', 'MENUID'];

/** Convert.ToInt16(AppSettings["DynamicPagging"]) (null => 0) */
function toInt16(v) {
  if (v === undefined || v === null) return 0;
  return B.cvtInt(v);
}

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate) {
  const userid = req.user.emp_id;
  const Filename = 'Excel_Downloaded_History_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  if (SearchField === null || SearchValue === null) throw B.nullRef(); // SearchField.Trim() on null
  // [USP_EXCEL_DOWNLOADED_HISTORY] without @orderbydate (legacy passed 7 parameters here)
  const excelhistory = mapRows(await db.proc(DB, 'USP_EXCEL_DOWNLOADED_HISTORY', {
    STARTROWINDEX: 1, MAXROWS: 9999999, SEARCHFIELD: String(SearchField).trim(), SEARCHVALUE: String(SearchValue).trim(),
    FROMDATE: fromdate, TODATE: todate,
  }), PROPS);
  if (excelhistory.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Excel_Downloaded_History.xls', Filename,
      headers: ['S.No.', 'Name', 'Login ID', 'Email', 'Mobile', 'Downloaded From', 'Download Date'],
      rows: excelhistory,
      innerProc: 'getblockedMemberList',
      outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.cellStr(item, 'NAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'LOGINID')) + ' \t');
        w(B.tab(B.cellStr(item, 'EMAIL')) + ' \t');
        w(B.tab(B.cellStr(item, 'MOBILE')) + ' \t');
        w(B.tab(B.cellStr(item, 'TITLE')) + ' \t');
        w(B.tab(B.cellStr(item, 'DATE')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string btnexel, string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (reads Session["Admin_User"]; the later null check => RedirectToAction("Index","Excel_Downloaded_Historyin") was unreachable)
// route-config: "AdminPanel/Excel-Downloaded-History" -> Excel_Downloaded_History/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Excel-Downloaded-History'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let btnexel = B.nStr(req.p.btnexel);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromdate = B.nStr(req.p.fromdate);
  let todate = B.nStr(req.p.todate);
  let page = B.nInt(req.p.page);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  if (dynamicpagging === null) dynamicpagging = toInt16(config.app.DynamicPagging);
  if (orderbydate === null) orderbydate = '';
  const Empid = req.user.emp_id;
  const perm = await CheckPermissions.GetPageActionPermission(url, Empid);
  ViewBag.isactive = perm._opIsDownloadAllowed;
  ViewBag.isedit = perm._opIsEditAllowed;
  ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
  // inline USP_GETEXCELPERMISIONSTATUS overwrites isactive / isedit
  const p2 = await pagePermissions(Employeeid, url);
  ViewBag.isactive = p2.isactive;
  ViewBag.isedit = p2.isedit;
  // inline USP_EXCEL_LINK overwrites excelactive
  ViewBag.excelactive = await excelLink(url);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (btnexel === null) btnexel = '';
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_EXCEL_DOWNLOADED_HISTORY', {
      STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
      FROMDATE: fromdate, TODATE: todate, orderbydate,
    });
    const excelhistory = mapRows(rows, PROPS);
    // @TOTALCOUNT OUT => result column "totalcount" ("" => 0)
    const tc = B.str(B.col(rows[0], 'totalcount'));
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.orderbydate = orderbydate;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Excel_Downloaded_History/Index.cshtml', Model: excelhistory, ...ViewBag });
  } catch (ExpObj) {
    return B.errorView(req, res, ExpObj, 'USP_EXCEL_DOWNLOADED_HISTORY');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue), B.nStr(req.p.fromdate), B.nStr(req.p.todate));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
