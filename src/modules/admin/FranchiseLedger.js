'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\FranchiseLedger.cs (class FranchiseLedgerController => /admin/FranchiseLedger/...)
// Database: affiliate (Db_Affiliate). Model BranchLedger (BranchLedger.cs) => BL_PROPS.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const { pagePermissions } = require('./_shared/loginLogCommon');
const B = require('./_shared/batch07_common');
const { totalOut, exportFranchisePackage } = require('./_shared/batch07C_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'FranchiseLedger';

/** class BranchLedger */
const BL_PROPS = ['ROWNUMBER', 'NAME', 'FRCode', 'INSTOCK', 'Outstock', 'AVAILABLE', 'TransferStock', 'FRID'];

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

// ---------------------------------------------------------------- Index(string fromDate, string toDate, string ProductType, int? page, string btnexel, string ProductCode, string ProductName)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Franchise-Ledger" -> FranchiseLedger/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Franchise-Ledger'], adminAuth, asyncHandler(async (req, res) => {
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let ProductType = B.nStr(req.p.ProductType);
  let page = B.nInt(req.p.page);
  let btnexel = B.nStr(req.p.btnexel);
  let ProductCode = B.nStr(req.p.ProductCode);
  let ProductName = B.nStr(req.p.ProductName);
  if (ProductCode === null) ProductCode = '';
  if (ProductName === null) ProductName = '';
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
  const perm = await pagePermissions(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  // USP_EXCEL_LINK @url,@ISACTIVE out is executed but its value is ignored (legacy: `int isactive = 0;`)
  await db.proc(DB, 'USP_EXCEL_LINK', { url });
  ViewBag.excelactive = 0;
  if (btnexel === null) btnexel = '';
  if (ProductType === null) ProductType = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  const MaxRows = 100;
  if (page === null) page = 1;
  // DBO.UPS_FranchiseLedger @ProductName,@ProductCode,@fromDate,@toDate,@STARTROWINDEX,@MAXROWS,@TotalRecord out
  const rows = await db.proc(DB, 'UPS_FranchiseLedger', {
    ProductName, ProductCode, fromDate, Todate: toDate, STARTROWINDEX: page, MAXROWS: MaxRows,
  });
  const objAlltList = mapRows(rows, BL_PROPS);
  const TotalRecord = totalOut(rows, 'TotalRecord');
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  if (btnexel === 'Export Excel') {
    if (await exportFranchisePackage(req, res, ViewBag, url, fromDate, toDate, ProductType)) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/FranchiseLedger/Index.cshtml', Model: objAlltList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, string ProductType)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await exportFranchisePackage(req, res, {}, url, B.nStr(req.p.fromDate), B.nStr(req.p.toDate), B.nStr(req.p.ProductType));
  if (!sent) res.send(''); // void action => empty response
}));

module.exports = router;
