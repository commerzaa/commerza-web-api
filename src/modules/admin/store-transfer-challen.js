'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Store_Transfer_Challen.cs (class Store_Transfer_ChallenController => /admin/Store_Transfer_Challen/...)
// Database: affiliate (Db_Affiliate). Procs: USP_EXCEL_LINK, USP_GETEXCELPERMISIONSTATUS, USP_DELIVERYCHALAN_DETAILS_M_TO_M, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, cellStr, tab, nowStamp, excelHistory, writeXlsExport, excelLink, inlinePerms, outOf,
} = require('./_shared/batch11-common');
const { viewRes, dynPaging } = require('./_shared/batch13-08-common');

const router = express.Router();
const C = 'Store_Transfer_Challen';

/** class StoreTransferChallan */
const STC_PROPS = ['ROWNUMBER', 'DCID', 'CHALLANDATE', 'TOTALAMOUNT', 'CREATEDBY', 'CHALLANNO', 'TOFRID', 'FROMFRID', 'Emp_Name'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** [USP_DELIVERYCHALAN_DETAILS_M_TO_M] @STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@TOFRID,@FOMfRID,@CHALLANID,@TOTALCOUNT OUT */
const challanProc = (page, maxRows, fromDate, toDate, Tofrid, Fromfrid, challanid) => db.proc(DB, 'USP_DELIVERYCHALAN_DETAILS_M_TO_M', {
  STARTROWINDEX: page, MAXROWS: maxRows, FROMDATE: fromDate, TODATE: toDate, TOFRID: Tofrid, FOMfRID: Fromfrid, CHALLANID: challanid,
});

// public void ExportReport(int? page, string fromDate, string toDate, string Tofrid, string Fromfrid, string challanid, int? custpage)
async function ExportReport(req, res, page, fromDate, toDate, Tofrid, Fromfrid, challanid, custpage, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Store_Transfer_challan_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const Obj = mapRows(await challanProc(page, custpage, fromDate, toDate, Tofrid, Fromfrid, challanid), STC_PROPS);
  if (Obj.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Store_Transfer_Challan.xls', Filename,
      downloadName: 'All_Downline_Member_List.xls', // legacy content-disposition name (copy/paste in C#)
      headers: ['S.No.', 'Challan No.', 'Challan Date', 'Sender Code', 'Receiver Code', 'Total Amount', 'Sender By'],
      rows: Obj,
      innerProc: 'ExportReport',
      outerProc: 'USP_DELIVERYCHALAN_DETAILS_M_TO_M',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'CHALLANNO')) + ' \t');
        w(tab(cellStr(item, 'CHALLANDATE')) + ' \t');
        w(tab(cellStr(item, 'TOFRID')) + ' \t');
        w(tab(cellStr(item, 'FROMFRID')) + ' \t');
        w(tab(cellStr(item, 'TOTALAMOUNT')) + ' \t');
        w(tab(cellStr(item, 'Emp_Name')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, int? page, string fromDate, string toDate, string Tofrid, string Fromfrid, string challanid, int? custpage, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Store-Transfer-Challan" -> Store_Transfer_Challen/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Store-Transfer-Challan'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let page = nInt(req.p.page);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let Tofrid = nStr(req.p.Tofrid);
  let Fromfrid = nStr(req.p.Fromfrid);
  let challanid = nStr(req.p.challanid);
  let custpage = nInt(req.p.custpage);
  const btnexel = nStr(req.p.btnexel);
  const ViewBag = {};
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (dynamicpagging === null) dynamicpagging = dynPaging(); // AppSettings["DynamicPagging"]
  if (page === null) page = 1;
  if (custpage === null) custpage = 100;
  if (Tofrid === null) Tofrid = '';
  if (Fromfrid === null) Fromfrid = '';
  if (challanid === null) challanid = '';
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK @url,@ISACTIVE out
  const Employeeid = req.user.emp_id;
  const p = await inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  const MaxRows = Number(dynamicpagging);
  const rows = await challanProc(page, MaxRows, fromDate, toDate, Tofrid, Fromfrid, challanid);
  const Obj = mapRows(rows, STC_PROPS);
  const tc = outOf(rows, 'TOTALCOUNT');
  const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.Tofrid = Tofrid;
  ViewBag.challanno = challanid;
  ViewBag.CurrentPage = page;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.GridPageSize = custpage;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, page, fromDate, toDate, Tofrid, Fromfrid, challanid, custpage, ViewBag);
    if (r.sent) return undefined;
  }
  return viewRes(res, '~/Views/AdminPanel/Store_Transfer_Challen/Index.cshtml', Obj, ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nInt(req.p.page), nStr(req.p.fromDate), nStr(req.p.toDate), nStr(req.p.Tofrid), nStr(req.p.Fromfrid),
    nStr(req.p.challanid), nInt(req.p.custpage), {});
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
