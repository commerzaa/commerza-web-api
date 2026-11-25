'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MemberTaskReport.cs (class MemberTaskReportController => /MemberTaskReport/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, reqInt, cvtInt, col, str, excelLink, inlinePerms, excelHistory, nowStamp, writeXlsExport, tab, cellStr, dec2, outIntOf,
} = require('./_shared/batch10-common');
const { addReferalLink, saveLogoImage } = require('./_shared/batch10-b-common');

const router = express.Router();
const C = 'MemberTaskReport';

/** class MemberTaskReport */
const PROPS = ['RowNumber', 'USERNAME', 'MOBILE', 'EMAILID', 'PH', 'Conform', 'Process', 'URL', 'Regno', 'MTID', 'status'];

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

// public void ExportReport(string FromDate, string ToDate, string InvestID)
async function ExportReport(req, res, FromDate, ToDate, InvestID, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Text_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  // DBO.USP_MemberTaskList @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@InvestID  (CommandTimeout 1000)
  const rows = await db.proc(DB, 'USP_MemberTaskList', { fromDate: FromDate, toDate: ToDate, MAXROWS: 9999999, STARTROWINDEX: 1, InvestID });
  const MemberTask = mapRows(rows, PROPS);
  if (MemberTask.length > 0) {
    let RowNumber = 1;
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Text.xls', Filename,
      headers: ['S.No.', 'User Name', 'Mobile', 'Email ID', 'PH', 'Process', 'URl'],
      rows: MemberTask, innerProc: 'AllEPinRequestsList', outerProc: 'USP_ALL_MEMBERLIST',
      cells: (item, w) => {
        w('\n');
        w(tab(String(RowNumber)) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(cellStr(item, 'MOBILE')) + ' \t');
        w(tab(cellStr(item, 'EMAILID')) + ' \t');
        w(tab(dec2(col(item, 'PH'))) + ' \t');
        // PORT-NOTE: legacy writes Conform as an extra column that has no header (kept).
        w(tab(dec2(col(item, 'Conform'))) + ' \t');
        w(tab(dec2(col(item, 'Process'))) + ' \t');
        w(tab(cellStr(item, 'URL')) + ' \t');
        RowNumber += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, int? Page, string FromDate, string ToDate, string InvestID, string SearchValue, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "adminpanel/MemberTaskReport" -> MemberTaskReport/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/adminpanel/MemberTaskReport'], adminAuth, asyncHandler(async (req, res) => {
  let btnexel = nStr(req.p.btnexel); if (btnexel === null) btnexel = '';
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  let dynamicpagging = nInt(req.p.dynamicpagging);
  if (dynamicpagging === null) dynamicpagging = cvtInt(config.app.DynamicPagging); // Convert.ToInt16(AppSettings["DynamicPagging"])
  const ViewBag = {};
  const ip = await inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = ip.isactive;
  ViewBag.isedit = ip.isedit;
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK
  let FromDate = nStr(req.p.FromDate); if (FromDate === null) FromDate = '';
  let ToDate = nStr(req.p.ToDate); if (ToDate === null) ToDate = '';
  let InvestID = nStr(req.p.InvestID); if (InvestID === null) InvestID = '';
  let SearchValue = nStr(req.p.SearchValue); if (SearchValue === null) SearchValue = '';
  let Page = nInt(req.p.Page);
  // (no try/catch in legacy: errors surface as 500)
  const MaxRows = dynamicpagging;
  if (Page === null) Page = 1;
  const rows = await db.proc(DB, 'USP_MemberTaskList', { fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, InvestID });
  const MemberTask = mapRows(rows, PROPS);
  const TotalRecord = outIntOf(rows, 'totalcount');
  Object.assign(ViewBag, {
    CurrentPage: Page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField: '', dynamicpagging,
    SearchValue, fromDate: FromDate, toDate: ToDate,
  });
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, FromDate, ToDate, InvestID, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/MemberTaskReport/Index.cshtml', Model: MemberTask, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string FromDate, string ToDate, string InvestID)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nStr(req.p[k]);
  const r = await ExportReport(req, res, v('FromDate'), v('ToDate'), v('InvestID'), {});
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

// ---------------------------------------------------------------- JsonResult UpdateStatus(int MTID, int mode)
// auth (reads Session["Admin_User"].Emp_ID)
router.all(`/admin/${C}/UpdateStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const MTID = reqInt(req.p.MTID, 'MTID');
  const mode = reqInt(req.p.mode, 'mode');
  // [usp_TaskStatus_update] @MTID,@Mode,@EMP_Id,@strResult out
  const row = await db.procOne(DB, 'usp_TaskStatus_update', { MTID, Mode: mode, EMP_Id: req.user.emp_id });
  res.json(str(col(row, 'strresult')));
}));

module.exports = router;
