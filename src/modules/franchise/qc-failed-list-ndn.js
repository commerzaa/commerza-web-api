'use strict';
/**
 * Port of Franchise\Controllers\CustomerPanel\QCFailed_ListNDN.cs (QCFailed_ListNDNController)
 * Actions: Index (1)
 */
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const DB = 'shopping'; // Franchise DataBaseContext => Db_Shopping (Web.config)
const PRODUCT_LIST_SINGLE_PROPS = ['IsVerified', 'Breadth_cms', 'CashOnDelivery', 'DAP', 'DealsIds', 'Height_cms', 'isnewarrival', 'IsStock', 'istopdeal', 'Length_cms',
  'maincatname', 'MerchantCode', 'MerchantId', 'MerchantImage', 'MerchantName', 'MPRID', 'Mvat', 'Prcode', 'ProcurementSLA', 'ProductCount', 'ProductImages', 'ProductTitle',
  'prodUnit', 'Qty', 'ReplacementDay', 'rowNumber', 'sellMRP', 'ShippingCharges', 'SPRID', 'status_Sub', 'stockInQty', 'stockNetQty', 'stockOutQty', 'SubPrCode', 'VatTitle',
  'IsActive', 'JP', 'BV', 'Rejectremark', 'Weight_kg', 'Subcategory', 'Discountpercentage', 'CreatedDate', 'ModifyDate', 'ismerchantstatus', 'EMAILID', 'PHONE'];
const toBig = (v) => (v === undefined || v === null || v === '' ? 0 : parseInt(v, 10));

// route-config: franchisee/QCFailed-Listing-ndn
// auth
router.all(['/franchise/QCFailed_ListNDN/Index{/:id}', '/franchise/franchisee/QCFailed-Listing-ndn'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let { SubPrCode, MerchantName, SearchValueSubCategory, SearchValue, fromDate, toDate, mprid, sprid, ProductName, NewAdd, SearchField, filtercategory } = p;
  let page = p.page === undefined || p.page === null || p.page === '' ? null : parseInt(p.page, 10);
  let MAINCATID = p.MAINCATID === undefined || p.MAINCATID === null || p.MAINCATID === '' ? null : parseInt(p.MAINCATID, 10);
  let SUBCATID = p.SUBCATID === undefined || p.SUBCATID === null || p.SUBCATID === '' ? null : parseInt(p.SUBCATID, 10);
  if (SearchValueSubCategory == null) SearchValueSubCategory = '';
  if (SearchValueSubCategory.includes('amp;')) SearchValueSubCategory = SearchValueSubCategory.split('&amp;').join('&');
  if (MerchantName == null) MerchantName = '';
  if (SUBCATID == null) SUBCATID = 0;
  if (MAINCATID == null) MAINCATID = 2;
  if (SearchValue == null) SearchValue = '';
  if (SubPrCode == null) SubPrCode = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  let MPRIDs = 0;
  let SPRIDs = SubPrCode === '' ? 0 : toBig(SubPrCode);
  MPRIDs = (mprid === undefined || mprid === null || mprid === '') ? MPRIDs : toBig(mprid);
  SPRIDs = (sprid === undefined || sprid === null || sprid === '') ? SPRIDs : toBig(sprid);
  const Plid = 0;
  if (NewAdd == null) NewAdd = '';
  if (SearchField == null) SearchField = '';
  if (filtercategory == null) filtercategory = '';
  if (ProductName == null) ProductName = '';
  const DID = toBig(req.user.did);

  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const rows = await db.proc(DB, 'USP_GETALL_STATUS_PRODUCTLIST_F', {
    StartRowIndex: page, MaxRows, MPRID: MPRIDs, SPRID: SPRIDs, BranchId: Plid, cat_code: filtercategory, SearchField, SearchValue, FROMDATE: fromDate, TODATE: toDate,
    Status: 2, SUBCATID, Isverified: -1, SearchValueSubCategory, MerchantName, Productname: ProductName, DID, CATEGORYRELATEDTO: '2',
  });
  const GetProductLists = mapRows(rows, PRODUCT_LIST_SINGLE_PROPS);
  const f = rows && rows[0];
  const TotalRecord = parseInt(f ? (f.totalcount !== undefined ? f.totalcount : f.recordcount) : 0, 10) || 0;

  const catidRaw = await db.scalar(DB, 'SELECT catid from PORTAL_MASTER WHERE PLID = @plid LIMIT 1', { plid: Plid });
  const catid = catidRaw === null || catidRaw === undefined ? '' : String(catidRaw);
  const PRODUCTCATEGORY = mapRows(await db.query(DB,
    "select pc.CATID,pc.CATNAME from PRODUCT_CATEGORY pc where pc.catactive=true and pc.CATID::varchar(100) = ANY(string_to_array(@catid, ','))", { catid }), ['CATID', 'CATNAME']);
  const subPRODUCTCATEGORY = mapRows(await db.query(DB, 'SELECT SCATID,SCATNAME FROM PRODUCT_SUBCATEGORY WHERE SCATACTIVE = true'), ['SCATID', 'SCATNAME']);
  const subSUBCATEGORY = mapRows(await db.query(DB,
    "SELECT KMID,KEYWORDNAME FROM KEYWORD_MASTER WHERE KACTIVE = true and CATID::varchar = ANY(string_to_array(@catid, ','))", { catid }), ['KMID', 'KEYWORDNAME']);
  const ViewBag = {
    category: PRODUCTCATEGORY, subcategory: subPRODUCTCATEGORY, subsubcategory: subSUBCATEGORY, CurrentPage: page, GridPageSize: MaxRows, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(), ProductName, SearchValue, SearchField, SubPrCode, SPRID: SPRIDs, NewAdd, MerchantName, SearchValueSubCategory,
    filtercategory, ddlstatus: MAINCATID, MPRID: MPRIDs, fromDate, toDate,
  };
  res.json({ Model: GetProductLists, ViewBag });
}));

module.exports = router;
