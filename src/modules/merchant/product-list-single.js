'use strict';
/**
 * Port of Merchant Panel Controllers/CustomerPanel/Product_List_Single.cs (Product_List_SingleController) - 12 actions
 * DB: Db_Shopping => 'shopping'
 * Actions: Index, editallproductlist, sendtoqc, ObjectserchSubCategory, DataSearchsubcat, Updatesingleproduct, OnlyUpdatesingleproduct,
 *          GetAttributedata, saveImage, DeleteproductsingleList, _Offer, SaveOffer
 */
const express = require('express');
const path = require('path');
const { query, scalar, exec, proc, procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const config = require('../../config');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const BASE = '/merchant/Product_List_Single';

const s = (v) => (v === null || v === undefined ? '' : String(v));
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const xmlEsc = (v) => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** DataSet.GetXml() equivalent ({tableName: rows[]}; NULL columns omitted) */
function getXml(ds) {
  let x = '<NewDataSet>';
  for (const name of Object.keys(ds)) {
    for (const r of ds[name]) {
      x += `<${name}>`;
      for (const k of Object.keys(r)) if (r[k] !== null && r[k] !== undefined) x += `<${k}>${xmlEsc(r[k] instanceof Date ? r[k].toISOString() : r[k])}</${k}>`;
      x += `</${name}>`;
    }
  }
  return x + '</NewDataSet>';
}
/** non-null string argument (C# string.Replace on null => NullReferenceException) */
const nn = (v) => { if (v === null || v === undefined) throw NRE(); return String(v); };
const replAll = (str, a, b) => str.split(a).join(b);

const LIST = ['IsVerified', 'Breadth_cms', 'CashOnDelivery', 'DAP', 'DealsIds', 'Height_cms', 'isnewarrival', 'IsStock', 'istopdeal', 'Length_cms', 'maincatname', 'MerchantCode', 'MerchantId', 'MerchantImage', 'MerchantName', 'MPRID', 'Mvat', 'Prcode', 'ProcurementSLA', 'ProductCount', 'ProductImages', 'ProductTitle', 'prodUnit', 'Qty', 'ReplacementDay', 'rowNumber', 'sellMRP', 'ShippingCharges', 'SPRID', 'status_Sub', 'stockInQty', 'stockNetQty', 'stockOutQty', 'SubPrCode', 'VatTitle', 'IsActive', 'JP', 'BV', 'Rejectremark', 'Weight_kg', 'Subcategory', 'Discountpercentage', 'CreatedDate', 'ModifyDate', 'ismerchantstatus', 'is_Offer_available'];
const DETAIL = ['SPRID', 'SubPrCode', 'ShotDescription', 'FullDescription', 'KeyFeatures', 'DiscountPercentage', 'DAP', 'Weight_Kg', 'Length_cms', 'Breadth_cms', 'Height_cms', 'ShippingCharges', 'stockIn', 'SellMRP', 'IsVerified', 'ProductTitle', 'ismerchantstatus', 'Fullfilmentby', 'Procurementtype', 'ProcurementSLA', 'HSN', 'LuxuryCess', 'ManufacturerDetails', 'ImporterDetails', 'PackerDetails', 'CountryOrigin', 'VATTITLE', 'Specification', 'ProductImages', 'SubCategoryId', 'Unit', 'Attributedata', 'VATPERCENTAGE', 'BV', 'PV', 'Cashback_Per', 'ACTIVATIONPV_PER'];
const OFFER = ['OPID', 'PRODUCT_ID', 'PRODUCT_NAME', 'OFFER_MST_ID', 'OFFER_TITLE', 'OFFER_START', 'OFFER_END', 'START_TIME', 'END_TIME', 'IS_ACTIVE', 'INSERTED_ON', 'OFFER_PRICE', 'OFFER_DIS_PERCENTAGE'];
const ATTR = ['ROWNUMBER', 'DID', 'DIDNAME', 'VALUE', 'isSelectiveAttr'];

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: merchant/Single-Listing
// auth ([SessionExpireCheck])
router.all([`${BASE}/Index{/:id}`, BASE, '/merchant/Single-Listing', '/merchant/merchant/Single-Listing'], auth, asyncHandler(async (req, res) => {
  let { SubPrCode, Productcode, PrCode, fromDate, toDate, mprid, sprid, ProductName, NewAdd, search, filtercategory, SearchValueSubCategory } = req.p;
  let page = req.p.page;
  let MAINCATID = req.p.MAINCATID;
  let SUBCATID = req.p.SUBCATID;
  let Isverified = req.p.Isverified;
  const isNull = (v) => v === undefined || v === null || v === '';
  if (isNull(SUBCATID)) SUBCATID = 0;
  if (isNull(MAINCATID)) MAINCATID = -1;
  if (Productcode == null) Productcode = '';
  if (PrCode == null) PrCode = '';
  if (SearchValueSubCategory == null) SearchValueSubCategory = '';
  else SearchValueSubCategory = SearchValueSubCategory; // legacy: SearchValueSubCategory.Replace("'", "''") result is discarded
  if (SearchValueSubCategory.includes('amp;')) SearchValueSubCategory = replAll(SearchValueSubCategory, '&amp;', '&');
  if (isNull(Isverified)) Isverified = 0;
  if (SubPrCode == null) SubPrCode = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  let MPRIDs = PrCode === '' ? 0 : parseInt(PrCode, 10);
  let SPRIDs = SubPrCode === '' ? 0 : parseInt(SubPrCode, 10);
  MPRIDs = isNull(mprid) ? MPRIDs : parseInt(mprid, 10);
  SPRIDs = isNull(sprid) ? SPRIDs : parseInt(sprid, 10);
  const Plid = Number(req.user.plid);
  if (NewAdd == null) NewAdd = '';
  if (search == null) search = '';
  if (filtercategory == null) filtercategory = '';
  if (ProductName == null) ProductName = ''; // else legacy ProductName.Replace("'", "''") result is discarded
  const MaxRows = await UtilityClass.GridPageSize();
  if (isNull(page)) page = 1;
  page = Number(page);
  const rows = await proc(DB, 'usp_getall_productlist_single_temp', {
    startrowindex: page, maxrows: MaxRows, mprid: MPRIDs, sprid: SPRIDs, branchid: Plid, cat_code: filtercategory,
    searchfield: search, searchvalue: Productcode, fromdate: fromDate, todate: toDate, status: Number(MAINCATID),
    subcatid: Number(SUBCATID), isverified: Number(Isverified), searchvaluesubcategory: SearchValueSubCategory, merchantname: '', productname: ProductName,
  });
  // PORT-NOTE: @TotalCount OUT read from the "totalcount" column of the first row (0 if none)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  const catidRaw = await scalar(DB, 'SELECT catid from portal_master WHERE plid = @plid LIMIT 1', { plid: Plid });
  const catid = catidRaw === null || catidRaw === undefined ? '' : String(catidRaw);
  const PRODUCTCATEGORY = mapRows(await query(DB,
    "select pc.catid, pc.catname from product_category pc where pc.catactive = true and pc.catid::text = any(string_to_array(@catid, ','))", { catid }), ['CATID', 'CATNAME']);
  const subPRODUCTCATEGORY = mapRows(await query(DB, 'SELECT scatid,scatname FROM product_subcategory WHERE scatactive = true'), ['SCATID', 'SCATNAME']);
  const subSUBCATEGORY = mapRows(await query(DB,
    "SELECT kmid,keywordname FROM keyword_master WHERE kactive = true and catid::text = any(string_to_array(@catid, ','))", { catid }), ['KMID', 'KEYWORDNAME']);
  res.json({
    view: '~/Views/Product_List_Single/Index.cshtml',
    Model: mapRows(rows, LIST),
    ViewBag: {
      category: PRODUCTCATEGORY, subcategory: subPRODUCTCATEGORY, subsubcategory: subSUBCATEGORY,
      ProductName, CurrentPage: page, GridPageSize: MaxRows, TotalRecord, SearchValueSubCategory,
      NoPerPage: await UtilityClass.GridNumbersPerPage(),
      PrCode, SubPrCode, SPRID: SPRIDs, NewAdd, search, filtercategory, ddlstatus: Number(MAINCATID), MPRID: MPRIDs, Productcode,
    },
  });
}));

// ---- editallproductlist --------------------------------------------------------------------------------
// auth (legacy: no session check)
router.all(`${BASE}/editallproductlist{/:id}`, auth, asyncHandler(async (req, res) => {
  // USP_UPDATEALLPRODUCTLIST1 @mode,@SPRID,0 x10,"","","","" (positional literals => named defaults)
  const rows = await proc(DB, 'usp_updateallproductlist1', {
    mode: 2, sprid: parseInt(req.p.SPRID, 10), isverified: 0, sellmrp: 0, discount: 0, dap: 0, stockin: 0,
    length: 0, breadth: 0, weight: 0, height: 0, shippingcharges: 0, shortdesc: '', keyfeatures: '', fulldesc: '',
  });
  res.json(mapRows(rows, DETAIL));
}));

// ---- sendtoqc ------------------------------------------------------------------------------------------
// auth
router.all(`${BASE}/sendtoqc{/:id}`, auth, asyncHandler(async (req, res) => {
  await exec(DB, 'update ims_subproduct_temp set ismerchantstatus = 4 where sprid = @sprid', { sprid: req.p.editSPRID });
  res.json('ok');
}));

// ---- ObjectserchSubCategory ----------------------------------------------------------------------------
// auth
router.all(`${BASE}/ObjectserchSubCategory{/:id}`, auth, asyncHandler(async (req, res) => {
  const SearchText = replAll(nn(req.p.SearchText), '+apostopis', "'");
  const ds = await UtilityClass.GetDataSetSPNamed([{ ParameterName: '@serchItem', Value: SearchText }], 'usp_GetDataSearch_SubCategory_temp', 'dsData');
  res.json(getXml(ds));
}));

// ---- DataSearchsubcat ----------------------------------------------------------------------------------
// auth
router.all(`${BASE}/DataSearchsubcat{/:id}`, auth, asyncHandler(async (req, res) => {
  const SearchText = replAll(nn(req.p.SearchText), '+apostopis', "'");
  const ds = await UtilityClass.GetDataSetSPNamed([{ ParameterName: '@serchItem', Value: SearchText }], 'usp_GetDataSearch_subCategory', 'dsData');
  res.json(getXml(ds));
}));

// ---- saveImage (public string method, also internal helper) ---------------------------------------------
async function saveImage(imgecode, titlename, SellerCode) {
  const OriginalImageFolder = config.app.OriginalProductImage || '';
  const SemiLargeImageFolder = config.app.SemiLargeProductImage || '';
  const ThumbNailImageFolder = config.app.ThumbNailProductImage || '';
  titlename = nn(titlename).replace(/[^0-9a-zA-Z]+/g, '');
  titlename = titlename.replace(/[\s+]/g, '');
  let returnfilename = '';
  if (titlename.length > 5) titlename = titlename.substring(0, 4);
  const getcolltionimage = nn(imgecode).split('^');
  for (const items of getcolltionimage) {
    const IdForAppend = SellerCode + '_' + titlename.trim();
    if (items.trim() !== '' && items.includes('base64,')) {
      const getnewfilename = await UtilityClass.ImageUploadMasterMethodECommNew(items, OriginalImageFolder, SemiLargeImageFolder, ThumbNailImageFolder, UtilityClass.ImageMode.Both, IdForAppend);
      if (s(getnewfilename).trim() !== '') {
        if (returnfilename.trim() === '') returnfilename = getnewfilename;
        else returnfilename = returnfilename + '^' + getnewfilename;
      }
    } else if (items.trim() !== '' && !items.includes('base64,')) {
      const fname = path.win32.basename(items);
      if (returnfilename.trim() === '') returnfilename = fname;
      else returnfilename = returnfilename + '^' + fname;
    }
  }
  return returnfilename;
}
// auth (legacy: public string action)
router.all(`${BASE}/saveImage{/:id}`, auth, asyncHandler(async (req, res) => {
  res.send(await saveImage(req.p.imgecode, req.p.titlename, req.p.SellerCode));
}));

// ---- Updatesingleproduct / OnlyUpdatesingleproduct -----------------------------------------------------
function updateHandler(procName) {
  return asyncHandler(async (req, res) => {
    const p = req.p;
    let fullDesc = nn(p.fullDesc);
    fullDesc = replAll(fullDesc, '+#!#+', '<');
    fullDesc = replAll(fullDesc, '+!#!+', '>');
    let specification = nn(p.specification);
    specification = replAll(specification, '+#!#+', '<');
    specification = replAll(specification, '+!#!+', '>');
    let KeyFeatures = nn(p.KeyFeatures);
    KeyFeatures = replAll(KeyFeatures, '+#!#+', '<');
    KeyFeatures = replAll(KeyFeatures, '+!#!+', '>');

    const Plid = parseInt(req.user.plid, 10);
    let procurementtype = p.procurementtype;
    if (procurementtype === 'Select an Option') procurementtype = '0';
    const imageByteCode = replAll(nn(p.imageByteCode), 'hariOmNamahshivay', '^');
    const SellerCode = String(Plid);
    const productimagename = await saveImage(imageByteCode, p.prodTitle, SellerCode);

    const row = await procOne(DB, procName, {
      mode: 1, sprid: p.spid, isverified: parseInt(p.IsVerified, 10), sellmrp: p.mrp, discount: p.discount, dap: p.DAP,
      stockin: parseInt(p.Stock, 10), length: p.Length, breadth: p.Breadth, weight: p.Weight, height: p.Height,
      shippingcharges: p.ShippingCharges, shortdesc: p.ShortDesc, keyfeatures: KeyFeatures, fulldesc: fullDesc,
      image: '', manufacturingdetail: p.manufacturingdetail, importerdetail: p.importerdetail, packerdetail: p.packerdetail,
      gst: p.gst, procurementtype, fullfilmentseller: p.fullfilmentseller, procurementsla: p.procurementsla,
      hsn: p.hsn, luxurycess: p.luxurycess, countryorigin: '', specification, prodimages: productimagename,
      allattributes: p.Attributes, produnit: p.prodUnit,
    });
    // PORT-NOTE: @strresult OUT read from the "strresult" column of the result row
    res.json(s(row ? row.strresult : ''));
  });
}
// auth
router.all(`${BASE}/Updatesingleproduct{/:id}`, auth, updateHandler('usp_updatesingleproduct'));
// auth
// PORT-NOTE: stored procedure USP_ONLYUPDATESINGLEPRODUCT is not present in dbshopping.sql; called by name with the same parameters as usp_updatesingleproduct.
router.all(`${BASE}/OnlyUpdatesingleproduct{/:id}`, auth, updateHandler('usp_onlyupdatesingleproduct'));

// ---- GetAttributedata ----------------------------------------------------------------------------------
// auth
router.all(`${BASE}/GetAttributedata{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'getallattributelist', { subcatid: req.p.Subcatid });
  res.json(mapRows(rows, ATTR));
}));

// ---- DeleteproductsingleList ---------------------------------------------------------------------------
// auth
router.all(`${BASE}/DeleteproductsingleList{/:id}`, auth, asyncHandler(async (req, res) => {
  const r = await procOne(DB, 'usp_delete_products_merchantside', { sprid: parseInt(req.p.SPRID, 10), producttype: 'Single product' });
  // PORT-NOTE: @STROUT OUT read from the "strout" column of the result row
  const status = parseInt(r ? r.strout : 0, 10);
  res.json(Number.isNaN(status) ? 0 : status);
}));

// ---- _Offer (PartialView) ------------------------------------------------------------------------------
// auth
router.all(`${BASE}/_Offer{/:id}`, auth, asyncHandler(async (req, res) => {
  const SPRID = req.p.SPRID;
  const OfferTypelist = mapRows(await query(DB, 'Select CAST(offerid as varchar) as value, offer_title AS text from tbl_offer_mst where is_active=true'), ['ID', 'VALUE', 'TEXT']);
  const pobj = mapRows(await proc(DB, 'usp_updateallproductlist', {
    mode: 2, sprid: SPRID, isverified: 0, sellmrp: 0, discount: 0, dap: 0, stockin: 0,
    length: 0, breadth: 0, weight: 0, height: 0, shippingcharges: 0, shortdesc: '', keyfeatures: '', fulldesc: '',
  }), DETAIL);
  const offerRows = await proc(DB, 'usp_manage_offer', {
    flag: 'Single_Offer_data', product_id: SPRID !== undefined && SPRID !== null && SPRID !== '' ? parseInt(SPRID, 10) : 0,
    product_name: '', offer_title: '', offer_mst_id: 0, offer_start: '1990-01-01', offer_end: '1990-01-01', is_active: false,
    offer_price: 0, offer_discount_per: 0,
  });
  const offer = mapRows(offerRows, OFFER)[0] || null;
  if (offer !== null) {
    for (const item of pobj) item.offer = offer;
  }
  res.json({ view: '_Offer', Model: pobj, ViewBag: { OfferTypelist } });
}));

// ---- SaveOffer (POST) ----------------------------------------------------------------------------------
// auth
router.post(`${BASE}/SaveOffer{/:id}`, auth, asyncHandler(async (req, res) => {
  const model = Object.assign({}, req.body || {});
  const dt = (v) => {
    const d = new Date(v);
    if (v === undefined || v === null || Number.isNaN(d.getTime())) throw new Error('String was not recognized as a valid DateTime.');
    return d;
  };
  const fmt = (d) => { const p2 = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };
  const row = await procOne(DB, 'usp_manage_offer', {
    flag: 'ADD_OFFER', product_id: model.PRODUCT_ID, product_name: model.PRODUCT_NAME ? model.PRODUCT_NAME : '',
    offer_title: model.OFFER_TITLE, offer_mst_id: model.OFFER_MST_ID,
    // PORT-NOTE: the legacy SqlDbType.DateTime values were implicitly converted to nvarchar(50) by SQL Server; sent here as 'yyyy-MM-dd HH:mm:ss'
    offer_start: fmt(dt(model.OFFER_START)), offer_end: fmt(dt(model.OFFER_END)),
    is_active: model.IS_ACTIVE, offer_price: model.OFFER_PRICE, offer_discount_per: model.OFFER_DIS_PERCENTAGE,
  });
  // PORT-NOTE: @OUT_RESULT OUT read from the "out_result" column of the result row
  const status = row && row.out_result !== undefined && row.out_result !== null ? String(row.out_result) : null;
  if (status !== null) {
    // legacy builds a pushNotificationmoel here (Title "Got C-Point", sendtype "all") but sendPushnotification is commented out => no notification sent
  }
  res.json(status);
}));

module.exports = router;
