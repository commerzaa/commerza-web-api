'use strict';
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row (0 when absent).
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : 0);
const s = (v) => (v === undefined || v === null ? '' : String(v));
const pg = (v) => { const n = parseInt(v, 10); return Number.isNaN(n) ? 1 : n; };
// Port of Franchise\Controllers\CustomerPanel\UnpprovedndnList.cs (1 action)
// route-config: franchisee/unapproved-ndn -> Index
const GPL = ['IsVerified', 'Breadth_cms', 'CashOnDelivery', 'DAP', 'DealsIds', 'Height_cms', 'isnewarrival', 'IsStock', 'istopdeal', 'Length_cms', 'maincatname', 'MerchantCode', 'MerchantId', 'MerchantImage', 'MerchantName', 'EMAILID', 'PHONE', 'MPRID', 'Mvat', 'Prcode', 'ProcurementSLA', 'ProductCount', 'ProductImages', 'ProductTitle', 'prodUnit', 'Qty', 'ReplacementDay', 'rowNumber', 'sellMRP', 'ShippingCharges', 'SPRID', 'status_Sub', 'stockInQty', 'stockNetQty', 'stockOutQty', 'SubPrCode', 'VatTitle', 'IsActive', 'JP', 'BV', 'Rejectremark', 'Weight_kg', 'Subcategory', 'Discountpercentage', 'CreatedDate', 'ModifyDate', 'ismerchantstatus', 'title', 'value'];
// Convert.ToInt64(string): null -> 0, invalid -> FormatException
function toInt64(v) {
  if (v === null || v === undefined) return 0;
  const t = String(v).trim();
  if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return Number(t);
}
const isEmpty = (v) => v === undefined || v === null || v === '';

// auth
router.all(['/franchise/UnpprovedndnList/Index{/:id}', '/franchise/franchisee/unapproved-ndn'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const MerchantName = s(p.MerchantName);
  const PrCode = s(p.PrCode);
  const SubPrCode = s(p.SubPrCode);
  const DID = req.user.did;
  let MPRIDs = PrCode === '' ? 0 : toInt64(PrCode);
  let SPRIDs = SubPrCode === '' ? 0 : toInt64(SubPrCode);
  MPRIDs = isEmpty(p.mprid) ? MPRIDs : toInt64(p.mprid);
  SPRIDs = isEmpty(p.sprid) ? SPRIDs : toInt64(p.sprid);
  const Plid = 0;
  // legacy evaluated Convert.ToInt64 on these (throwing on bad input) when PrCode is not empty; values are unused afterwards
  if (PrCode !== '') {
    toInt64(p.SearchValueMRPFrom); toInt64(p.SearchValueMRPTTO); toInt64(p.SearchValueDiscount); toInt64(p.SearchValueDAP);
  }
  const NewAdd = s(p.NewAdd);
  const SearchField = s(p.SearchField);
  const SearchValue = s(p.SearchValue);
  const search = s(p.search);
  const filtercategory = s(p.filtercategory);
  const ProductName = s(p.ProductName);
  const ddlstatus = p.ddlstatus === undefined || p.ddlstatus === null || p.ddlstatus === '' ? 1 : parseInt(p.ddlstatus, 10);
  let SearchValueSubCategory = s(p.SearchValueSubCategory);
  if (SearchValueSubCategory.includes('amp;')) SearchValueSubCategory = SearchValueSubCategory.split('&amp;').join('&');
  const SearchValueTitle = s(p.SearchValueTitle);
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page ? pg(p.page) : 1;
  const rows = await db.proc('shopping', 'usp_getapprovedproductlist_f', {
    STARTROWINDEX: page, MaxRows, MPRID: MPRIDs, SPRID: SPRIDs, BranchId: Plid, cat_code: filtercategory, SearchField, SearchValue,
    Status: ddlstatus, Isverfied: 0, SearchValueSubCategory, SearchValueTitle, MerchantName, Productname: ProductName, DID, CATEGORYRELATEDTO: '2',
  });
  const TotalRecord = parseInt(outv(rows, 'TotalCount'), 10) || 0;
  res.json({
    Model: mapRows(rows, GPL),
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    ProductName,
    PrCode,
    SubPrCode,
    SPRID: SPRIDs,
    NewAdd,
    search,
    filtercategory,
    MPRID: MPRIDs,
    SearchField,
    SearchValue,
    MerchantName,
    SearchValueSubCategory,
  });
}));

module.exports = router;
