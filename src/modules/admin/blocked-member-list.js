'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Blocked_Member_List.cs (class Blocked_Member_ListController => /admin/Blocked_Member_List/...)
// Database: affiliate (Db_Affiliate). Model class blockedMemberList (same file) => BLOCKED_PROPS.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const { str, sp, ip, outVal, ts, tab, nowStamp, exportXls, reqNum } = require('./_shared/batch04-b-common');
const { excelHistory, strTrim, viewPerms } = require('./_shared/batch04-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Blocked_Member_List';

const BLOCKED_PROPS = ['rowNumber', 'regNo', 'LoginId', 'Membername', 'mobile', 'emailid', 'Regdate', 'status', 'userName', 'remark'];

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** usp_Blocked_memberList @StartRowIndex,@MaxRows,@SearchField,@SearchValue,@DOWNLINE,@TOTALCOUNT out,@LEFTRIGHTMEMBER,@orderbydate,@FROMDATE,@TODATE */
async function blockedList(page, MaxRows, SearchField, SearchValue, ddlsearchDownline, LeftRight, orderbydate, fromDate, toDate) {
  const rows = await db.proc(DB, 'usp_Blocked_memberList', {
    StartRowIndex: page, MaxRows, SearchField: strTrim(SearchField), SearchValue: strTrim(SearchValue), DOWNLINE: strTrim(ddlsearchDownline),
    LEFTRIGHTMEMBER: LeftRight, orderbydate, FROMDATE: strTrim(fromDate), TODATE: strTrim(toDate),
  });
  return rows;
}

/**
 * public void ExportReport(string SearchField, string SearchValue, int? page, string ddlsearchDownline, int? LeftRight, string orderbydate, string fromDate, string toDate)
 * Returns true when the download was sent.
 */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, page, ddlsearchDownline, LeftRight, orderbydate, fromDate, toDate) {
  const userid = req.user.emp_id;
  const Filename = `Blocked_Member_List_${userid}_${nowStamp()}`;
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const getblockedMemberList = mapRows(await blockedList(page, MaxRows, SearchField, SearchValue, ddlsearchDownline, LeftRight, orderbydate, fromDate, toDate), BLOCKED_PROPS);
  return exportXls({
    req, res, rows: getblockedMemberList, sheet: 'Blocked_Member_List', procName: 'usp_Blocked_memberList', itemProcName: 'getblockedMemberList', ViewBag,
    headers: ['S.No. \t', 'Username \t', 'Name \t', 'Contact \t', 'Email Id \t', 'Reg. Date \t', 'Remark \t', 'Status \t'],
    row: (item, w) => {
      w(tab(ts(item.rowNumber)) + ' \t');
      w(tab(ts(item.userName)) + ' \t');
      w(tab(ts(item.Membername)) + ' \t');
      w(tab(ts(item.mobile)) + ' \t');
      w(tab(ts(item.emailid)) + ' \t');
      w(tab(ts(item.Regdate)) + ' \t');
      w(tab(ts(item.remark)) + ' \t');
      w(tab(ts(item.status)) + ' \t');
    },
  });
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string SearchField, int? LeftRight, string SearchValue, int? page, string btnexel, string ddlsearchDownline, string fromDate, string toDate)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Blocked-Member-List" -> Blocked_Member_List/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Blocked-Member-List'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = ip(req, 'dynamicpagging');
  let orderbydate = sp(req, 'orderbydate');
  let SearchField = sp(req, 'SearchField');
  let LeftRight = ip(req, 'LeftRight');
  let SearchValue = sp(req, 'SearchValue');
  let page = ip(req, 'page');
  let btnexel = sp(req, 'btnexel');
  let ddlsearchDownline = sp(req, 'ddlsearchDownline');
  let fromDate = sp(req, 'fromDate');
  let toDate = sp(req, 'toDate');

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (orderbydate === null) orderbydate = '';
  if (SearchField === null) SearchField = '';
  if (ddlsearchDownline === null) ddlsearchDownline = '';
  if (SearchValue === null) SearchValue = '';
  if (btnexel === null) btnexel = '';
  if (LeftRight === null) LeftRight = 0;

  // CheckPermissions BAL, then USP_EXCEL_LINK (CommandTimeout 1000), then USP_GETEXCELPERMISIONSTATUS (legacy order)
  const ViewBag = await viewPerms(req, url, ['bal', 'link', 'perm']);
  try {
    let Isbinaryactive = 0;
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await blockedList(page, MaxRows, SearchField, SearchValue, ddlsearchDownline, LeftRight, orderbydate, fromDate, toDate);
    const getblockedMemberList = mapRows(rows, BLOCKED_PROPS);
    const tc = str(outVal(rows, 'TOTALCOUNT'));
    const TotalRecord = tc === '' ? 0 : parseInt(tc, 10);
    // select ACTIVE from TBL_SYSTEMTYPE where SYSTEMNAME='Binary'  (FirstOrDefault => 0 when none)
    const a = await db.scalar(DB, "select active from tbl_systemtype where systemname = 'Binary' limit 1", {});
    Isbinaryactive = a === null || a === undefined ? 0 : Number(a);
    ViewBag.Isbinaryactive = Isbinaryactive;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.ddlsearchDownline = ddlsearchDownline;
    ViewBag.LeftRight = LeftRight;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    if (btnexel === 'Export Excel') {
      if (await ExportReport(req, res, ViewBag, SearchField, SearchValue, page, ddlsearchDownline, LeftRight, orderbydate, fromDate, toDate)) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Blocked_Member_List/Index.cshtml', Model: getblockedMemberList, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'usp_Blocked_memberList');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const sent = await ExportReport(req, res, ViewBag, sp(req, 'SearchField'), sp(req, 'SearchValue'), ip(req, 'page'), sp(req, 'ddlsearchDownline'),
    ip(req, 'LeftRight'), sp(req, 'orderbydate'), sp(req, 'fromDate'), sp(req, 'toDate'));
  if (!sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult UpdateStatus(int regno)
// auth (Emp_Code is read before the null check => NullReferenceException without a session; the
// "This Page has been expired" branch was unreachable)
router.all(`/admin/${C}/UpdateStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const regno = reqNum(req, 'regno');
  const empcode = req.user.emp_code; // eslint-disable-line no-unused-vars
  let Row = 0;
  // [Usp_Update_Member_Status] @MODE='Activate', @regno, @INTRESULT out
  const rows = await db.proc(DB, 'Usp_Update_Member_Status', { MODE: 'Activate', regno });
  const Result = str(outVal(rows, 'INTRESULT'));
  if (Result === '1') Row = 1;
  res.json(String(Row));
}));

module.exports = router;
