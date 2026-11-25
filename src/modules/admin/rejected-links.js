'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Rejected_Links.cs (class Rejected_LinksController => /admin/Rejected_Links/...)
// Database: affiliate (Db_Affiliate). Procs: USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK, usp_rejectedLinkList, USP_EXCEL_DOWNLOAD_HISTORY.
// Model: PendingLinksList (Pending_Links.cs).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, inlinePerms, excelLink, excelHistory, nowStamp, writeXlsExport, cellStr, tab, cvtIntStrict,
} = require('./_shared/batch12-common');
const { cfgInt16 } = require('./_shared/batch12-b-common');
const { PENDING_LINKS_LIST_PROPS, rowsOut, omitNull } = require('./_shared/batch13-03-common');

const router = express.Router();
const C = 'Rejected_Links';

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate) {
  const userid = req.user.emp_id;
  const Filename = 'Text_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  // dbo.[usp_rejectedLinkList] @StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@ToDate,@TotalCount out
  const objRejectLinkList = mapRows(await db.proc(DB, 'usp_rejectedLinkList', omitNull({
    StartRowIndex: 1, MaxRows: 999999, SearchField, SearchValue, fromDate, ToDate: toDate,
  })), PENDING_LINKS_LIST_PROPS);
  if (objRejectLinkList.length > 0) {
    let RowNumber = 1;
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Rejected_Links.xls', downloadName: 'Rejected_Links.xls', Filename,
      headers: ['S.No.', 'Order ID', 'BTC Address', 'Hash Code', 'Date'],
      rows: objRejectLinkList,
      innerProc: 'AllEPinRequestsList',
      outerProc: 'USP_ALL_MEMBERLIST',
      cells: (item, w) => {
        w('\n');
        w(tab(String(RowNumber)) + ' \t');
        w(tab(cellStr(item, 'orderID')) + ' \t');
        w(tab(cellStr(item, 'BlockChainAddress')) + ' \t');
        w(tab(cellStr(item, 'hashcode')) + ' \t');
        w(tab(cellStr(item, 'Create_Date')) + ' \t');
        RowNumber += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string btnexel, string SearchField, string SearchValue,
//   string fromDate, string toDate, int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Rejected-Links" -> Rejected_Links/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Rejected-Links'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let btnexel = nStr(req.p.btnexel);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let page = nInt(req.p.page);
  const ViewBag = {};
  if (btnexel === null) btnexel = '';
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  if (dynamicpagging === null) dynamicpagging = cfgInt16('DynamicPagging'); // Convert.ToInt16(AppSettings["DynamicPagging"])
  const p = await inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (SearchField === null) SearchField = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (page === null) page = 1;
  const MaxRows = Number(dynamicpagging);
  const rows = await db.proc(DB, 'usp_rejectedLinkList', {
    StartRowIndex: page, MaxRows, SearchField, SearchValue, fromDate, ToDate: toDate,
  });
  const objRejectLinkList = mapRows(rows, PENDING_LINKS_LIST_PROPS);
  // int.Parse(spOutput.Value.ToString()) (DBNull => FormatException). PORT-NOTE: with no rows PG cannot return the OUT value => 0.
  const tc = rowsOut(rows, 'TotalCount');
  const TotalRecord = tc === null ? 0 : cvtIntStrict(tc);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Rejected_Links/Index.cshtml', Model: objRejectLinkList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.fromDate), nStr(req.p.toDate));
  if (!r.sent) res.send('');
}));

module.exports = router;
