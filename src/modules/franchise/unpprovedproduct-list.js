'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/UnpprovedproductList.cs (UnpprovedproductListController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const { query, proc, procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

// C# model classes serialised with their default values (value types => 0/false, strings => null)
const GETPRODUCTLIST = {
  IsVerified: 0, Breadth_cms: 0, CashOnDelivery: false, DAP: 0, DealsIds: null, Height_cms: 0, isnewarrival: false, IsStock: false, istopdeal: false,
  Length_cms: 0, maincatname: null, MerchantCode: null, MerchantId: 0, MerchantImage: null, MerchantName: null, EMAILID: null, PHONE: null, MPRID: 0,
  Mvat: 0, Prcode: null, ProcurementSLA: 0, ProductCount: 0, ProductImages: null, ProductTitle: null, prodUnit: null, Qty: 0, ReplacementDay: 0,
  rowNumber: 0, sellMRP: 0, ShippingCharges: 0, SPRID: 0, status_Sub: 0, stockInQty: 0, stockNetQty: 0, stockOutQty: 0, SubPrCode: null, VatTitle: null,
  IsActive: false, JP: 0, BV: 0, Rejectremark: null, Weight_kg: 0, Subcategory: null, Discountpercentage: 0, CreatedDate: null,
};
const GETPRODUCTLIST1 = { subcatid: 0, SubCatName: null };
const GETPRODUCTLISTGST = { VCID: 0, VatPercValue: 0 };
const MERCHANTNAME = { serachText: null, totalreview: null, searchtype: null, areaname: null, pmid: null };
const ATTRLIST = { ROWNUMBER: 0, DID: 0, DIDNAME: null, VALUE: null };
const PRODUCTDETAIL = {
  SubPrCode: null, ShotDescription: null, FullDescription: null, KeyFeatures: null, DiscountPercentage: 0, DAP: 0, Weight_Kg: 0, Length_cms: 0, Breadth_cms: 0,
  Height_cms: 0, ShippingCharges: 0, stockIn: 0, SellMRP: 0, IsVerified: 0, ProductTitle: null, ismerchantstatus: 0, Fullfilmentby: 0, Procurementtype: 0,
  ProcurementSLA: 0, HSN: null, LuxuryCess: 0, ManufacturerDetails: null, ImporterDetails: null, PackerDetails: null, CountryOrigin: 0, VATTITLE: null,
  Specification: null, ProductImages: null, SubCategoryId: 0, Unit: null, Attributedata: null,
};
/** SqlQuery<T>: map (lower-case) columns onto the template's property names, defaults for missing columns */
function shapeAs(rows, template) {
  return (rows || []).map((r) => {
    const lower = {};
    for (const k of Object.keys(r)) lower[k.toLowerCase()] = r[k];
    const o = {};
    for (const p of Object.keys(template)) {
      const v = lower[p.toLowerCase()];
      o[p] = v === undefined || v === null ? template[p] : v;
    }
    return o;
  });
}
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const optInt = (v) => { const n = parseInt(v, 10); return v === undefined || v === null || v === '' || Number.isNaN(n) ? null : n; };
/** Convert.ToInt64(string) */
function toInt64(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return Number(s);
}
function totalOf(rows, name) {
  const f = rows && rows[0];
  if (!f) return 0;
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  const n = k === undefined ? NaN : parseInt(f[k], 10);
  return Number.isNaN(n) ? 0 : n;
}
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k !== undefined) return row[k];
  const first = Object.keys(row)[0];
  return first === undefined ? null : row[first];
}

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: franchisee/unapproved-product
// auth (legacy cast Session["Plid"] without a null check)
router.all(['/franchise/UnpprovedproductList/Index{/:id}', '/franchise/franchisee/unapproved-product'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const MerchantName = nn(p.MerchantName);
  const PrCode = nn(p.PrCode);
  const SubPrCode = nn(p.SubPrCode);
  const DID = Number(req.user.did);
  let MPRIDs = PrCode === '' ? 0 : toInt64(PrCode);
  let SPRIDs = SubPrCode === '' ? 0 : toInt64(SubPrCode);
  MPRIDs = nn(p.mprid) === '' ? MPRIDs : toInt64(p.mprid);
  SPRIDs = nn(p.sprid) === '' ? SPRIDs : toInt64(p.sprid);
  const Plid = 0;
  // legacy quirk: the "PrCode" emptiness decides whether the numeric filters are parsed (their values are then unused)
  let SearchValueMRPFrom = String(PrCode === '' ? 0 : toInt64(p.SearchValueMRPFrom));
  let SearchValueMRPTTO = String(PrCode === '' ? 0 : toInt64(p.SearchValueMRPTTO));
  let SearchValueDiscount = String(PrCode === '' ? 0 : toInt64(p.SearchValueDiscount));
  let SearchValueDAP = String(PrCode === '' ? 0 : toInt64(p.SearchValueDAP));
  const NewAdd = nn(p.NewAdd);
  const SearchField = nn(p.SearchField);
  const SearchValue = nn(p.SearchValue);
  const search = nn(p.search);
  const filtercategory = nn(p.filtercategory);
  const ProductName = nn(p.ProductName);
  let ddlstatus = optInt(p.ddlstatus); if (ddlstatus === null) ddlstatus = 1;
  let SearchValueSubCategory = nn(p.SearchValueSubCategory);
  if (SearchValueSubCategory.includes('amp;')) SearchValueSubCategory = SearchValueSubCategory.split('&amp;').join('&');
  const SearchValueTitle = nn(p.SearchValueTitle);

  const MaxRows = await UtilityClass.GridPageSize();
  let page = optInt(p.page); if (page === null) page = 1;
  // PORT-NOTE: @TotalCount OUT is read from the first result row (column "totalcount"); 0 when no rows.
  const rows = await proc(DB, 'usp_getapprovedproductlist_f', {
    startrowindex: page, maxrows: MaxRows, mprid: MPRIDs, sprid: SPRIDs, branchid: Plid, cat_code: filtercategory, searchfield: SearchField,
    searchvalue: SearchValue, status: ddlstatus, isverfied: 0, searchvaluesubcategory: SearchValueSubCategory, searchvaluetitle: SearchValueTitle,
    merchantname: MerchantName, productname: ProductName, did: DID, categoryrelatedto: '1',
  });
  const GetProductLists = shapeAs(rows, GETPRODUCTLIST);
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord: totalOf(rows, 'totalcount'), NoPerPage: await UtilityClass.GridNumbersPerPage(),
    ProductName, PrCode, SubPrCode, SPRID: SPRIDs, NewAdd, search, filtercategory, MPRID: MPRIDs, SearchField, SearchValue, MerchantName,
    SearchValueSubCategory,
  };
  return res.json({ view: '~/Views/UnpprovedproductList/Index.cshtml', Model: GetProductLists, ViewBag });
}));

