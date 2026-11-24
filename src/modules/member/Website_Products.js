'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Website_Products.cs (Website_ProductsController) */
const express = require('express');
const { queryOne, proc, scalar } = require('../../db');
const { mapRows, mapRow } = require('../../utils/shape');
const { auth, optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Website_Products';
const PRODUCT_PROPS = ['NAME', 'DISCOUNT', 'BV', 'RBV', 'IMAGES', 'MRP', 'DP', 'TKPMID', 'GST', 'GSTID', 'HANDLINGFEE', 'FRID', 'STOCKAVAILABLE', 'unit', 'QUANTITY'];
const FRANCHISE_PROPS = ['FRID', 'franchiseName', 'PINCODE', 'FRCode', 'STATE', 'CITY', 'Address'];
// MemberProfile (Password is deliberately not returned to the client)
const MEMBER_PROFILE_PROPS = ['PMID', 'plid', 'Title', 'Fname', 'Lname', 'Phone', 'Designation', 'CPer_EmailID', 'LoginId', 'ImageName', 'USERNAME',
  'PhoneWithCode', 'CountryName', 'INTRO_PLID', 'DOB', 'FatherOrMotherName', 'Gender', 'HighestQualification', 'CID', 'SID', 'CTID', 'Atc_WalletAddress',
  'CityName', 'MarriageAnniversary', 'SponserName', 'ACTIVE', 'PINCODE', 'NOMINEEMNAME', 'NOMINEEMREL', 'NOMINEEDOB', 'NOMINEECONTACT', 'FACEBOOKLINK',
  'maritalstatus', 'Address', 'SponsorUsername', 'Town_post', 'Qualification', 'occupation'];
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const toDec = (v) => { const n = Number(v); if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.'); return n; };
const NPE = () => new Error('Object reference not set to an instance of an object.');

// auth (null session => RedirectToAction("Index","Home"))
// route-config: "referral/G3pAMJ553_slash_EVT87l9cm75NKIzwKMUX4QEVT87l9" (Website Product) and
//               "referral/G3pAMJ553_slash_EVT87l9cm75NKIzwKMUX4QEVT87l9_P_IF" (Iframe Product) -> Website_Products/Index
router.all([
  `${P}/Index{/:id}`, P,
  '/member/referral/G3pAMJ553_slash_EVT87l9cm75NKIzwKMUX4QEVT87l9',
  '/member/referral/G3pAMJ553_slash_EVT87l9cm75NKIzwKMUX4QEVT87l9_P_IF',
], auth, asyncHandler(async (req, res) => {
  let { DDLPCMID, RangeMin, RangeMax, ProductName, ProductCode, SearchPinCode, FRID, TSMID } = req.p;
  let page = toInt(req.p.page);
  if (DDLPCMID == null) DDLPCMID = '0';
  if (RangeMin == null || RangeMin === '') RangeMin = '0';
  if (RangeMax == null || RangeMax === '') RangeMax = '0';
  if (ProductName == null) ProductName = '';
  if (ProductCode == null) ProductCode = '';
  if (FRID == null || FRID === '') FRID = '0';
  if (TSMID == null || TSMID === '') TSMID = '0';
  const MaxRows = 100;
  if (page == null) page = 1;
  const ViewBag = {};

  let product = [];
  {
    const rows = await proc(DB, 'usp_allproductmaster', {
      mode: 1, tkmid: toInt(DDLPCMID), min: toDec(RangeMin), max: toDec(RangeMax), productname: ProductName, productcode: ProductCode,
      pincode: '', startrowindex: page, maxrows: MaxRows, frid: toInt(FRID),
    });
    product = mapRows(rows, PRODUCT_PROPS);
    ViewBag.product = product;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    // PORT-NOTE: @TOTALCOUNT OUT read from the "totalcount" column of the first row (0 when there are no rows)
    ViewBag.TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  }
  if (SearchPinCode !== '' && SearchPinCode != null) {
    const rows = await proc(DB, 'usp_allproductmaster', {
      mode: 2, tkmid: toInt(DDLPCMID), min: toDec(RangeMin), max: toDec(RangeMax), productname: ProductName, productcode: ProductCode,
      pincode: SearchPinCode, startrowindex: page, maxrows: MaxRows, frid: toInt(FRID),
    });
    ViewBag.product = mapRows(rows, PRODUCT_PROPS);
    ViewBag.SearchPinCode = SearchPinCode;
    ViewBag.FRID = FRID;
    ViewBag.TSMID = TSMID;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  }
  // (legacy "if (ViewBag.TotalRecord == null && ViewBag.CurrentPage == null)" fallback can never trigger: the first query always sets both)

  const memrows = await proc(DB, 'usp_getcontactdetails', { plid: Math.trunc(Number(req.user.plid)) });
  const memdetails = mapRow(memrows[0] || null, MEMBER_PROFILE_PROPS);
  if (memdetails != null) ViewBag.memdetails = memdetails;
  if (memdetails == null) throw NPE(); // memdetails.PINCODE dereference in legacy
  let franchise = mapRows(await proc(DB, 'franchiseapprovewithmappincode', { pincode: memdetails.PINCODE }), FRANCHISE_PROPS);
  if (franchise.length > 0) {
    ViewBag.franchise = franchise;
  } else {
    franchise = mapRows(await proc(DB, 'franchiseapprovewithmappincode', { pincode: '' }), FRANCHISE_PROPS);
    ViewBag.franchise = franchise;
  }
  res.json({ Model: product, ViewBag });
}));

// public (no session check in legacy; franchise lookup by pincode)
router.all(`${P}/Pincode{/:id}`, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'franchiseapprovewithmappincode', { pincode: req.p.pincode });
  res.json(mapRows(rows, FRANCHISE_PROPS));
}));

