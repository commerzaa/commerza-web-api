'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Demanding_Product.cs (class Demanding_ProductController, no namespace => /Demanding_Product/...)
// Database: affiliate (Db_Affiliate). Procs usp_Demanding_Product, USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  nInt, nStr, col, str, cvtInt, inlinePerms, dynPaging, trimNull, nowStamp, excelHistory, writeXlsExport, cellStr, tab,
} = require('./_shared/batch06-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Demanding_Product';

/** public class Demanding_Product */
const DEMANDING_PRODUCT_PROPS = ['NAME', 'PackageName', 'PrCode', 'StockistCode', 'STATE', 'CITY', 'TotalSales', 'AVAILABLE', 'ROWNUMBER', 'ATTRIBUTE'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** public void ExportReport(string ProductName, string ProductCode) - returns { sent } (ViewBag receives filepath). */
async function ExportReport(req, res, ProductName, ProductCode, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Demanding_Product_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  // dbo.usp_Demanding_Product @Product_Name,@PrCode,@StartIndex,@MaxRow,@Result out,0
  const DemandList = mapRows(await db.proc(DB, 'usp_Demanding_Product', {
    Product_Name: trimNull(ProductName), PrCode: trimNull(ProductCode), StartIndex: 1, MaxRow: 999999, FRID: 0,
  }), DEMANDING_PRODUCT_PROPS);
  if (DemandList.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'Demanding_Product.xls', Filename, ViewBag, rows: DemandList,
      headers: ['S.No.', 'Product Name', 'stockist Code', 'City', 'State', 'Available', 'Total Sale Quantity'],
      innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'PackageName')) + ' \t');
        w(tab(cellStr(item, 'StockistCode')) + ' \t');
        w(tab(cellStr(item, 'CITY')) + ' \t');
        w(tab(cellStr(item, 'STATE')) + ' \t');
        w(tab(cellStr(item, 'AVAILABLE')) + ' \t');
        w(tab(cellStr(item, 'TotalSales')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, string ProductName, string btnexel,
//   string ProductCode, int? page, int? ddlcustpage)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Demanding-Product" -> Demanding_Product/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Demanding-Product'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let ProductName = nStr(req.p.ProductName);
  let btnexel = nStr(req.p.btnexel);
  let ProductCode = nStr(req.p.ProductCode);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  if (dynamicpagging === null) dynamicpagging = dynPaging();
  if (orderbydate === null) orderbydate = '';
  const perm = await inlinePerms(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = perm.excelactive;
  if (btnexel === null) btnexel = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  if (ProductName === null) ProductName = '';
  if (ProductCode === null) ProductCode = '';
  if (page === null) page = 1;
  const MaxRows = Number(dynamicpagging);
  // dbo.usp_Demanding_Product @Product_Name,@PrCode,@StartIndex,@MaxRow,@Result out,@FRID
  const rows = await db.proc(DB, 'usp_Demanding_Product', {
    Product_Name: ProductName.trim(), PrCode: ProductCode.trim(), StartIndex: page, MaxRow: MaxRows, FRID: '0',
  });
  const DemandList = mapRows(rows, DEMANDING_PRODUCT_PROPS);
  const r = str(col(rows[0], 'Result'));
  const TotalRecord = cvtInt(r === '' ? '0' : r);
  ViewBag.ProductName = ProductName;
  ViewBag.ProductCode = ProductCode;
  ViewBag.orderbydate = orderbydate;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = ddlcustpage;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  if (btnexel === 'Export Excel') {
    const x = await ExportReport(req, res, ProductName, ProductCode, ViewBag);
    if (x.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Demanding_Product/Index.cshtml', Model: DemandList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string ProductName, string ProductCode)
// auth (PORT-NOTE: public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const x = await ExportReport(req, res, nStr(req.p.ProductName), nStr(req.p.ProductCode), ViewBag);
  if (!x.sent) res.send(''); // void action => empty response
}));

/** GetProductName / GetProductCode: usp_Demanding_Product @Product_Name,@PrCode,@StartIndex,@MaxRow,@Result out */
async function productSearch(Product_Name, PrCode) {
  return mapRows(await db.proc(DB, 'usp_Demanding_Product', { Product_Name, PrCode, StartIndex: '1', MaxRow: '100' }), DEMANDING_PRODUCT_PROPS);
}

// ---------------------------------------------------------------- JsonResult GetProductName(string prefix)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetProductName{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  res.json(await productSearch(nStr(req.p.prefix), ''));
}));

// ---------------------------------------------------------------- JsonResult GetProductCode(string prefix)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetProductCode{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  res.json(await productSearch('', nStr(req.p.prefix)));
}));

module.exports = router;
