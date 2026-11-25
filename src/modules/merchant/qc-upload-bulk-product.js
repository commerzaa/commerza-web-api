'use strict';
/** Ported from Merchant Controllers\CustomerPanel\QCUploadBulkProduct.cs (QCUploadBulkProductController) */
const express = require('express');
const { scalar, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const ProductDal = require('../../lib/merchant/ProductDal');

const router = express.Router();
const DB = 'shopping';
const P = '/merchant/QCUploadBulkProduct';
const nz = (v, d) => (v === undefined || v === null ? d : v);
const trimComma = (s) => String(s).replace(/^,+|,+$/g, '');

// auth ([SessionExpireCheck])
// route-config: merchant/verify-non-live -> Index
router.all([`${P}/Index{/:id}`, '/merchant/verify-non-live'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const PrCode = nz(p.PrCode, '');
  const search = nz(p.search, '');
  const filtercategory = nz(p.filtercategory, '');
  const ddlstatus = p.ddlstatus === undefined || p.ddlstatus === null || p.ddlstatus === '' ? -1 : parseInt(p.ddlstatus, 10);
  const BranchId = req.user.plid;
  const cnt = async (s) => Number(await scalar(DB, 'select count(*) from Excel_Product where QCStatus=@s', { s })) || 0;
  const QCVerified = await cnt(1);
  const QCPending = await cnt(0);
  const QCFailed = await cnt(2);
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page === undefined || p.page === null || p.page === '' ? 1 : parseInt(p.page, 10);
  const rows = await proc(DB, 'Usp_GetAll_ExcelProductList', {
    startrowindex: page, maxrows: MaxRows, branchid: BranchId, searchfield: search, searchvalue: PrCode, status: ddlstatus,
  });
  const GetProductLists = mapRows(rows, ['Id', 'MCID', 'CID', 'SCID', 'VCID', 'Code', 'ProductTitle', 'ShortDescription', 'FullDescription', 'KeyFeatures',
    'UnitQty', 'Unit', 'StockIn', 'WarrentyInfoCare', 'ProductImages', 'SellMRP', 'DAP', 'Discount', 'DealsIds', 'GroupId', 'ReplacementDay',
    'ProcurementSLA', 'CashOnDelivery', 'ShippingCharges', 'Weight_kg', 'Length_cms', 'Breadth_cms', 'Height_cms', 'ErrorReason', 'BranchId',
    'CreatedDate', 'QCStatus', 'BranchName', 'MasterCategoryName', 'CategoryName', 'SubCategoryName', 'VatCategoryName', 'VatValue', 'DealsName', 'GroupName']);
  const n = parseInt(((rows && rows[0]) || {}).totalcount, 10);
  const seen = new Set();
  const ProductBranch = [];
  for (const a of GetProductLists) { // MoreLinq DistinctBy(MerchantId)
    if (!seen.has(a.BranchId)) { seen.add(a.BranchId); ProductBranch.push({ MerchantId: a.BranchId, MerchantCode: a.Code, MerchantName: a.BranchName }); }
  }
  res.json({
    Model: GetProductLists,
    QCVerified, QCPending, QCFailed,
    Plid: BranchId,
    ProductBranch,
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord: Number.isNaN(n) ? 0 : n,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    PrCode, search, filtercategory,
  });
}));

// auth ([SessionExpireCheck] [ValidateInput(false)])
router.all(`${P}/ChangeQCStatus{/:id}`, auth, asyncHandler(async (req, res) => {
  const CheckIds = trimComma(req.p.CheckIds);
  const BranchId = Number(req.user.plid);
  if (BranchId !== 1) return res.json("Sorry! You don't have the rights !");
  const dal = new ProductDal();
  const returnmess = await dal.ChangeQCStatus(CheckIds, parseInt(req.p.QCStatus, 10), req.p.Reason);
  res.json(returnmess);
}));

// auth ([SessionExpireCheck] [ValidateInput(false)])
router.all(`${P}/DeleteQCProduct{/:id}`, auth, asyncHandler(async (req, res) => {
  const CheckIds = trimComma(req.p.CheckIds);
  const BranchId = Number(req.user.plid);
  if (BranchId !== 1) return res.json("Sorry! You don't have the rights !");
  const dal = new ProductDal();
  const returnmess = await dal.DeleteQCProduct(CheckIds);
  res.json(returnmess);
}));

module.exports = router;
