'use strict';
/** Port of Franchise/Controllers/CustomerPanel/ApprovedproductList.cs. DB: 'shopping' */
const express = require('express');
const { query, scalar, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const router = express.Router();
const DB = 'shopping';
const s = (v) => (v === null || v === undefined ? '' : String(v));
const pint = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const totalOf = (rows, name = 'totalcount') => { const f = rows && rows[0]; if (!f) return 0; const k = Object.keys(f).find((x) => x.toLowerCase() === name); return k === undefined ? 0 : (parseInt(f[k], 10) || 0); };
const PROPS = ['IsVerified', 'Breadth_cms', 'CashOnDelivery', 'DAP', 'DealsIds', 'Height_cms', 'isnewarrival', 'IsStock', 'istopdeal', 'Length_cms',
  'maincatname', 'MerchantCode', 'MerchantId', 'MerchantImage', 'MerchantName', 'EMAILID', 'PHONE', 'MPRID', 'Mvat', 'Prcode', 'ProcurementSLA', 'ProductCount',
  'ProductImages', 'ProductTitle', 'prodUnit', 'Qty', 'ReplacementDay', 'rowNumber', 'sellMRP', 'ShippingCharges', 'SPRID', 'status_Sub', 'stockInQty',
  'stockNetQty', 'stockOutQty', 'SubPrCode', 'VatTitle', 'IsActive', 'JP', 'BV', 'Rejectremark', 'Weight_kg', 'Subcategory', 'Discountpercentage',
  'CreatedDate', 'ModifyDate', 'ismerchantstatus'];
// PORT-NOTE: GetProductList class is declared in AllProductlist.cs; property list reproduced here.
const toInt64 = (v) => { const n = Number(v); if (!/^\s*[-+]?\d+\s*$/.test(String(v)) || Number.isNaN(n)) throw new Error('Input string was not in a correct format.'); return n; };

// auth
router.all('/franchise/ApprovedproductList/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let { SubPrCode, PrCode, ProductName, NewAdd, search, filtercategory } = p;
  const mprid = p.mprid, sprid = p.sprid;
  let page = pint(p.page), ddlstatus = pint(p.ddlstatus);
  // C#: if (Request.QueryString != null) search = Request.QueryString["REQUESTID"];
  search = req.query.REQUESTID;
  if (PrCode == null) PrCode = '';
  if (SubPrCode == null) SubPrCode = '';
  let MPRIDs = PrCode === '' ? 0 : toInt64(PrCode);
  let SPRIDs = SubPrCode === '' ? 0 : toInt64(SubPrCode);
  MPRIDs = (mprid === undefined || mprid === null || mprid === '') ? MPRIDs : toInt64(mprid);
  SPRIDs = (sprid === undefined || sprid === null || sprid === '') ? SPRIDs : toInt64(sprid);
  const Plid = Math.trunc(Number(req.user.did));
  if (NewAdd == null) NewAdd = '';
  if (search == null) search = '';
  if (filtercategory == null) filtercategory = '';
  if (ProductName == null) ProductName = '';
  if (ddlstatus == null) ddlstatus = 1;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_getapprovedproductlist1', {
    startrowindex: page, maxrows: MaxRows, mprid: MPRIDs, sprid: SPRIDs, branchid: Plid, cat_code: filtercategory, searchfield: search, searchvalue: PrCode,
    status: ddlstatus, isverfied: 1,
  });
  const GetProductLists = mapRows(rows, PROPS);
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord: totalOf(rows), NoPerPage: await UtilityClass.GridNumbersPerPage(), ProductName, PrCode, SubPrCode,
    SPRID: SPRIDs, NewAdd, search, filtercategory, MPRID: MPRIDs,
  };
  res.json({ Model: GetProductLists, ViewBag });
}));

module.exports = router;
