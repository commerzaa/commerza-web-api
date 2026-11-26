'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Topup_History.cs (class Topup_HistoryController => /admin/Topup_History/...)
// Database: affiliate (Db_Affiliate).
const path = require('path');
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');
const { supplied, outIntStrict, tsvFile, XLS_DIR } = require('./_shared/batch13-09-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Topup_History';

/** class Topup_History */
const PROPS = ['rownumber', 'TRHID', 'Username', 'PLID', 'DateAndTime', 'MobileNumber', 'Operator', 'Amount', 'ATC', 'Api_REFID', 'Api_Balance',
  'Api_ErrorCode', 'Api_Remark', 'Api_REQID', 'Api_Status', 'Status'];

const sv = (req, n) => { const v = B.nStr(req.p[n]); return v === null ? '' : v; };

/** [Usp_MaintainRechargeHistory] @Mode=3 ... (StrResult / TotalCount are OUT => not passed) */
function history(Mobile, Username, ddlStatus, fromdate, todate, page, MaxRows) {
  return db.proc(DB, 'Usp_MaintainRechargeHistory', supplied({
    Mode: '3', PLID: 0, Mobile,
    Operator: Username, // Sending the username from here for searching
    Amount: '0', Api_REFID: '', Api_Balance: '0', Api_ErrorCode: '', Api_Remark: '', Api_REQID: '', Api_Status: ddlStatus,
    FromDate: fromdate, ToDate: todate, StartRowIndex: page, MaxRows, OpCode: '',
  }));
}

// ---------------------------------------------------------------- ActionResult Index(string fromdate, string todate, int? page, string Mobile, string ddlStatus, string Username)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/topup-history" -> Topup_History/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/topup-history'], adminAuth, asyncHandler(async (req, res) => {
  const fromdate = sv(req, 'fromdate');
  const todate = sv(req, 'todate');
  const Mobile = sv(req, 'Mobile');
  const ddlStatus = sv(req, 'ddlStatus');
  const Username = sv(req, 'Username');
  let page = B.nInt(req.p.page);
  const ViewBag = {};
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await history(Mobile, Username, ddlStatus, fromdate, todate, page, MaxRows);
  const Obj = mapRows(rows, PROPS);
  // ManageHistoryProperly(); (commented out in legacy)
  const TotalRecord = outIntStrict(rows, 'totalcount'); // Convert.ToInt32(spOutputL.Value.ToString())
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.Mobile = Mobile;
  ViewBag.ddlStatus = ddlStatus;
  ViewBag.Username = Username;
  // ExportReport(...) commented out in legacy
  return res.json({ view: '~/Views/AdminPanel/Topup_History/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string fromdate, string todate, int? page, string Mobile, string ddlStatus, string Username)
// auth (public method => routable in legacy; no session check; writes the admin recharge history to a server file => protected)
// Legacy only wrote ~/AllExcelSheets/Topup_History.xls (the Response.Redirect is commented out) => empty response.
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const fromdate = sv(req, 'fromdate');
  const todate = sv(req, 'todate');
  const Mobile = sv(req, 'Mobile');
  const ddlStatus = sv(req, 'ddlStatus');
  const Username = sv(req, 'Username');
  let page = B.nInt(req.p.page);
  const MaxRows = await UtilityClass.GridPageSize(); // computed but the call passes "100000"
  void MaxRows;
  if (page === null) page = 1;
  const Obj = mapRows(await history(Mobile, Username, ddlStatus, fromdate, todate, page, '100000'), PROPS);
  await tsvFile({
    req, res, ViewBag: {}, filepath: path.join(XLS_DIR(), 'Topup_History.xls'),
    header: 'S.No. \tUsername \tMobile No. \tOperator \tTopup Amount (INR) \tDate \tRequest Id \tStatus \t',
    rows: Obj,
    innerProc: 'Topup_History',
    outerProc: 'Usp_MaintainRechargeHistory',
    download: null,
    cells: (item, w) => {
      w('\n');
      w(B.tab(B.cellStr(item, 'rownumber')) + ' \t');
      w(B.tab(B.cellStr(item, 'Username')) + ' \t');
      w(B.tab(B.cellStr(item, 'MobileNumber')) + ' \t');
      w(B.tab(B.cellStr(item, 'Operator')) + ' \t');
      w(B.tab(B.dec2(item.Amount)) + ' \t');
      w(B.tab(B.cellStr(item, 'DateAndTime')) + ' \t');
      w(B.tab(B.cellStr(item, 'Api_REQID')) + ' \t');
      w(B.cellStr(item, 'Status').replace(/\t/g, '   ') + ' \t'); // (3 spaces in legacy)
    },
  });
  return res.send(''); // void action
}));

module.exports = router;