// session is checked inside the action: expired session returns the JSON string "Session expired!" (so optionalAuth, not auth)
router.all(`${P}/AddCart{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const { TKPMID, Type, FRID } = req.p;
  let { TSMID } = req.p;
  let ResultOutput = '';
  let RegNo = 0;
  let prodCount = 0;
  if (TSMID === '') TSMID = '0';
  try {
    if (req.user && req.user.plid != null) {
      RegNo = Math.trunc(Number(req.user.plid));
    } else {
      ResultOutput = 'Session expired!';
      return res.json(ResultOutput);
    }
    const rows = await proc(DB, 'usp_addtocartprocess', {
      tkpmid: toInt(TKPMID), regno: RegNo, frid: toInt(FRID), qty: 1, mode: toInt(Type), tsmid: toInt(TSMID) || 0, // Convert.ToInt32(null) == 0
    });
    // @STROUTPUT / @STRCOUNT are OUTPUT parameters: read from the first result row
    const first = rows.length ? rows[0] : null;
    if (!first) throw NPE();
    ResultOutput = first.stroutput === null || first.stroutput === undefined ? null : String(first.stroutput);
    if (ResultOutput === null) throw NPE();
    prodCount = parseInt(first.strcount, 10);
    return res.json(ResultOutput + '^' + prodCount);
  } catch (ex) {
    console.error(ex.message);
    return res.json(ResultOutput);
  }
}));

// [HttpGet]; session optional (RegNo stays 0 without a session)
router.get(`${P}/GetUserCartCount{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  let RegNo = 0;
  let prodCount = 0;
  try {
    if (req.user && req.user.plid != null) RegNo = Math.trunc(Number(req.user.plid));
    const v = await scalar(DB, 'select coalesce(count(1), 0) from tbl_addtocart where status = 1 and regno = @r', { r: RegNo });
    prodCount = v === null || v === undefined ? 0 : Number(v);
    return res.json(prodCount);
  } catch (ex) {
    console.error(ex.message);
    return res.json(prodCount);
  }
}));

module.exports = router;
