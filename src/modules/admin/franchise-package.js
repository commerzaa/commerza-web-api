'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\FranchisePackage.cs (class Franchise_PackageController => /admin/Franchise_Package/...)
// Database: affiliate (Db_Affiliate). Classes FranchisePackageDetails / ProductType (same file) => _shared/batch07C_common.js.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const { pagePermissions, excelLink } = require('./_shared/login-log-common');
const B = require('./_shared/batch07-common');
const {
  nn, totalOut, FPD_PROPS, BindProductType, exportFranchisePackage,
} = require('./_shared/batch07-c-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Franchise_Package';

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

// ---------------------------------------------------------------- Index(string fromDate, string toDate, string ProductType, int? page, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Franchise-Package" -> Franchise_Package/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Franchise-Package'], adminAuth, asyncHandler(async (req, res) => {
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let ProductType = B.nStr(req.p.ProductType);
  let page = B.nInt(req.p.page);
  let btnexel = B.nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  const perm = await pagePermissions(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK @url,@ISACTIVE out
  if (btnexel === null) btnexel = '';
  if (ProductType === null) ProductType = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  const MaxRows = 5;
  if (page === null) page = 1;
  // DBO.UPS_GetFranchisePackage @ProductType,@fromDate,@toDate,@STARTROWINDEX,@MAXROWS,@TotalRecord out
  const rows = await db.proc(DB, 'UPS_GetFranchisePackage', {
    ProductType, fromDate, Todate: toDate, STARTROWINDEX: page, MAXROWS: MaxRows,
  });
  const objAlltList = mapRows(rows, FPD_PROPS);
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
  // The view binds new ProductType().BindProductType() into the "ProductTypeList" dropdown => returned as ProductTypeList.
  const ProductTypeList = await BindProductType();
  return res.json({ view: '~/Views/AdminPanel/FranchisePackage/Index.cshtml', Model: objAlltList, ...ViewBag, ProductTypeList });
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, string ProductType)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await exportFranchisePackage(req, res, {}, url, B.nStr(req.p.fromDate), B.nStr(req.p.toDate), B.nStr(req.p.ProductType));
  if (!sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult GetPackagedetilById(string FPMID)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetPackagedetilById{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const FPMID = B.cvtInt(B.nStr(req.p.FPMID)); // Convert.ToInt64 (null => 0)
  // [UPS_GetPackageDetailsById] @FPMID  (.FirstOrDefault())
  const list = mapRows(await db.proc(DB, 'UPS_GetPackageDetailsById', { FPMID }), FPD_PROPS);
  const packagedetilscla = list.length ? list[0] : null;
  if (packagedetilscla === null) return res.type('application/json').send(''); // Json(null) => empty body
  return res.json(packagedetilscla);
}));

// ---------------------------------------------------------------- JsonResult AddFranchisePackage(int FPMID, string Title, string ProductType, string MinAmount, string MaxAmount, string Commission, string SUBSCRIPTIONDETAILS, string Status)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/AddFranchisePackage{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const FPMID = B.reqInt(req.p.FPMID, 'FPMID');
  const Title = B.nStr(req.p.Title);
  const ProductType = B.nStr(req.p.ProductType);
  const MaxAmount = B.nStr(req.p.MaxAmount);
  const Commission = B.nStr(req.p.Commission);
  let SUBSCRIPTIONDETAILS = B.nStr(req.p.SUBSCRIPTIONDETAILS);
  const Status = B.nStr(req.p.Status);
  // (MinAmount is bound but legacy always sends Convert.ToDecimal(0))
  let Ret = '0';
  if (SUBSCRIPTIONDETAILS === null) throw B.nullRef(); // .Replace on null => NullReferenceException (500)
  SUBSCRIPTIONDETAILS = SUBSCRIPTIONDETAILS.split('lessthan').join('<');
  SUBSCRIPTIONDETAILS = SUBSCRIPTIONDETAILS.split('greatthan').join('>');
  SUBSCRIPTIONDETAILS = SUBSCRIPTIONDETAILS.replace(/<(.|\n)*?>/g, '');
  const loginid = req.user.emp_loginid; // ((Employee_Master)Session["Admin_User"]).Emp_LoginID
  // [DBO].[USP_CREATE_NEW_FRANCHISE] @FPMID,@Title,@ProductType,@MinAmount,@MaxAmount,@Commission,@Description,@Status,@loginid,@STRRESULT out
  const row = await db.procOne(DB, 'USP_CREATE_NEW_FRANCHISE', nn({
    FPMID,
    Title, // null => not sent (no default => procedure error, 500 like legacy)
    ProductType: B.cvtInt(ProductType),
    MinAmount: 0,
    MaxAmount: B.cvtDec(MaxAmount),
    Commission: B.cvtDec(Commission),
    Description: SUBSCRIPTIONDETAILS,
    Status: B.cvtInt(Status),
    loginid,
  }));
  Ret = B.outStr(row, 'STRRESULT');
  return res.json(Ret);
}));

module.exports = router;
