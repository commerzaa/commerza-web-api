'use strict';
// Ported from Member/Controllers/CustomerPanel/Website_Products_Iframe.cs  (DB: affiliate)
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const DB = 'affiliate';
const product = ['NAME', 'DISCOUNT', 'BV', 'RBV', 'IMAGES', 'MRP', 'DP', 'TKPMID', 'GST', 'GSTID', 'HANDLINGFEE', 'FRID', 'STOCKAVAILABLE', 'unit', 'QUANTITY'];

// public (iframe used outside of the website, no session check). route-config: url "product-list"
router.all(['/member/Website_Products_Iframe/Index{/:id}', '/member/Website_Products_Iframe', '/member/product-list'], asyncHandler(async (req, res) => {
  let { DDLPCMID, RangeMin, RangeMax, ProductName, ProductCode, SearchPinCode, page, FRID } = req.p;
  if (DDLPCMID == null) DDLPCMID = '0';
  if (RangeMin == null || RangeMin === '') RangeMin = '0';
  if (RangeMax == null || RangeMax === '') RangeMax = '0';
  if (ProductName == null) ProductName = '';
  if (ProductCode == null) ProductCode = '';
  if (FRID == null || FRID === '') FRID = '0';
  const MaxRows = 100;
  if (page == null || page === '') page = 1; else page = Number(page);
  const ViewBag = {};

  let list = await proc(DB, 'usp_allproductmaster', {
    mode: '1', tkmid: DDLPCMID, min: Number(RangeMin), max: Number(RangeMax), productname: ProductName, productcode: ProductCode,
    pincode: '', startrowindex: page, maxrows: MaxRows, frid: FRID,
  });
  const Model = mapRows(list, product);
  ViewBag.product = Model;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  // PORT-NOTE: @TOTALCOUNT OUT read from the "totalcount" column of the first row (0 if none)
  ViewBag.TotalRecord = list.length ? Math.trunc(Number(list[0].totalcount || 0)) : 0;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();

  if (SearchPinCode != null && SearchPinCode !== '') {
    const imd = await proc(DB, 'usp_allproductmaster', {
      mode: '2', tkmid: DDLPCMID, min: Number(RangeMin), max: Number(RangeMax), productname: ProductName, productcode: ProductCode,
      pincode: SearchPinCode, startrowindex: page, maxrows: MaxRows, frid: FRID,
    });
    ViewBag.product = mapRows(imd, product);
    ViewBag.SearchPinCode = SearchPinCode;
    ViewBag.FRID = FRID;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = imd.length ? Math.trunc(Number(imd[0].totalcount || 0)) : 0;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  }
  // legacy "ViewBag.TotalRecord == null && ViewBag.CurrentPage == null" fallback never triggers (both were set above)
  res.json({ View: '~/Views/CustomerPanel/Website_Products_Iframe/Index.cshtml', Model, ViewBag });
}));

module.exports = router;
