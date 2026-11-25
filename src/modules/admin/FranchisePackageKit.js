'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\FranchisePackageKit.cs (class FranchisePackageKitController => /admin/FranchisePackageKit/...)
// Database: affiliate (Db_Affiliate). Models: StockDetails (ManageStock.cs), PackageDetails (same file).
// PORT-NOTE: EF6 SqlQuery<PackageDetails> required a column for every property; UPS_GetUserName_ProductPackage modes 1/2/4 do not return
// every PackageDetails column, so legacy most likely threw "data reader is incompatible" there. The port maps missing columns to null instead.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/adminSession');
const B = require('./_shared/batch07_common');
const { nn, totalOut } = require('./_shared/batch07C_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'FranchisePackageKit';

/** class StockDetails (ManageStock.cs) */
const SD_PROPS = ['RowNumber', 'TKPMID', 'PLID', 'FRID', 'PRODUCTLIST', 'INSTOCK', 'OUTSTOCK', 'AVAILABLE', 'Username', 'EMAILID', 'MRP',
  'COUNTRY', 'STATE', 'ADDRESS', 'CITY', 'PINCODE', 'Prname', 'Code', 'Name', 'PRcode', 'TKPID', 'TransferStock', 'ATTRIBUTE'];
/** class PackageDetails */
const PD_PROPS = ['PPID', 'TKPMID', 'PackageName', 'Prcode', 'Qnty', 'ProductPrice', 'MRP'];

/** string value sent to an INT procedure parameter: SQL Server converts ('' => 0, non-numeric => conversion error). */
function sqlInt(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '') return 0;
  if (!/^[-+]?\d+$/.test(s)) throw new Error(`Conversion failed when converting the nvarchar value '${v}' to data type int.`);
  return parseInt(s, 10);
}

// ---------------------------------------------------------------- Index(string ProductName, string Prcode, string OutStock, int? page, string Name, string PPID)
// auth (reads Session["Admin_User"])
// route-config: "AdminPanel/FranchisePackageKit" -> FranchisePackageKit/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/FranchisePackageKit'], adminAuth, asyncHandler(async (req, res) => {
  let ProductName = B.nStr(req.p.ProductName);
  let Prcode = B.nStr(req.p.Prcode);
  let OutStock = B.nStr(req.p.OutStock);
  let page = B.nInt(req.p.page);
  let Name = B.nStr(req.p.Name);
  let PPID = B.nStr(req.p.PPID);
  const ViewBag = {};
  if (ProductName === null) ProductName = '';
  if (Prcode === null) Prcode = '';
  if (Name !== null) {
    ViewBag.Name = await UtilityClass.Decryptword(Name);
  } else {
    ViewBag.Name = '';
    Name = '';
  }
  if (PPID !== null) {
    PPID = await UtilityClass.Decryptword(PPID);
  } else {
    PPID = '0';
  }
  if (page === null) page = 1;
  if (OutStock === 'False' || OutStock === null) OutStock = '';
  if (OutStock === 'true') OutStock = '0';
  let Obj = [];
  try {
    const MaxRows = 100;
    const empId = req.user.emp_id;
    ViewBag.EmpId = empId;
    // [DBO].[USP_GetStockDetails] @OutStock,@ProductName,@STARTROWINDEX,@MAXROWS,@SpOutputCount out,@Prcode
    const rows = await db.proc(DB, 'USP_GetStockDetails', {
      OutStock, ProductName, STARTROWINDEX: page, MAXROWS: MaxRows, Prcode,
    });
    Obj = mapRows(rows, SD_PROPS);
    const TotalRecord = totalOut(rows, 'SpOutputCount');
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    OutStock = 'false';
    // [UPS_GetUserName_ProductPackage ] '',@mode,0,@PPID  => PackageName='', mode=4, TKPMID=0, PPID=Convert.ToInt32(PPID)
    ViewBag.PackageDetails = mapRows(await db.proc(DB, 'UPS_GetUserName_ProductPackage', {
      PackageName: '', mode: 4, TKPMID: 0, PPID: B.cvtInt(PPID),
    }), PD_PROPS);
  } catch (Exp) {
    // Response.Redirect("/page-not-found") ends the response (ThreadAbortException), so the ErrorInsert block after it never ran.
    if (res.headersSent) return undefined;
    return res.json({ redirect: '/page-not-found' });
  }
  return res.json({ view: '~/Views/AdminPanel/FranchisePackageKit/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult save(string PackageName)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/save{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const PackageName = B.nStr(req.p.PackageName);
  const loginid = req.user.emp_id;
  let OutputResult = '';
  // DBO.USP_ProductPackage @PackageName,@RegNo,@PPID OUT
  const row = await db.procOne(DB, 'USP_ProductPackage', nn({ PackageName, RegNo: loginid }));
  OutputResult = B.outStr(row, 'PPID');
  return res.json(OutputResult);
}));

