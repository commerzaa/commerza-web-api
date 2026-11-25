'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Error_Lock.cs (class Error_LockController, no namespace => /Error_Lock/...)
// Database: affiliate (Db_Affiliate). Procs USP_ERRORLOCK, USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK, USP_EXCEL_DOWNLOAD_HISTORY; table tbl_errorlog.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  nInt, nStr, reqInt, col, str, cvtInt, inlinePerms, nowStamp, excelHistory, writeXlsExport, cellStr, tab, dynPaging, trimNull,
} = require('./_shared/batch06_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Error_Lock';

/** public class ErrorLock */
const ERROR_LOCK_PROPS = ['ROWNUMBER', 'NUMBER', 'DESCRIPTION', 'PROCEDURENAME', 'ERRORSTATE', 'ERRORLINE', 'ERRORTIME', 'STATUS', 'IsReported', 'URL',
  'PANEL', 'ELID'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** public void ExportReport(string fromdate, string todate, string SearchField, string SearchValue) */
async function ExportReport(req, res, fromdate, todate, SearchField, SearchValue, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'ErrorLock_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  // [USP_ERRORLOCK] @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT OUT
  const list = mapRows(await db.proc(DB, 'USP_ERRORLOCK', {
    STARTROWINDEX: 1, MAXROWS: 999999, SEARCHFIELD: trimNull(SearchField), SEARCHVALUE: trimNull(SearchValue), FROMDATE: fromdate, TODATE: todate,
  }), ERROR_LOCK_PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'ErrorLock.xls', Filename, ViewBag, rows: list,
      headers: ['S.No.', 'Error Number', 'Discription', 'Proc/Fun', 'Error Line', 'Error Time', 'Url', 'Panel'],
      innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        for (const k of ['ROWNUMBER', 'NUMBER', 'DESCRIPTION', 'PROCEDURENAME', 'ERRORLINE', 'ERRORTIME', 'URL', 'PANEL']) w(tab(cellStr(item, k)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField, string btnexel,
//   string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (Session["Admin_User"] dereferenced before the null check => adminAuth)
// route-config: "AdminPanel/error-lock" -> Error_Lock/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/error-lock'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let btnexel = nStr(req.p.btnexel);
  let SearchValue = nStr(req.p.SearchValue);
  let fromdate = nStr(req.p.fromdate);
  let todate = nStr(req.p.todate);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  // inline USP_GETEXCELPERMISIONSTATUS first, USP_EXCEL_LINK later (same calls as inlinePerms; order of DB calls kept close enough)
  const perm = await inlinePerms(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  if (dynamicpagging === null) dynamicpagging = dynPaging();
  if (orderbydate === null) orderbydate = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  ViewBag.excelactive = perm.excelactive;
  if (SearchValue === null) SearchValue = '';
  if (SearchValue === 'Yes') SearchValue = '1';
  else if (SearchValue === 'yes') SearchValue = '1';
  if (SearchValue === 'No') SearchValue = '0';
  else if (SearchValue === 'no') SearchValue = '0';
  if (SearchValue === 'Solved') SearchValue = '2';
  else if (SearchValue === 'solved') SearchValue = '2';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    if (btnexel === null) btnexel = '';
    // [USP_ERRORLOCK] @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT OUT,@orderbydate
    const rows = await db.proc(DB, 'USP_ERRORLOCK', {
      STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FROMDATE: fromdate, TODATE: todate,
      orderbydate,
    });
    const ErrorLock = mapRows(rows, ERROR_LOCK_PROPS);
    const tc = str(col(rows[0], 'TOTALCOUNT'));
    const TotalRecord = cvtInt(tc === '' ? '0' : tc);
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
      const x = await ExportReport(req, res, fromdate, todate, SearchField, SearchValue, ViewBag);
      if (x.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Error_Lock/Index.cshtml', Model: ErrorLock, ...ViewBag });
  } catch (ex) {
    if (res.headersSent) return undefined;
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' }); // (no ErrorInsert in this catch)
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string fromdate, string todate, string SearchField, string SearchValue)
// auth (PORT-NOTE: public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.fromdate), nStr(req.p.todate), nStr(req.p.SearchField), nStr(req.p.SearchValue), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult SolvedError(int Elid)
// auth (PORT-NOTE: legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/SolvedError{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Elid = reqInt(req.p.Elid, 'Elid');
  // update TBL_ERRORLOG set IsReported=2 where ELID=<Elid>   (parameterised)
  const Result = await db.exec(DB, 'update tbl_errorlog set isreported = 2 where elid = @Elid', { Elid });
  return res.json(Result);
}));

module.exports = router;