// ---- GetAttributedata ----------------------------------------------------------------------------------
// auth
router.all('/franchise/UnpprovedproductList/GetAttributedata{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'getallattributelist', { subcatid: req.p.Subcatid });
  return res.json(shapeAs(rows, ATTRLIST));
}));

// ---- editallproductlist --------------------------------------------------------------------------------
// auth
router.all('/franchise/UnpprovedproductList/editallproductlist{/:id}', auth, asyncHandler(async (req, res) => {
  const SPRID = parseInt(req.p.SPRID, 10);
  if (Number.isNaN(SPRID)) throw new Error('The parameters dictionary contains a null entry for parameter \'SPRID\' of non-nullable type \'System.Int32\'.');
  // PORT-NOTE: legacy passed positional literals 0 x10 and four quote characters for @SHORTDESC,@KEYFEATURES,@FULLDESC,@STRRESULT; defaults (0 / '') are passed.
  const rows = await proc(DB, 'usp_updateallproductlist1', {
    mode: 2, sprid: SPRID, isverified: 0, sellmrp: 0, discount: 0, dap: 0, stockin: 0, length: 0, breadth: 0, weight: 0, height: 0, shippingcharges: 0,
    shortdesc: '', keyfeatures: '', fulldesc: '',
  });
  return res.json(shapeAs(rows, PRODUCTDETAIL));
}));

// ---- Objectserch ---------------------------------------------------------------------------------------
// auth
router.all('/franchise/UnpprovedproductList/Objectserch{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const PrCode = nn(p.PrCode);
  const SubPrCode = nn(p.SubPrCode);
  let MPRIDs = PrCode === '' ? 0 : toInt64(PrCode);
  let SPRIDs = SubPrCode === '' ? 0 : toInt64(SubPrCode);
  MPRIDs = nn(p.mprid) === '' ? MPRIDs : toInt64(p.mprid);
  SPRIDs = nn(p.sprid) === '' ? SPRIDs : toInt64(p.sprid);
  const Plid = 0;
  const SearchField = nn(p.SearchField);
  const SearchValue = nn(p.SearchValue);
  const filtercategory = nn(p.filtercategory);
  let ddlstatus = optInt(p.ddlstatus); if (ddlstatus === null) ddlstatus = 1;
  const MaxRows = await UtilityClass.GridPageSize();
  let page = optInt(p.page); if (page === null) page = 1;
  const rows = await proc(DB, 'usp_getapprovedproductlist', {
    startrowindex: page, maxrows: MaxRows, mprid: MPRIDs, sprid: SPRIDs, branchid: Plid, cat_code: filtercategory, searchfield: SearchField,
    searchvalue: SearchValue, status: ddlstatus, isverfied: 0,
  });
  return res.json(shapeAs(rows, GETPRODUCTLIST));
}));

