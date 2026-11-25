'use strict';
/** Port of Shoping Portal Merchant Panel/Controllers/CustomerPanel/ApprovedproductList.cs (ApprovedproductListController). DB: 'shopping' (Db_Shopping) */
const express = require('express');
const { proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const P = '/merchant/ApprovedproductList';
const pint = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const totalOf = (rows, name = 'totalcount') => { const f = rows && rows[0]; if (!f) return 0; const k = Object.keys(f).find((x) => x.toLowerCase() === name); return k === undefined ? 0 : (parseInt(f[k], 10) || 0); };
// GetProductList (declared in AllProductlist.cs of the Merchant Panel)
const PROPS = ['IsVerified', 'Breadth_cms', 'CashOnDelivery', 'DAP', 'DealsIds', 'Height_cms', 'isnewarrival', 'IsStock', 'istopdeal', 'Length_cms',
  'maincatname', 'MerchantCode', 'MerchantId', 'MerchantImage', 'MerchantName', 'MPRID', 'Mvat', 'Prcode', 'ProcurementSLA', 'ProductCount',
  'ProductImages', 'ProductTitle', 'prodUnit', 'Qty', 'ReplacementDay', 'rowNumber', 'sellMRP', 'ShippingCharges', 'SPRID', 'status_Sub', 'stockInQty',
  'stockNetQty', 'stockOutQty', 'SubPrCode', 'VatTitle', 'IsActive', 'JP', 'BV', 'PV', 'Cashback_Per', 'Rejectremark', 'Weight_kg', 'Subcategory',
  'Discountpercentage', 'CreatedDate', 'ModifyDate', 'ismerchantstatus', 'PrSKUCode', 'IS_OFFER'];

// ---- Index ---------------------------------------------------------------------------------------------
const indexHandler = asyncHandler(async (req, res) => {
  const p = req.p;
  let { SubPrCode, SearchValueSubCategory, PrCode, ProductName, NewAdd, search, filtercategory } = p;
  let page = pint(p.page), ddlstatus = pint(p.ddlstatus);
  if (PrCode == null) PrCode = '';
  if (SubPrCode == null) SubPrCode = '';
  if (SearchValueSubCategory == null) SearchValueSubCategory = '';
  if (SearchValueSubCategory.includes('amp;')) SearchValueSubCategory = SearchValueSubCategory.split('&amp;').join('&');
  if (ProductName == null) ProductName = '';
  const Plid = Math.trunc(Number(req.user.plid));
  if (NewAdd == null) NewAdd = '';
  if (search == null) search = '';
  if (filtercategory == null) filtercategory = '';
  if (ddlstatus == null) ddlstatus = 1;
  const SPRID = 0;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_getapprovedproductlist1', {
    startrowindex: page, maxrows: MaxRows, mprid: SPRID, sprid: SPRID, branchid: Plid, cat_code: filtercategory, searchfield: search, searchvalue: SubPrCode,
    status: ddlstatus, isverfied: 1, searchvaluesubcategory: SearchValueSubCategory, searchvaluetitle: ProductName,
  });
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const GetProductLists = mapRows(rows, PROPS);
  const ViewBag = {
    SearchValueSubCategory, CurrentPage: page, GridPageSize: MaxRows, TotalRecord: totalOf(rows), NoPerPage: await UtilityClass.GridNumbersPerPage(),
    ProductName, PrCode, SubPrCode, NewAdd, search, filtercategory,
  };
  res.json({ Model: GetProductLists, ViewBag });
});
// auth
router.all(P + '/Index{/:id}', auth, indexHandler);
// route-config: merchant/approved-product
router.all('/merchant/merchant/approved-product', auth, indexHandler);

// ---- DeleteproductBluckList --------------------------------------------------------------------------------
// auth (legacy had no session check but deletes merchant products)
router.all(P + '/DeleteproductBluckList{/:id}', auth, asyncHandler(async (req, res) => {
  const n = Number(String(req.p.SPRID).trim());
  if (!Number.isInteger(n)) throw new Error('Input string was not in a correct format.');
  const row = await procOne(DB, 'usp_delete_products_merchantside', { sprid: n, producttype: 'BlukList product' });
  const k = row ? Object.keys(row).find((x) => x.toLowerCase() === 'strout') : undefined;
  const raw = row ? (k !== undefined ? row[k] : row[Object.keys(row)[0]]) : null;
  const status = parseInt(raw === null || raw === undefined ? 0 : raw, 10) || 0;
  res.json(status);
}));

module.exports = router;
