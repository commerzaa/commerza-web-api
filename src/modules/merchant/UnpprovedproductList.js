'use strict';
const DB = 'shopping';
/**
 * Port of Merchant Panel Controllers/CustomerPanel/UnpprovedproductList.cs (UnpprovedproductListController)
 * Prefix: /merchant   DB: Db_Shopping => 'shopping'
 * Actions: Index (1)  - the Merchant controller has no other actions (Franchise-only actions were removed)
 */
const express = require('express');
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();

// C# GetProductList (declared in AllProductlist.cs) serialised with its default values (value types => 0/false, strings => null)
const GETPRODUCTLIST = {
  IsVerified: 0, Breadth_cms: 0, CashOnDelivery: false, DAP: 0, DealsIds: null, Height_cms: 0, isnewarrival: false, IsStock: false, istopdeal: false,
  Length_cms: 0, maincatname: null, MerchantCode: null, MerchantId: 0, MerchantImage: null, MerchantName: null, MPRID: 0,
  Mvat: 0, Prcode: null, ProcurementSLA: 0, ProductCount: 0, ProductImages: null, ProductTitle: null, prodUnit: null, Qty: 0, ReplacementDay: 0,
  rowNumber: 0, sellMRP: 0, ShippingCharges: 0, SPRID: 0, status_Sub: 0, stockInQty: 0, stockNetQty: 0, stockOutQty: 0, SubPrCode: null, VatTitle: null,
  IsActive: false, JP: 0, BV: 0, PV: 0, Cashback_Per: 0, Rejectremark: null, Weight_kg: 0, Subcategory: null, Discountpercentage: 0, CreatedDate: null,
  ModifyDate: null, ismerchantstatus: 0, PrSKUCode: null, IS_OFFER: false,
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

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: merchant/unapproved-product
// auth ([SessionExpireCheck])
router.all(['/merchant/UnpprovedproductList/Index{/:id}', '/merchant/merchant/unapproved-product'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const PrCode = nn(p.PrCode);
  const SubPrCode = nn(p.SubPrCode);
  let MPRIDs = PrCode === '' ? 0 : toInt64(PrCode);
  let SPRIDs = SubPrCode === '' ? 0 : toInt64(SubPrCode);
  MPRIDs = nn(p.mprid) === '' ? MPRIDs : toInt64(p.mprid);
  SPRIDs = nn(p.sprid) === '' ? SPRIDs : toInt64(p.sprid);
  const Plid = Number(req.user.plid);
  const NewAdd = nn(p.NewAdd);
  const search = nn(p.search);
  const filtercategory = nn(p.filtercategory);
  const ProductName = nn(p.ProductName);
  let ddlstatus = optInt(p.ddlstatus); if (ddlstatus === null) ddlstatus = 1;

  const MaxRows = await UtilityClass.GridPageSize();
  let page = optInt(p.page); if (page === null) page = 1;
  // PORT-NOTE: @TotalCount OUT is read from the first result row (column "totalcount"); 0 when no rows.
  const rows = await proc(DB, 'usp_getapprovedproductlist', {
    startrowindex: page, maxrows: MaxRows, mprid: MPRIDs, sprid: SPRIDs, branchid: Plid, cat_code: filtercategory, searchfield: search,
    searchvalue: PrCode, status: ddlstatus, isverfied: 0,
  });
  const GetProductLists = shapeAs(rows, GETPRODUCTLIST);
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord: totalOf(rows, 'totalcount'), NoPerPage: await UtilityClass.GridNumbersPerPage(),
    ProductName, PrCode, SubPrCode, SPRID: SPRIDs, NewAdd, search, filtercategory, MPRID: MPRIDs,
  };
  return res.json({ view: '~/Views/UnpprovedproductList/Index.cshtml', Model: GetProductLists, ViewBag });
}));

module.exports = router;