const like = (v) => '%' + nn(v) + '%';

// ---- ObjectserchSub ------------------------------------------------------------------------------------
// auth
router.all('/franchise/UnpprovedproductList/ObjectserchSub{/:id}', auth, asyncHandler(async (req, res) => {
  await UtilityClass.GridPageSize();
  const rows = await query(DB, 'SELECT subcatid, subcatname FROM tbl_sub_category WHERE subcatname LIKE @sv', { sv: like(req.p.SearchValue) });
  return res.json(shapeAs(rows, GETPRODUCTLIST1));
}));

// ---- ObjectserchTitle ----------------------------------------------------------------------------------
// auth
router.all('/franchise/UnpprovedproductList/ObjectserchTitle{/:id}', auth, asyncHandler(async (req, res) => {
  await UtilityClass.GridPageSize();
  const rows = await query(DB, 'SELECT maincatid, maincatname FROM tbl_main_category WHERE maincatname LIKE @sv', { sv: like(req.p.SearchValue) });
  return res.json(shapeAs(rows, GETPRODUCTLIST));
}));

// ---- ObjectserchName -----------------------------------------------------------------------------------
// auth
router.all('/franchise/UnpprovedproductList/ObjectserchName{/:id}', auth, asyncHandler(async (req, res) => {
  await UtilityClass.GridPageSize();
  const rows = await query(DB, 'SELECT plid, fname FROM portal_login WHERE fname LIKE @sv', { sv: like(req.p.SearchValue) });
  return res.json(shapeAs(rows, MERCHANTNAME));
}));

// ---- ObjectserchSellMRP --------------------------------------------------------------------------------
// auth
router.all('/franchise/UnpprovedproductList/ObjectserchSellMRP{/:id}', auth, asyncHandler(async (req, res) => {
  await UtilityClass.GridPageSize();
  const rows = await query(DB, 'SELECT sprid, sellmrp FROM ims_subproduct WHERE sellmrp::text LIKE @sv', { sv: like(req.p.SearchValue) });
  return res.json(shapeAs(rows, GETPRODUCTLIST));
}));

// ---- ObjectserchDiscount -------------------------------------------------------------------------------
// auth
router.all('/franchise/UnpprovedproductList/ObjectserchDiscount{/:id}', auth, asyncHandler(async (req, res) => {
  await UtilityClass.GridPageSize();
  const rows = await query(DB, 'SELECT sprid, discountpercentage FROM ims_subproduct WHERE discountpercentage::text LIKE @sv', { sv: like(req.p.SearchValue) });
  return res.json(shapeAs(rows, GETPRODUCTLIST));
}));

// ---- ObjectserchDAP ------------------------------------------------------------------------------------
// auth
router.all('/franchise/UnpprovedproductList/ObjectserchDAP{/:id}', auth, asyncHandler(async (req, res) => {
  await UtilityClass.GridPageSize();
  const rows = await query(DB, 'SELECT plid, fname FROM portal_login WHERE fname LIKE @sv', { sv: like(req.p.SearchValue) });
  return res.json(shapeAs(rows, MERCHANTNAME));
}));

// ---- ObjectserchGST ------------------------------------------------------------------------------------
// auth
router.all('/franchise/UnpprovedproductList/ObjectserchGST{/:id}', auth, asyncHandler(async (req, res) => {
  await UtilityClass.GridPageSize();
  const rows = await query(DB, 'SELECT vcid, vatpercvalue FROM tbl_vat_categories WHERE vatpercvalue::text LIKE @sv', { sv: like(req.p.SearchValue) });
  return res.json(shapeAs(rows, GETPRODUCTLISTGST));
}));

// ---- Deleteproduct -------------------------------------------------------------------------------------
// auth
router.all('/franchise/UnpprovedproductList/Deleteproduct{/:id}', auth, asyncHandler(async (req, res) => {
  const id = req.p.id;
  const mprid = parseInt(id, 10);
  if (id === undefined || id === null || Number.isNaN(mprid)) throw new Error('Input string was not in a correct format.');
  const r = await procOne(DB, 'usp_delete_products_admin', { mprid });
  const v = outVal(r, 'strout');
  const status = parseInt(v, 10) || 0;
  return res.json(status);
}));

module.exports = router;
