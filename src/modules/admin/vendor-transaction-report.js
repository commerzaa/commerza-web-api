'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\VendorTransactionReportController.cs
// (class VendorTransactionReportController => /admin/VendorTransactionReport/...)
// Database: affiliate (Db_Affiliate).
//
// Coverage: Index -> route ; ExportReport (public void => routable) -> route + internal function (used by Index).
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');
const { viewJson, sendVoid } = require('./_shared/batch13-11-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'VendorTransactionReport';

/** class VendorTransactionReport_Request */
const PROPS = ['ROWNUMBER', 'FNAME', 'USERNAME', 'MOBILE', 'TransactionDate', 'NoOfCoin', 'OrderNo', 'TransactionId', 'Vendor'];

/** [Usp_VendorTransactionReport] @Mode,@FromDate,@ToDate,@SearchType,@SearchValue,@StartRowIndex,@MaxRows,@TotalCount Out */
function reportProc(FromDate, ToDate, SearchField, SearchValue, Page, MaxRows) {
  // CommandTimeout = 1000
  return db.proc(DB, 'Usp_VendorTransactionReport', {
    Mode: '1', FromDate, ToDate, SearchType: SearchField, SearchValue, StartRowIndex: Page, MaxRows,
  });
}

/** C# string concatenation of a value (null => "") */
const cat = (v) => (v === null || v === undefined ? '' : (v instanceof Date ? B.netDateString(v) : String(v)));

// public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue)
// (writes ~/AllExcelSheets/All_Vendor_Transaction_List.xls on the server only; no download response; no try/catch => exceptions propagate)
async function ExportReport(Page, FromDate, ToDate, SearchField, SearchValue) {
  if (FromDate === null) FromDate = '';
  if (ToDate === null) ToDate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  const MaxRows = 500000;
  if (Page === null) Page = 1;
  const Li = mapRows(await reportProc(FromDate, ToDate, SearchField, SearchValue, Page, MaxRows), PROPS);
  const Filepath = B.mapPath('~/AllExcelSheets/All_Vendor_Transaction_List.xls');
  if (fs.existsSync(Filepath)) fs.unlinkSync(Filepath);
  fs.mkdirSync(path.dirname(Filepath), { recursive: true });
  let out = '';
  for (const h of ['S.No.', 'Name', 'UserName', 'Mobile', 'Transaction Date', 'No Of Coin', 'Order No', 'Transaction Id', 'Vendor']) out += `${h} \t`;
  for (const Item of Li) {
    out += '\r\n'; // SwObj.WriteLine()
    for (const k of PROPS) out += cat(Item[k]) + ' \t';
  }
  fs.writeFileSync(Filepath, out);
}

// ---------------------------------------------------------------- Index(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue, string GenerateExcel)
// auth (legacy had no session check; admin data => adminAuth)
// route-config: "AdminPanel/Vendor-Transaction-Report" -> VendorTransactionReport/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Vendor-Transaction-Report{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  let Page = B.nInt(req.p.Page);
  const FromDate = B.s0(req.p.FromDate);
  const ToDate = B.s0(req.p.ToDate);
  const SearchField = B.s0(req.p.SearchField);
  const SearchValue = B.s0(req.p.SearchValue);
  const GenerateExcel = B.nStr(req.p.GenerateExcel);
  const ViewBag = {};
  const MaxRows = await UtilityClass.GridPageSize();
  if (Page === null) Page = 1;
  const rows = await reportProc(FromDate, ToDate, SearchField, SearchValue, Page, MaxRows);
  const Li = mapRows(rows, PROPS);
  const TotalRecord = B.outIntOf(rows, 'TotalCount'); // Convert.ToInt32(SpOutputCount.Value.ToString())
  ViewBag.CurrentPage = Page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.toDate = ToDate;
  ViewBag.fromDate = FromDate;
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  // #region For Downlaod Excel
  if (GenerateExcel !== null) {
    if (GenerateExcel === 'Generate Excel') {
      await ExportReport(Page, FromDate, ToDate, SearchField, SearchValue);
    }
  }
  return viewJson(res, '~/Views/AdminPanel/VendorTransactionReport/Index.cshtml', Li, ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => B.nStr(req.p[k]);
  await ExportReport(B.nInt(req.p.Page), v('FromDate'), v('ToDate'), v('SearchField'), v('SearchValue'));
  return sendVoid(res, { sent: false });
}));

module.exports = router;
