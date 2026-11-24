'use strict';
// Ported from Franchise\Controllers\CustomerPanel\QCFailed_List.cs  (database: shopping - Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const P = '/franchise/QCFailed_List';

const PRODUCT_LIST_SINGLE = ['IsVerified', 'Breadth_cms', 'CashOnDelivery', 'DAP', 'DealsIds', 'Height_cms', 'isnewarrival', 'IsStock', 'istopdeal',
  'Length_cms', 'maincatname', 'MerchantCode', 'MerchantId', 'MerchantImage', 'MerchantName', 'MPRID', 'Mvat', 'Prcode', 'ProcurementSLA',
  'ProductCount', 'ProductImages', 'ProductTitle', 'prodUnit', 'Qty', 'ReplacementDay', 'rowNumber', 'sellMRP', 'ShippingCharges', 'SPRID',
  'status_Sub', 'stockInQty', 'stockNetQty', 'stockOutQty', 'SubPrCode', 'VatTitle', 'IsActive', 'JP', 'BV', 'Rejectremark', 'Weight_kg',
  'Subcategory', 'Discountpercentage', 'CreatedDate', 'ModifyDate', 'ismerchantstatus', 'EMAILID', 'PHONE'];

const toInt64 = (s) => { const t = String(s).trim(); if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.'); return parseInt(t, 10); };
const isNullOrEmpty = (s) => s === null || s === undefined || s === '';

// auth
// route-config: franchisee/QCFailed-Listing
router.all([P + '/Index{/:id}', '/franchise/franchisee/QCFailed-Listing'], auth, asyncHandler(async (req, res) => {
  let { SubPrCode, MerchantName, SearchValueSubCategory, SearchValue, fromDate, toDate, mprid, sprid, ProductName, NewAdd, SearchField,
    filtercategory, page, MAINCATID, SUBCATID } = req.p;
  if (SearchValueSubCategory == null) SearchValueSubCategory = '';
  // else: SearchValueSubCategory.Replace("'", "''") result was discarded in legacy
  if (SearchValueSubCategory.includes('amp;')) SearchValueSubCategory = SearchValueSubCategory.split('&amp;').join('&');
  if (MerchantName == null) MerchantName = '';
  SUBCATID = (SUBCATID == null || SUBCATID === '') ? 0 : parseInt(SUBCATID, 10);
  MAINCATID = (MAINCATID == null || MAINCATID === '') ? 2 : parseInt(MAINCATID, 10);
  if (SearchValue == null) SearchValue = '';
  if (SubPrCode == null) SubPrCode = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  let MPRIDs = 0; let SPRIDs = 0;
  SPRIDs = isNullOrEmpty(SubPrCode) ? 0 : toInt64(SubPrCode);
  MPRIDs = isNullOrEmpty(mprid) ? MPRIDs : toInt64(mprid);
  SPRIDs = isNullOrEmpty(sprid) ? SPRIDs : toInt64(sprid);
  const Plid = 0;
  if (NewAdd == null) NewAdd = '';
  if (SearchField == null) SearchField = '';
  if (filtercategory == null) filtercategory = '';
  if (ProductName == null) ProductName = '';
  const DID = req.user.did;

  const MaxRows = await UtilityClass.GridPageSize();
  page = (page == null || page === '') ? 1 : parseInt(page, 10);
  const rows = await db.proc('shopping', 'usp_getall_status_productlist_f', {
    StartRowIndex: page, MaxRows, MPRID: MPRIDs, SPRID: SPRIDs, BranchId: Plid, cat_code: filtercategory, SearchField, SearchValue,
    FROMDATE: fromDate, TODATE: toDate, Status: 2, SUBCATID, Isverified: -1, SearchValueSubCategory, MerchantName,
    Productname: ProductName, DID, CATEGORYRELATEDTO: '1',
  });
  const GetProductLists = mapRows(rows, PRODUCT_LIST_SINGLE);
  const tc = rows[0] ? Object.keys(rows[0]).find((k) => k.toLowerCase() === 'totalcount') : undefined;
  const TotalRecord = tc !== undefined ? parseInt(rows[0][tc], 10) : 0;

  const cr = await db.queryOne('shopping', 'SELECT catid from PORTAL_MASTER WHERE PLID = @plid limit 1', { plid: String(Plid) });
  const catid = cr ? cr.catid : null;
  const PRODUCTCATEGORY = mapRows(await db.query('shopping',
    "select pc.CATID,pc.CATNAME from PRODUCT_CATEGORY pc where pc.catactive=true and pc.CATID::text = any(string_to_array(coalesce(@catid,''), ','))", { catid }),
  ['CATID', 'CATNAME']);
  const subPRODUCTCATEGORY = mapRows(await db.query('shopping', 'SELECT SCATID,SCATNAME FROM PRODUCT_SUBCATEGORY WHERE SCATACTIVE = true'), ['SCATID', 'SCATNAME']);
  const subSUBCATEGORY = mapRows(await db.query('shopping',
    "SELECT KMID,KEYWORDNAME FROM KEYWORD_MASTER WHERE KACTIVE = true and CATID::text = any(string_to_array(coalesce(@catid,''), ','))", { catid }),
  ['KMID', 'KEYWORDNAME']);
  const ViewBag = {
    category: PRODUCTCATEGORY,
    subcategory: subPRODUCTCATEGORY,
    subsubcategory: subSUBCATEGORY,
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    ProductName, SearchValue, SearchField, SubPrCode,
    SPRID: SPRIDs, NewAdd, MerchantName, SearchValueSubCategory, filtercategory,
    ddlstatus: MAINCATID, MPRID: MPRIDs, fromDate, toDate,
  };
  res.json({ Model: GetProductLists, ViewBag, ...ViewBag });
}));

// auth
router.all(P + '/ObjectserchSub{/:id}', auth, asyncHandler(async (req, res) => {
  const MaxRows = await UtilityClass.GridPageSize(); // read in legacy, unused
  const rows = await db.query('shopping', "select subcatid, SubCatName from tbl_Sub_Category where SubCatName like '%' || @v || '%'", { v: req.p.SearchValue == null ? '' : req.p.SearchValue });
  res.json(mapRows(rows, ['subcatid', 'SubCatName']));
}));

// auth
router.all(P + '/ObjectserchName{/:id}', auth, asyncHandler(async (req, res) => {
  const MaxRows = await UtilityClass.GridPageSize(); // read in legacy, unused
  const rows = await db.query('shopping', "SELECT PLID,FNAME FROM PORTAL_LOGIN WHERE FNAME LIKE '%' || @v || '%'", { v: req.p.SearchValue == null ? '' : req.p.SearchValue });
  // PORT-NOTE: legacy materialises into class MerchantName (serachText,totalreview,searchtype,areaname,pmid) so PLID/FNAME are not serialised; kept as is.
  res.json(mapRows(rows, ['serachText', 'totalreview', 'searchtype', 'areaname', 'pmid']));
}));

module.exports = router;
