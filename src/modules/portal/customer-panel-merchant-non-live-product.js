// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Merchant_NonLiveProduct.cs (class Merchant_NonLiveProductController; DB: Db_Shopping)
// Started from src/modules/merchant/merchant-non-live-product.js, then matched line by line with the portal C#.
// Tables/procs: excel_product (_Excel_Product), Usp_GetAll_ExcelProductList, ProductDal.ApproveAndNewSale (usp_MultipleApproveAndNewSale)
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
const P = '/portal/Merchant_NonLiveProduct';

// auth ([SessionExpireCheck])
// route-config: merchant/non-live -> Merchant_NonLiveProduct/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/non-live'], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  let PrCode = b.mvcStr(req, 'PrCode');
  let search = b.mvcStr(req, 'search');
  let filtercategory = b.mvcStr(req, 'filtercategory');
  let page = c.bindNullableInt(req, 'page');
  let ddlstatus = c.bindNullableInt(req, 'ddlstatus');
  if (PrCode === null) PrCode = '';
  if (search === null) search = '';
  if (filtercategory === null) filtercategory = '';
  if (ddlstatus === null) ddlstatus = -1;

  const Plid = Number(req.user.plid);
  const ViewBag = {};
  const cnt = async (st) => c.toInt32(await db.scalar(DB, 'select count(*) from excel_product where qcstatus = @st and branchid = @plid', { st, plid: Plid }));
  ViewBag.QCVerified = await cnt(1);
  ViewBag.QCPending = await cnt(0);
  ViewBag.QCFailed = await cnt(2);

  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'usp_getall_excelproductlist', {
    startrowindex: page, maxrows: MaxRows, branchid: Plid, searchfield: search, searchvalue: PrCode, status: ddlstatus,
  });
  const GetProductLists = mapRows(rows, b.EXCEL_PRODUCT_DETAIL);
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first row (0 when no rows).
  const TotalRecord = b.totalOf(rows);

  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.PrCode = PrCode;
  ViewBag.search = search;
  ViewBag.filtercategory = filtercategory;
  return c.viewJson(res, '~/Views/CustomerPanel/Merchant_NonLiveProduct/Index.cshtml', GetProductLists, ViewBag);
}));

// auth ([SessionExpireCheck])
router.all(`${P}/ApproveAndNewSale{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  let CheckIds = b.mvcStr(req, 'CheckIds');
  CheckIds = b.trimChar(CheckIds, ',');
  const Plid = Number(req.user.plid);
  const dal = new ProductDal();
  const returnmess = await dal.ApproveAndNewSale(CheckIds, Plid);
  res.json(returnmess);
}));

// private string GenerateXMLProductList(DataSet result) - private and never called => not routed.

module.exports = router;
