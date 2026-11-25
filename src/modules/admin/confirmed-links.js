'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Confirmed_Links.cs (class Confirmed_LinksController => /admin/Confirmed_Links/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const { pagePermissions, excelLink } = require('./_shared/login-log-common');
const B = require('./_shared/batch05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Confirmed_Links';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** class ProcessLinkList (Controllers/AdminPanel/Process_Links.cs) */
const LINK_PROPS = ['RowNumber', 'HRID', 'Amount', 'Create_Date', 'Expire_Date', 'FromLoginId', 'FromEmailId', 'FromName', 'FromMobile',
  'InvestID', 'GiveID', 'Help_Date', 'GH_Status', 'RegDate', 'FromRegNo', 'ToRegNo', 'ToLoginID', 'ToEmailId', 'ToName', 'ToMobile',
  'BlockChainAddress', 'BtcAmount', 'HRStatus', 'orderID', 'PaySlip', 'Remark', 'hashcode'];

/** public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate) {
  const userid = req.user.emp_id;
  const Filename = 'Text_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const objConfirmLinkList = mapRows(await db.proc(DB, 'usp_confirmLinkList', {
    StartRowIndex: 1, MaxRows: 9999999, SearchField, SearchValue, fromDate, ToDate: toDate,
  }), LINK_PROPS);
  if (objConfirmLinkList.length > 0) {
    let RowNumber = 1;
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Confirmed_Links.xls', Filename,
      headers: ['S.No.', 'Order ID', 'BTC Address', 'Hash Code', 'Date'],
      rows: objConfirmLinkList, innerProc: 'AllEPinRequestsList', outerProc: 'USP_ALL_MEMBERLIST',
      cells: (item, w) => {
        w('\n');
        w(B.tab(String(RowNumber)) + ' \t');
        w(B.tab(B.cellStr(item, 'orderID')) + ' \t');
        w(B.tab(B.cellStr(item, 'BlockChainAddress')) + ' \t');
        w(B.tab(B.cellStr(item, 'hashcode')) + ' \t');
        w(B.tab(B.cellStr(item, 'Create_Date')) + ' \t');
        RowNumber += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string btnexel, string SearchField, string SearchValue, string fromDate, string toDate, int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Confirmed-Links" -> Confirmed_Links/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Confirmed-Links'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let btnexel = B.nStr(req.p.btnexel);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let page = B.nInt(req.p.page);
  const ViewBag = {};
  if (btnexel === null) btnexel = '';
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging;
    dynamicpagging = value === undefined || value === null || value === '' ? 0 : parseInt(value, 10);
  }
  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
  const perm = await pagePermissions(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  // USP_EXCEL_LINK @url,@ISACTIVE out
  ViewBag.excelactive = await excelLink(url);
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (page === null) page = 1;
  const MaxRows = Number(dynamicpagging);
  const rows = await db.proc(DB, 'usp_confirmLinkList', {
    StartRowIndex: page, MaxRows, SearchField, SearchValue, fromDate, ToDate: toDate,
  });
  const objConfirmLinkList = mapRows(rows, LINK_PROPS);
  // PORT-NOTE: @TotalCount OUT read from the result row column "totalcount" (no row => 0).
  const TotalRecord = rows.length ? B.outInt(rows[0], 'totalcount') : 0;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.SearchField = SearchField; ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.SearchValue = SearchValue;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Confirmed_Links/Index.cshtml', Model: objConfirmLinkList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue), B.nStr(req.p.fromDate), B.nStr(req.p.toDate));
  if (!r.sent) res.send('');
}));

module.exports = router;
