'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Transfer_Challan.cs (class Transfer_ChallanController => /admin/Transfer_Challan/...)
// Database: affiliate (Db_Affiliate).
const path = require('path');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');
const { supplied, tsvFile, XLS_DIR } = require('./_shared/batch13-09-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Transfer_Challan';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** class TransferChallan */
const PROPS = ['ROWNUMBER', 'DCID', 'CHALLANDATE', 'TOTALAMOUNT', 'CREATEDBY', 'CHALLANNO', 'TOFRID', 'Emp_Name', 'FRCode', 'FromFRCODE', 'IGST'];

/** public void ExportReport(string toDate, string fromDate, string Tofrid, string challanid) */
async function ExportReport(req, res, ViewBag, toDate, fromDate, Tofrid, challanid) {
  const userid = req.user.emp_id;
  const Filename = 'TransferChallan_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const Obj = mapRows(await db.proc(DB, 'USP_DELIVERYCHALAN_DETAILS', supplied({
    STARTROWINDEX: 1, MAXROWS: 999999, FROMDATE: fromDate, TODATE: toDate, TOFRID: Tofrid, CHALLANID: challanid,
  })), PROPS);
  if (Obj.length > 0) {
    return tsvFile({
      req, res, ViewBag, filepath: path.join(XLS_DIR(), 'TransferChallan.xls'),
      header: 'S.No. \tChallan No. \tDate \tstockist Code \tTotal Amount \tSendby \t',
      rows: Obj,
      innerProc: 'getblockedMemberList',
      outerProc: 'usp_Blocked_memberList',
      copyFilename: Filename,
      download: 'TransferChallan.xls',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.cellStr(item, 'CHALLANNO')) + ' \t');
        w(B.tab(B.cellStr(item, 'CHALLANDATE')) + ' \t'); // DateTime.ToString()
        w(B.tab(B.cellStr(item, 'FRCode')) + ' \t');
        w(B.tab(B.dec2(item.TOTALAMOUNT)) + ' \t');
        w(B.tab(B.cellStr(item, 'Emp_Name')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, int? page, string fromDate, string btnexel, string toDate, string Tofrid, string challanid, int? custpage)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Transfer-Challan" -> Transfer_Challan/Index
// Config: DynamicPagging
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Transfer-Challan'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let page = B.nInt(req.p.page);
  let fromDate = B.nStr(req.p.fromDate);
  let btnexel = B.nStr(req.p.btnexel);
  let toDate = B.nStr(req.p.toDate);
  let Tofrid = B.nStr(req.p.Tofrid);
  let challanid = B.nStr(req.p.challanid);
  let custpage = B.nInt(req.p.custpage);

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging;
    dynamicpagging = B.cvtInt(value === undefined ? null : value); // Convert.ToInt16(value)
  }
  if (orderbydate === null) orderbydate = '';
  const p = await B.inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await B.excelLink(url); // USP_EXCEL_LINK
  if (fromDate === null) fromDate = '';
  if (btnexel === null) btnexel = '';
  if (toDate === null) toDate = '';
  //  int MaxRows = Convert.ToInt32(100);
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  if (custpage === null) custpage = 100;
  if (Tofrid === null) Tofrid = '';
  if (challanid === null) challanid = '';
  const rows = await db.proc(DB, 'USP_DELIVERYCHALAN_DETAILS', {
    STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromDate, TODATE: toDate.trim(), TOFRID: Tofrid.trim(), CHALLANID: challanid.trim(),
  });
  const Obj = mapRows(rows, PROPS);
  const TotalRecord = B.outIntOf(rows, 'totalcount'); // int.Parse(v == "" ? "0" : v)
  ViewBag.FRCode = Tofrid;
  ViewBag.challanno = challanid;
  ViewBag.CurrentPage = page;
  ViewBag.TotalRecord = TotalRecord; ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.GridPageSize = custpage;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, toDate, fromDate, Tofrid, challanid);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Transfer_Challan/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string toDate, string fromDate, string Tofrid, string challanid)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.toDate), B.nStr(req.p.fromDate), B.nStr(req.p.Tofrid), B.nStr(req.p.challanid));
  if (!r.sent) res.send('');
}));

module.exports = router;
