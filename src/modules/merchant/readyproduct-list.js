'use strict';
// Ported from Shoping Portal Merchant Panel/Controllers/CustomerPanel/ReadyproductList.cs  (DB: shopping - Db_Shopping)
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/merchant/UtilityClass');

// GetProductList model (the SqlQuery<GetProductList> in the action)
const PROPS = ['IsVerified', 'Breadth_cms', 'CashOnDelivery', 'DAP', 'DealsIds', 'Height_cms', 'isnewarrival', 'IsStock', 'istopdeal', 'Length_cms', 'maincatname', 'MerchantCode', 'MerchantId', 'MerchantImage', 'MerchantName', 'MPRID', 'Mvat', 'Prcode', 'ProcurementSLA', 'ProductCount', 'ProductImages', 'ProductTitle', 'prodUnit', 'Qty', 'ReplacementDay', 'rowNumber', 'sellMRP', 'ShippingCharges', 'SPRID', 'status_Sub', 'stockInQty', 'stockNetQty', 'stockOutQty', 'SubPrCode', 'VatTitle', 'IsActive', 'JP', 'BV', 'PV', 'Cashback_Per', 'Rejectremark', 'Weight_kg', 'Subcategory', 'Discountpercentage', 'CreatedDate', 'ModifyDate', 'ismerchantstatus', 'PrSKUCode', 'IS_OFFER'];

// auth ([SessionExpireCheck])
// route-config: merchant/Archive-productList
router.all(['/merchant/ReadyproductList/Index{/:id}', '/merchant/ReadyproductList', '/merchant/Archive-productList{/:id}'], auth, asyncHandler(async (req, res) => {
  let { SubPrCode, PrCode, mprid, sprid, ProductName, NewAdd, search, filtercategory } = req.p;
  let page = req.p.page;
  let ddlstatus = req.p.ddlstatus;
  if (PrCode == null) PrCode = '';
  if (SubPrCode == null) SubPrCode = '';
  let MPRIDs = PrCode === '' ? 0 : parseInt(PrCode, 10);
  let SPRIDs = SubPrCode === '' ? 0 : parseInt(SubPrCode, 10);
  MPRIDs = (mprid === undefined || mprid === null || mprid === '') ? MPRIDs : parseInt(mprid, 10);
  SPRIDs = (sprid === undefined || sprid === null || sprid === '') ? SPRIDs : parseInt(sprid, 10);
  const Plid = req.user.plid;
  if (NewAdd == null) NewAdd = '';
  if (search == null) search = '';
  if (filtercategory == null) filtercategory = '';
  if (ProductName == null) ProductName = '';
  if (ddlstatus == null || ddlstatus === '') ddlstatus = 1;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1;
  const rows = await proc('shopping', 'usp_getapprovedproductlist_readytolist', {
    startrowindex: Number(page), maxrows: MaxRows, mprid: MPRIDs, sprid: SPRIDs, branchid: Plid,
    cat_code: filtercategory, searchfield: search, searchvalue: PrCode, status: Number(ddlstatus),
    isverfied: 2, searchvaluesubcategory: '', searchvaluetitle: '',
  });
  // PORT-NOTE: @TotalCount OUT read from "totalcount" column of first row (0 if none)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  res.json({
    Model: mapRows(rows, PROPS),
    ViewBag: {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      ProductName, PrCode, SubPrCode, SPRID: SPRIDs, NewAdd, search, filtercategory, MPRID: MPRIDs,
    },
  });
}));

module.exports = router;
