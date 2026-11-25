'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\BranchLedger.cs (class BranchLedgerController => /admin/BranchLedger/...)
// Database: affiliate (Db_Affiliate). Model class BranchLedger (same file) => BL_PROPS; FranchisePackageDetails (FranchisePackage.cs) => FPD_PROPS.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const { sp, ip, outVal, ts, tab, nowStamp, exportXls } = require('./_shared/batch04B_common');
const { excelHistory, viewPerms, dec2 } = require('./_shared/batch04_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'BranchLedger';

const BL_PROPS = ['ROWNUMBER', 'NAME', 'FRCode', 'INSTOCK', 'Outstock', 'AVAILABLE', 'TransferStock', 'FRID'];
const FPD_PROPS = ['ROWNUMBER', 'FPMID', 'FIMID', 'FranchiseType', 'Status', 'MinAmount', 'MaxAmount', 'Commission', 'DISCRIPTION', 'Title'];

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields.
let url = '';
let url1 = '';

// ---------------------------------------------------------------- Index(string fromDate, string toDate, string ProductType, int? page, string btnexel, string ProductCode, string ProductName)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Branch-Ledger" -> BranchLedger/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Branch-Ledger'], adminAuth, asyncHandler(async (req, res) => {
  let fromDate = sp(req, 'fromDate');
  let toDate = sp(req, 'toDate');
  let ProductType = sp(req, 'ProductType');
  let page = ip(req, 'page');
  let btnexel = sp(req, 'btnexel');
  let ProductCode = sp(req, 'ProductCode');
  let ProductName = sp(req, 'ProductName');
  if (ProductCode === null) ProductCode = '';
  if (ProductName === null) ProductName = '';
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = await viewPerms(req, url, ['perm']);
  // USP_EXCEL_LINK @url,@ISACTIVE out is executed, but the result is ignored: ViewBag.excelactive = 0 (legacy)
  await db.proc(DB, 'USP_EXCEL_LINK', { url });
  ViewBag.excelactive = 0;
  if (btnexel === null) btnexel = '';
  if (ProductType === null) ProductType = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  const MaxRows = 100;
  if (page === null) page = 1;
  // DBO.UPS_BranchLedger @ProductName,@ProductCode,@fromDate,@toDate,@STARTROWINDEX,@MAXROWS,@TotalRecord out
  const rows = await db.proc(DB, 'UPS_BranchLedger', {
    ProductName, ProductCode, fromDate, toDate, STARTROWINDEX: page, MAXROWS: MaxRows,
  });
  const objAlltList = mapRows(rows, BL_PROPS);
  const tr = outVal(rows, 'TotalRecord');
  if (tr === null || tr === '') throw new Error('Object cannot be cast from DBNull to other types.'); // Convert.ToInt32(DBNull) (no catch in legacy)
  const TotalRecord = Math.round(Number(tr));
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  if (btnexel === 'Export Excel') {
    if (await ExportReport(req, res, ViewBag, fromDate, toDate, ProductType)) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/BranchLedger/Index.cshtml', Model: objAlltList, ...ViewBag });
}));

/** public void ExportReport(string fromDate, string toDate, string ProductType) - exports the FRANCHISE PACKAGE list (legacy copy/paste), true when sent */
async function ExportReport(req, res, ViewBag, fromDate, toDate, ProductType) {
  const userid = req.user.emp_id;
  const Filename = `Franchise_Package${userid}_${nowStamp()}`;
  await excelHistory(userid, url, Filename);
  // DBO.UPS_GetFranchisePackage @ProductType,@fromDate,@toDate,@STARTROWINDEX,@MAXROWS,@TotalRecord out
  const list = mapRows(await db.proc(DB, 'UPS_GetFranchisePackage', {
    ProductType, fromDate, toDate, STARTROWINDEX: 1, MAXROWS: 999999,
  }), FPD_PROPS);
  let srno = 1;
  return exportXls({
    req, res, rows: list, sheet: 'Franchise_Package', downloadName: ' Franchise_Package.xls', procName: 'USP_BANKWITHDRAWLREQUESTREPORT', itemProcName: 'ExportReport', ViewBag,
    headers: ['S.No. \t', 'FRANCHISE TYPE \t', 'MIN AMOUNT \t', 'MAX AMOUNT \t', 'COMMISSION % \t', 'STATUS \t'],
    row: (item, w) => {
      w(tab(String(srno)) + ' \t');
      w(tab(ts(item.FranchiseType)) + ' \t');
      w(tab(dec2(item.MinAmount)) + ' \t');
      w(tab(dec2(item.MaxAmount)) + ' \t');
      w(tab(ts(item.Commission)) + ' \t');
      w(tab(Number(item.Status) === 1 ? 'Active' : 'Deactive') + ' \t');
      srno += 1;
    },
  });
}

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, string ProductType)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, sp(req, 'fromDate'), sp(req, 'toDate'), sp(req, 'ProductType'));
  if (!sent) res.send(''); // void action => empty response
}));

module.exports = router;
