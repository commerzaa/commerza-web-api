'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Invertory_StockLedger.cs
// (class Invertory_StockLedgerController => /admin/Invertory_StockLedger/...). Database: affiliate (Db_Affiliate).
// The file also declares `public class allstock` (model => ALLSTOCK_PROPS).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const B = require('./_shared/batch08_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Invertory_StockLedger';

/** class allstock */
const ALLSTOCK_PROPS = ['ROWNUMBER', 'NAME', 'PrCode', 'Productcode', 'INSTOCK', 'BranchAvailable', 'BranchSales', 'TransferStock', 'SoldtoFranchise',
  'FranchiseSales', 'AvailableStockFranchise', 'TotalAvailable', 'ATTRIBUTE'];
/** class FranchisePackageDetails (FranchisePackage.cs) */
const FPD_PROPS = ['ROWNUMBER', 'FPMID', 'FIMID', 'FranchiseType', 'Status', 'MinAmount', 'MaxAmount', 'Commission', 'DISCRIPTION', 'Title'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (kept as module state).
let url = '';
let url1 = '';

/** public void ExportReport(string fromDate, string toDate, string ProductType) */
async function ExportReport(req, res, ViewBag, fromDate, toDate, ProductType) {
  const userid = req.user.emp_id;
  const Filename = 'Franchise_Package' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  // DBO.UPS_GetFranchisePackage @ProductType,@fromDate,@toDate,@STARTROWINDEX,@MAXROWS,@TotalRecord out
  const objAlltList = mapRows(await db.proc(DB, 'UPS_GetFranchisePackage', {
    ProductType, fromDate, toDate, STARTROWINDEX: 1, MAXROWS: 999999,
  }), FPD_PROPS);
  if (objAlltList.length > 0) {
    let srno = 1;
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Franchise_Package.xls', Filename, downloadName: ' Franchise_Package.xls', // header was "filename= Franchise_Package.xls"
      headers: ['S.No.', 'FRANCHISE TYPE', 'MIN AMOUNT', 'MAX AMOUNT', 'COMMISSION %', 'STATUS'],
      rows: objAlltList,
      innerProc: 'ExportReport',
      outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w('\n');
        w(B.tab(String(srno)) + ' \t');
        w(B.tab(B.cellStr(item, 'FranchiseType')) + ' \t');
        w(B.tab(B.dec2(item.MinAmount)) + ' \t');
        w(B.tab(B.dec2(item.MaxAmount)) + ' \t');
        w(B.tab(B.cellStr(item, 'Commission')) + ' \t');
        w(B.tab(Number(item.Status) === 1 ? 'Active' : 'Deactive') + ' \t');
        srno += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(string fromDate, string toDate, string ProductType, int? page, string btnexel, string ProductCode, string ProductName)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Invertory-StockLedger" -> Invertory_StockLedger/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Invertory-StockLedger'], adminAuth, asyncHandler(async (req, res) => {
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let ProductType = B.nStr(req.p.ProductType);
  let page = B.nInt(req.p.page);
  let btnexel = B.nStr(req.p.btnexel);
  let ProductCode = B.nStr(req.p.ProductCode);
  let ProductName = B.nStr(req.p.ProductName);
  const ViewBag = {};
  if (ProductCode === null) ProductCode = '';
  if (ProductName === null) ProductName = '';
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
  const pr = await db.procOne(DB, 'USP_GETEXCELPERMISIONSTATUS', { EMPID: Employeeid, HERF: url });
  const ex = B.str(B.col(pr, 'EXCELSTATUS'));
  const ie = B.str(B.col(pr, 'ISEDIT'));
  ViewBag.isactive = B.cvtInt(ex === '' ? '0' : ex);
  ViewBag.isedit = B.cvtInt(ie === '' ? '0' : ie);
  // USP_EXCEL_LINK @url,@ISACTIVE out  (CommandTimeout 1000) - output ignored by the legacy code (isactive = 0)
  await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  ViewBag.excelactive = 0;
  if (btnexel === null) btnexel = '';
  if (ProductType === null) ProductType = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  const MaxRows = 100;
  if (page === null) page = 1;
  // DBO.UPS_GetAllProductStock @ProductName,@ProductCode,@fromDate,@toDate,@STARTROWINDEX,@MAXROWS,@TotalRecord out
  const rows = await db.proc(DB, 'UPS_GetAllProductStock', {
    ProductName, ProductCode, fromDate, toDate, STARTROWINDEX: page, MAXROWS: MaxRows,
  });
  const objAlltList = mapRows(rows, ALLSTOCK_PROPS);
  const tr = B.col(rows[0], 'TotalRecord');
  if (tr === null || tr === undefined) throw new Error('Object cannot be cast from DBNull to other types.'); // Convert.ToInt32(DBNull)
  const TotalRecord = B.cvtInt(tr);
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.CurrentPage = page;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  if (btnexel === 'Export Excel') {
    // PORT-NOTE: legacy Response.Redirect to the sheet ended the request; the file is sent directly instead.
    // PORT-NOTE: legacy quirk kept - the stock ledger "export" exports the franchise PACKAGE list (UPS_GetFranchisePackage).
    const r = await ExportReport(req, res, ViewBag, fromDate, toDate, ProductType);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Invertory_StockLedger/Index.cshtml', Model: objAlltList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, string ProductType)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.fromDate), B.nStr(req.p.toDate), B.nStr(req.p.ProductType));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
