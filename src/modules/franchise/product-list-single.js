'use strict';
// Ported from Franchise/Controllers/CustomerPanel/Product_List_Single.cs  (DB: shopping - Franchise DataBaseContext = Db_Shopping)
// RouteConfig entry for this controller (merchant/Single-Listing) is commented out in RouteConfig.cs.
const express = require('express');
const router = express.Router();
const { query, scalar, exec, proc, procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const BASE = '/franchise/Product_List_Single';
const LIST = ['IsVerified', 'Breadth_cms', 'CashOnDelivery', 'DAP', 'DealsIds', 'Height_cms', 'isnewarrival', 'IsStock', 'istopdeal', 'Length_cms', 'maincatname', 'MerchantCode', 'MerchantId', 'MerchantImage', 'MerchantName', 'MPRID', 'Mvat', 'Prcode', 'ProcurementSLA', 'ProductCount', 'ProductImages', 'ProductTitle', 'prodUnit', 'Qty', 'ReplacementDay', 'rowNumber', 'sellMRP', 'ShippingCharges', 'SPRID', 'status_Sub', 'stockInQty', 'stockNetQty', 'stockOutQty', 'SubPrCode', 'VatTitle', 'IsActive', 'JP', 'BV', 'Rejectremark', 'Weight_kg', 'Subcategory', 'Discountpercentage', 'CreatedDate', 'ModifyDate', 'ismerchantstatus', 'EMAILID', 'PHONE'];
const DETAIL = ['SubPrCode', 'ShotDescription', 'FullDescription', 'KeyFeatures', 'DiscountPercentage', 'DAP', 'Weight_Kg', 'Length_cms', 'Breadth_cms', 'Height_cms', 'ShippingCharges', 'stockIn', 'SellMRP', 'IsVerified', 'ProductTitle', 'ismerchantstatus', 'Fullfilmentby', 'Procurementtype', 'ProcurementSLA', 'HSN', 'LuxuryCess', 'ManufacturerDetails', 'ImporterDetails', 'PackerDetails', 'CountryOrigin', 'VATTITLE', 'Specification', 'ProductImages', 'SubCategoryId', 'Unit', 'Attributedata', 'VATPERCENTAGE'];

// auth ([SessionExpireCheck])
router.all([`${BASE}/Index{/:id}`, BASE], auth, asyncHandler(async (req, res) => {
  let { SubPrCode, PrCode, mprid, sprid, ProductName, NewAdd, search, filtercategory } = req.p;
  let page = req.p.page;
  let MAINCATID = req.p.MAINCATID;
  let SUBCATID = req.p.SUBCATID;
  if (SUBCATID == null || SUBCATID === '') SUBCATID = 0;
  if (MAINCATID == null || MAINCATID === '') MAINCATID = -1;
  if (PrCode == null) PrCode = '';
  if (SubPrCode == null) SubPrCode = '';
  let MPRIDs = PrCode === '' ? 0 : parseInt(PrCode, 10);
  let SPRIDs = SubPrCode === '' ? 0 : parseInt(SubPrCode, 10);
  MPRIDs = (mprid === undefined || mprid === null || mprid === '') ? MPRIDs : parseInt(mprid, 10);
  SPRIDs = (sprid === undefined || sprid === null || sprid === '') ? SPRIDs : parseInt(sprid, 10);
  const Plid = req.user.did;
  if (NewAdd == null) NewAdd = '';
  if (search == null) search = '';
  if (filtercategory == null) filtercategory = '';
  if (ProductName == null) ProductName = '';
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1;
  const rows = await proc('shopping', 'usp_getall_productlist_single', {
    startrowindex: Number(page), maxrows: MaxRows, mprid: MPRIDs, sprid: SPRIDs, branchid: Plid,
    cat_code: filtercategory, searchfield: search, searchvalue: PrCode, status: Number(MAINCATID), subcatid: Number(SUBCATID),
  });
  // PORT-NOTE: @TotalCount OUT read from "totalcount" column of first row (0 if none)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  const catid = await scalar('shopping', 'select catid from portal_master where plid = @plid limit 1', { plid: String(Plid) });
  const PRODUCTCATEGORY = mapRows(await query('shopping',
    'select pc.catid, pc.catname from product_category pc where pc.catactive = true and pc.catid::text = any(string_to_array(@catid, \',\'))', { catid }), ['CATID', 'CATNAME']);
  const subPRODUCTCATEGORY = mapRows(await query('shopping', 'select scatid, scatname from product_subcategory where scatactive = true'), ['SCATID', 'SCATNAME']);
  const subSUBCATEGORY = mapRows(await query('shopping',
    'select kmid, keywordname from keyword_master where kactive = true and catid::text = any(string_to_array(@catid, \',\'))', { catid }), ['KMID', 'KEYWORDNAME']);
  res.json({
    Model: mapRows(rows, LIST),
    ViewBag: {
      category: PRODUCTCATEGORY, subcategory: subPRODUCTCATEGORY, subsubcategory: subSUBCATEGORY,
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      ProductName, PrCode, SubPrCode, SPRID: SPRIDs, NewAdd, search, filtercategory, ddlstatus: MAINCATID, MPRID: MPRIDs,
    },
  });
}));

// auth
router.all(`${BASE}/editallproductlist{/:id}`, auth, asyncHandler(async (req, res) => {
  // usp_updateallproductlist1 @mode,@SPRID,0,0,0,0,0,0,0,0,0,0,"","","",""  (positional literals => named defaults)
  const rows = await proc('shopping', 'usp_updateallproductlist1', {
    mode: 2, sprid: parseInt(req.p.SPRID, 10), isverified: 0, sellmrp: 0, discount: 0, dap: 0, stockin: 0,
    length: 0, breadth: 0, weight: 0, height: 0, shippingcharges: 0, shortdesc: '', keyfeatures: '', fulldesc: '',
  });
  res.json(mapRows(rows, DETAIL));
}));

// auth
router.all(`${BASE}/sendtoqc{/:id}`, auth, asyncHandler(async (req, res) => {
  await exec('shopping', 'update ims_subproduct_temp set ismerchantstatus = 4 where sprid = @sprid', { sprid: req.p.editSPRID });
  res.json('ok');
}));

// auth
router.all(`${BASE}/Updatesingleproduct{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let procurementtype = p.procurementtype;
  if (procurementtype === 'Select an Option') procurementtype = '0';
  const row = await procOne('shopping', 'usp_updatesingleproduct', {
    mode: 1, sprid: p.spid, isverified: parseInt(p.IsVerified, 10), sellmrp: p.mrp, discount: p.discount, dap: p.DAP,
    stockin: parseInt(p.Stock, 10), length: p.Length, breadth: p.Breadth, weight: p.Weight, height: p.Height,
    shippingcharges: p.ShippingCharges, shortdesc: p.ShortDesc, keyfeatures: p.KeyFeatures, fulldesc: p.fullDesc,
    image: '', manufacturingdetail: p.manufacturingdetail, importerdetail: p.importerdetail, packerdetail: p.packerdetail,
    gst: p.gst, procurementtype, fullfilmentseller: p.fullfilmentseller, procurementsla: p.procurementsla,
    hsn: p.hsn, luxurycess: p.luxurycess, countryorigin: '',
  });
  // PORT-NOTE: @strresult OUT read from "strresult" column
  res.json(String(row && row.strresult !== null && row.strresult !== undefined ? row.strresult : ''));
}));

module.exports = router;
