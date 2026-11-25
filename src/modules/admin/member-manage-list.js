'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MemberManageList.cs (class MemberManageListController => /MemberManageList/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, reqInt, col, str, excelLink, inlinePerms, excelHistory, nowStamp, writeXlsExport, tab, cellStr, outIntOf,
} = require('./_shared/batch10-common');
const { addReferalLink, saveLogoImage } = require('./_shared/batch10-b-common');

const router = express.Router();
const C = 'MemberManageList';

/** class MemberManageList */
const PROPS = ['RowNumber', 'USERNAME', 'MOBILE', 'EMAILID', 'joiningDate', 'AssignDate', 'STATUS', 'PH'];

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests (set by Index, read by ExportReport/ExportReport1).
let url = '';
let url1 = '';

const HEADERS = ['S.No.', 'Username', 'Mobile', 'Email', 'PH', 'Joining Date', 'Assign Date', 'Status'];
function cells(item, w) {
  w('\n');
  w(tab(cellStr(item, 'RowNumber')) + ' \t');
  w(tab(cellStr(item, 'USERNAME')) + ' \t');
  w(tab(cellStr(item, 'MOBILE')) + ' \t');
  w(tab(cellStr(item, 'EMAILID')) + ' \t');
  w(tab(cellStr(item, 'PH')) + ' \t');
  w(tab(cellStr(item, 'joiningDate')) + ' \t');
  w(tab(cellStr(item, 'AssignDate')) + ' \t');
  w(tab(cellStr(item, 'STATUS')) + ' \t');
}

// public void ExportReport(string FromDate, string ToDate, string USERNAME, string SearchValue)
async function ExportReport(req, res, FromDate, ToDate, USERNAME, SearchValue, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Member_ManageList_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  await UtilityClass.GridPageSize(); // int MaxRows = UtilityClass.GridPageSize(); (unused)
  // DBO.USP_MemberManager @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@USERNAME,@SearchValue
  const rows = await db.proc(DB, 'USP_MemberManager', {
    fromDate: FromDate, toDate: ToDate, MAXROWS: 9999999, STARTROWINDEX: 1, USERNAME, SearchValue,
  });
  const MemberTask = mapRows(rows, PROPS);
  if (MemberTask.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'MemberManageList.xls', Filename, headers: HEADERS, rows: MemberTask, cells,
      innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
    });
  }
  return { sent: false };
}

// public void ExportReport1(string FromDate, string ToDate, string USERNAME, string SearchValue)
async function ExportReport1(req, res, FromDate, ToDate, USERNAME, SearchValue, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Bank_Account_List_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await db.proc(DB, 'USP_MemberManager', {
    fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: 1, USERNAME, SearchValue,
  });
  const MemberTask = mapRows(rows, PROPS);
  if (MemberTask.length > 0) {
    // PORT-NOTE: legacy sheet/attachment name "Member_Manage_List" has no extension (kept).
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Member_Manage_List', Filename, headers: HEADERS, rows: MemberTask, cells,
      innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate, string btnexel, string ToDate, string USERNAME, string SearchValue)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/MemberManageList" -> MemberManageList/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/MemberManageList'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
  let orderbydate = nStr(req.p.orderbydate); if (orderbydate === null) orderbydate = '';
  let FromDate = nStr(req.p.FromDate); if (FromDate === null) FromDate = '';
  let btnexel = nStr(req.p.btnexel); if (btnexel === null) btnexel = '';
  let ToDate = nStr(req.p.ToDate); if (ToDate === null) ToDate = '';
  let USERNAME = nStr(req.p.USERNAME); if (USERNAME === null) USERNAME = '';
  let SearchValue = nStr(req.p.SearchValue); if (SearchValue === null) SearchValue = '';
  let Page = nInt(req.p.Page);
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  const ip = await inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = ip.isactive;
  ViewBag.isedit = ip.isedit;
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK
  // (no try/catch in legacy: errors surface as 500)
  const MaxRows = dynamicpagging;
  if (Page === null) Page = 1;
  const rows = await db.proc(DB, 'USP_MemberManager', {
    fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, USERNAME, SearchValue, orderbydate,
  });
  const MemberTask = mapRows(rows, PROPS);
  const TotalRecord = outIntOf(rows, 'totalcount');
  Object.assign(ViewBag, {
    CurrentPage: Page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField: '',
    dynamicpagging, orderbydate, SearchValue, fromDate: FromDate, toDate: ToDate,
  });
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, FromDate, ToDate, USERNAME, SearchValue, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/MemberManageList/Index.cshtml', Model: MemberTask, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nStr(req.p[k]);
  const r = await ExportReport(req, res, v('FromDate'), v('ToDate'), v('USERNAME'), v('SearchValue'), {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- public void ExportReport1(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport1{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nStr(req.p[k]);
  const r = await ExportReport1(req, res, v('FromDate'), v('ToDate'), v('USERNAME'), v('SearchValue'), {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult AddNewReferalLink(string Images, string Url, string fileName)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/AddNewReferalLink{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const loginid = req.user.emp_loginid; // Emp_ID / regNo read but unused in legacy
  const imgname = await saveLogoImage(nStr(req.p.Images), nStr(req.p.fileName), loginid);
  const rows = await addReferalLink({ TITLE: '', IMAGE: imgname, URL: nStr(req.p.Url), MODE: 1, RLID: 0, Active: 0 });
  res.json(str(col(rows[0], 'strresult')));
}));

// ---------------------------------------------------------------- JsonResult UpdatImageReferalLink(string Images, string Url, string fileName, int RLId)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/UpdatImageReferalLink{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const RLId = reqInt(req.p.RLId, 'RLId');
  const loginid = req.user.emp_loginid;
  const imgname = await saveLogoImage(nStr(req.p.Images), nStr(req.p.fileName), loginid);
  const rows = await addReferalLink({ TITLE: '', IMAGE: imgname, URL: nStr(req.p.Url), MODE: 3, RLID: RLId, Active: 0 });
  res.json(str(col(rows[0], 'strresult')));
}));

// ---------------------------------------------------------------- JsonResult UpdateStatus(string UserName, string mode)
// auth (legacy had NO session check; it adds/removes a manager => protected, see report)
router.all(`/admin/${C}/UpdateStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  // [Usp_Add_Manager] @username,@Mode,@strresult out
  const row = await db.procOne(DB, 'Usp_Add_Manager', { username: nStr(req.p.UserName), Mode: nStr(req.p.mode) });
  res.json(str(col(row, 'strresult')));
}));

module.exports = router;