// ---------------------------------------------------------------- JsonResult save_details(string Code, string qnty, string TKPMID, string data)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/save_details{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Code = B.nStr(req.p.Code);
  const PPID = B.cvtInt(B.nStr(req.p.data));
  const Qnty = B.cvtInt(B.nStr(req.p.qnty));
  const TKPMID = B.cvtInt(B.nStr(req.p.TKPMID));
  // PORT-NOTE: ExecuteSqlCommand returned the rows-affected count (procedure without SET NOCOUNT): -1 when the detail row already existed
  // (nothing modified), otherwise UPDATE Tbl_ProductPackage (0/1 row) + INSERT (1 row). Reproduced with a pre-check of the same conditions.
  const existed = await db.scalar(DB, 'select 1 from tbl_productpackage_details where ppid = @PPID and tkpmid = @TKPMID limit 1', { PPID, TKPMID });
  const pkgRows = existed ? 0 : Number(await db.scalar(DB, 'select count(*) from tbl_productpackage where ppid = @PPID', { PPID })) || 0;
  // DBO.USP_ProductPackage_Details @PPID,@Prcode,@Qnty,@TKPMID   (null @Prcode => not sent, no default => error 500 like legacy)
  await db.proc(DB, 'USP_ProductPackage_Details', nn({ PPID, Prcode: Code, Qnty, TKPMID }));
  const affectedRows = existed ? -1 : pkgRows + 1;
  return res.json(affectedRows);
}));

// ---------------------------------------------------------------- JsonResult GetPackageName(string prefix)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetPackageName{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const prefix = B.nStr(req.p.prefix);
  // [UPS_GetUserName_ProductPackage ] @PackageName,@mode  (mode "1")
  const PackageName = mapRows(await db.proc(DB, 'UPS_GetUserName_ProductPackage', nn({ PackageName: prefix, mode: 1 })), PD_PROPS);
  return res.json(PackageName);
}));

// ---------------------------------------------------------------- JsonResult GetDetailsByPackageName(string PackageName)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetDetailsByPackageName{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const PackageName = B.nStr(req.p.PackageName);
  // [UPS_GetUserName_ProductPackage ] @PackageName,@mode  (mode "2")
  const ByPackageName = mapRows(await db.proc(DB, 'UPS_GetUserName_ProductPackage', nn({ PackageName, mode: 2 })), PD_PROPS);
  return res.json(ByPackageName);
}));

// ---------------------------------------------------------------- JsonResult deleteproduct(string TKPMID, int PPID)
// auth (legacy had no session check; admin-only delete => adminAuth)
router.all(`/admin/${C}/deleteproduct{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TKPMID = B.nStr(req.p.TKPMID);
  const PPID = B.reqInt(req.p.PPID, 'PPID');
  try {
    // [UPS_GetUserName_ProductPackage ] @PackageName,@mode,@TKPMID,@PPID  (PackageName '', mode "3"; mode 3 returns no rows)
    const deleteproduct = mapRows(await db.proc(DB, 'UPS_GetUserName_ProductPackage', nn({
      PackageName: '', mode: 3, TKPMID: sqlInt(TKPMID), PPID,
    })), PD_PROPS);
    return res.json(deleteproduct);
  } catch (e) {
    // Json(JsonRequestBehavior.AllowGet) => the enum is the DATA (serialised as 0) with the default DenyGet behaviour:
    // a GET request is refused by MVC (InvalidOperationException => 500), a POST returns 0.
    if (req.method === 'GET') {
      const err = new Error('This request has been blocked because sensitive information could be disclosed to third party web sites when this is used in a GET request. To allow GET requests, set JsonRequestBehavior to AllowGet.');
      err.status = 500;
      throw err;
    }
    return res.json(0);
  }
}));

module.exports = router;
