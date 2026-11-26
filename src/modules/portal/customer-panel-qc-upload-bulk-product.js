// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/QCUploadBulkProduct.cs (class QCUploadBulkProductController; DB: Db_Shopping)
// Started from src/modules/merchant/qc-upload-bulk-product.js, then matched line by line with the portal C#.
// Tables/procs: excel_product (_Excel_Product), Usp_GetAll_ExcelProductList, ProductDal.ChangeQCStatus / DeleteQCProduct
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const c = require('./_shared/batch-05-common');
const b = require('./_shared/batch-23-common');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ProductDal = require('../../lib/portal/ProductDal');

const router = express.Router();
const DB = 'shopping';
const P = '/portal/QCUploadBulkProduct';

// auth ([SessionExpireCheck])
// route-config: merchant/verify-non-live -> QCUploadBulkProduct/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/verify-non-live'], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  let PrCode = b.mvcStr(req, 'PrCode');
  let search = b.mvcStr(req, 'search');
  let filtercategory = b.mvcStr(req, 'filtercategory');
  let page = c.bindNullableInt(req, 'page');
  let ddlstatus = c.bindNullableInt(req, 'ddlstatus');
  if (PrCode === null) PrCode = '';
  if (search === null) search = '';
  if (filtercategory === null) filtercategory = '';
  if (ddlstatus === null) ddlstatus = -1;

  const BranchId = Number(req.user.plid);
  const ViewBag = {};
  // counts over ALL merchants (no BranchId filter in the portal C#)
  const cnt = async (st) => c.toInt32(await db.scalar(DB, 'select count(*) from excel_product where qcstatus = @st', { st }));
  ViewBag.QCVerified = await cnt(1);
  ViewBag.QCPending = await cnt(0);
  ViewBag.QCFailed = await cnt(2);
  ViewBag.Plid = BranchId;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'usp_getall_excelproductlist', {
    startrowindex: page, maxrows: MaxRows, branchid: BranchId, searchfield: search, searchvalue: PrCode, status: ddlstatus,
  });
  const GetProductLists = mapRows(rows, b.EXCEL_PRODUCT_DETAIL);
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first row (0 when no rows).
  const TotalRecord = b.totalOf(rows);

  // GetProductLists.Select(a => new ProductBranch {...}).DistinctBy(a => a.MerchantId).ToList(); .Distinct() (reference equality => no-op)
  const seen = new Set();
  const GetProductLists1 = [];
  for (const a of GetProductLists) {
    const key = String(a.BranchId);
    if (seen.has(key)) continue;
    seen.add(key);
    GetProductLists1.push({ MerchantCode: a.Code, MerchantId: a.BranchId, MerchantName: a.BranchName, ProductCount: 0 });
  }
  ViewBag.ProductBranch = GetProductLists1;

  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.PrCode = PrCode;
  ViewBag.search = search;
  ViewBag.filtercategory = filtercategory;
  return c.viewJson(res, '~/Views/CustomerPanel/QCUploadBulkProduct/Index.cshtml', GetProductLists, ViewBag);
}));

// auth ([SessionExpireCheck] [ValidateInput(false)])
router.all(`${P}/ChangeQCStatus{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const QCStatus = c.bindInt(req, 'QCStatus');
  let CheckIds = b.mvcStr(req, 'CheckIds');
  const Reason = b.mvcStr(req, 'Reason');
  CheckIds = b.trimChar(CheckIds, ',');
  const BranchId = Number(req.user.plid);
  if (BranchId !== 1) return res.json("Sorry! You don't have the rights !");
  const dal = new ProductDal();
  const returnmess = await dal.ChangeQCStatus(CheckIds, QCStatus, Reason);
  res.json(returnmess);
}));

// auth ([SessionExpireCheck] [ValidateInput(false)])
router.all(`${P}/DeleteQCProduct{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  let CheckIds = b.mvcStr(req, 'CheckIds');
  CheckIds = b.trimChar(CheckIds, ',');
  const BranchId = Number(req.user.plid);
  if (BranchId !== 1) return res.json("Sorry! You don't have the rights !");
  const dal = new ProductDal();
  const returnmess = await dal.DeleteQCProduct(CheckIds);
  res.json(returnmess);
}));

module.exports = router;
