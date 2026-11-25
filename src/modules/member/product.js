'use strict';
// Ported from Member/Controllers/CustomerPanel/Product.cs  (DB: affiliate)
const express = require('express');
const router = express.Router();
const { proc, procOne, scalar } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const DB = 'affiliate';
const product = ['NAME', 'DISCOUNT', 'BV', 'RBV', 'IMAGES', 'MRP', 'DP', 'TKPMID', 'GST', 'GSTID', 'HANDLINGFEE', 'FRID', 'STOCKAVAILABLE', 'unit', 'QUANTITY'];
const Franchise = ['FRID', 'franchiseName', 'PINCODE', 'FRCode', 'STATE', 'CITY', 'Address'];
// class MemberProfile (My_Profile.cs)
const MemberProfile = ['PMID', 'plid', 'Title', 'Fname', 'Lname', 'Phone', 'Designation', 'CPer_EmailID', 'LoginId', 'Password', 'ImageName', 'USERNAME', 'PhoneWithCode', 'CountryName', 'INTRO_PLID', 'DOB', 'FatherOrMotherName', 'Gender', 'HighestQualification', 'CID', 'SID', 'CTID', 'Atc_WalletAddress', 'CityName', 'MarriageAnniversary', 'SponserName', 'ACTIVE', 'PINCODE', 'NOMINEEMNAME', 'NOMINEEMREL', 'NOMINEEDOB', 'NOMINEECONTACT', 'FACEBOOKLINK', 'maritalstatus', 'Address', 'SponsorUsername', 'Town_post', 'Qualification', 'occupation'];

// Convert.ToDecimal / Convert.ToInt32 of a string (null -> 0, bad format -> FormatException)
const dec = (v) => {
  if (v == null) return 0;
  const s = String(v).trim();
  if (s === '' || isNaN(Number(s))) throw new Error('Input string was not in a correct format.');
  return Number(s);
};
const int32 = (v) => {
  if (v == null) return 0;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
};

// auth (legacy: Session["Plid"] == null -> redirect Home/Index). route-config: url "referral/G3pAMJ553_slash_EVT87l9cm75NKIzwKMUX4QEVT87l9cm75NKIzwKMUX4Q" (id optional)
// route-config: url "shop" maps to Product/AllProduct, which does not exist in Product.cs (not ported)
router.all(['/member/Product/Index{/:id}', '/member/Product', '/member/referral/G3pAMJ553_slash_EVT87l9cm75NKIzwKMUX4QEVT87l9cm75NKIzwKMUX4Q'], auth, asyncHandler(async (req, res) => {
  let { DDLPCMID, RangeMin, RangeMax, ProductName, ProductCode, SearchPinCode, page } = req.p;
  if (DDLPCMID == null) DDLPCMID = '0';
  if (RangeMin == null || RangeMin === '') RangeMin = '0';
  if (RangeMax == null || RangeMax === '') RangeMax = '0';
  if (ProductName == null) ProductName = '';
  if (ProductCode == null) ProductCode = '';
  if (SearchPinCode === '' || SearchPinCode == null) {
    const sp = sessionStore.get(req, 'SearchPinCode');
    if (sp != null) SearchPinCode = String(sp);
  }
  const MaxRows = 100;
  if (page == null || page === '') page = 1; else page = Number(page);
  const ViewBag = {};

  const list = await proc(DB, 'usp_allproductmaster', {
    mode: '1', tkmid: DDLPCMID, min: dec(RangeMin), max: dec(RangeMax), productname: ProductName, productcode: ProductCode,
    pincode: '', startrowindex: page, maxrows: MaxRows,
  });
  const Model = mapRows(list, product);

  if (SearchPinCode !== '' && SearchPinCode != null) {
    const productImdiate = await proc(DB, 'usp_allproductmaster', {
      mode: '2', tkmid: DDLPCMID, min: dec(RangeMin), max: dec(RangeMax), productname: ProductName, productcode: ProductCode,
      pincode: SearchPinCode, startrowindex: page, maxrows: MaxRows,
    });
    if (productImdiate.length > 0) ViewBag.product = mapRows(productImdiate, product);
    sessionStore.set(req, 'SearchPinCode', SearchPinCode);
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    // PORT-NOTE: @TOTALCOUNT OUT read from the "totalcount" column of the first row (0 if none)
    ViewBag.TotalRecord = productImdiate.length ? Math.trunc(Number(productImdiate[0].totalcount || 0)) : 0;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  }
  if (ViewBag.TotalRecord == null && ViewBag.CurrentPage == null) {
    ViewBag.TotalRecord = 0;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  }

  const memrow = await procOne(DB, 'usp_getcontactdetails', { plid: Number(req.user.plid) });
  const memdetails = memrow ? mapRow(memrow, MemberProfile) : null;
  if (memdetails != null) ViewBag.memdetails = memdetails;
  if (memdetails == null) throw new TypeError('Object reference not set to an instance of an object.'); // memdetails.PINCODE
  let franchise = mapRows(await proc(DB, 'franchiseapprovewithmappincode', { pincode: memdetails.PINCODE }), Franchise);
  if (franchise.length > 0) {
    ViewBag.franchise = franchise;
  } else {
    franchise = mapRows(await proc(DB, 'franchiseapprovewithmappincode', { pincode: '' }), Franchise);
    ViewBag.franchise = franchise;
  }
  res.json({ View: '~/Views/CustomerPanel/Product/Index.cshtml', Model, ViewBag });
}));

// public (legacy had no session check)
router.all('/member/Product/Pincode{/:id}', asyncHandler(async (req, res) => {
  const franchise = mapRows(await proc(DB, 'franchiseapprovewithmappincode', { pincode: req.p.pincode }), Franchise);
  res.json(franchise);
}));

// auth
router.all('/member/Product/PurchaseKitOrPackage{/:id}', auth, asyncHandler(async (req, res) => {
  const {
    TotalPayableAmount, ALLMRP, BV, ALLBV, RBV, ALLRBV, DISCOUNT, ALLDISCOUNT, DP, ALLDP, ALLGSTID, GSTAMOUNT, ALLGSTAMOUNT, ALLGSTPERCENTAGE,
    PaymentMode, ALLPRODUCTID, ALLPRODUCTNAME, HANDLINGFEE, ALLHANDLINGFEE, ADDRESS, COUNTRY, STATES, CITYS, PINCODE, CUSTOMERNAME, MOBILE, EMAILID, PURCHASETYPE,
  } = req.p;
  const FRID = int32(req.p.FRID);
  if (PaymentMode === '1') {
    const availbleewallet = Number(await scalar(DB, 'select coalesce(Available_Fund,0) as availbleewallet from MEMBER_PERFORMANCE WHERE Regno = @r limit 1', { r: Math.trunc(Number(req.user.plid)) })) || 0;
    if (availbleewallet < dec(TotalPayableAmount)) return res.json('E-WALLET');
  }
  if (PaymentMode === '5') {
    const TotalAvailableShoppingPoints = Number(await scalar(DB, 'select coalesce(TotalAvailableShoppingPoints,0) as TotalAvailableShoppingPoints from MEMBER_PERFORMANCE WHERE Regno = @r limit 1', { r: Math.trunc(Number(req.user.plid)) })) || 0;
    if (TotalAvailableShoppingPoints < dec(TotalPayableAmount)) return res.json('SHOPPINGWALLET');
  }
  if (PINCODE === '') return res.json('Enter Pincode Code.');
  if (ADDRESS === '') return res.json('Enter Address.');

  let ReturnOutput = 'success';
  const RegNo = Math.trunc(Number(req.user.plid));
  try {
    const out = await procOne(DB, 'usp_allproductordermaster', {
      plid: RegNo, totalamount: dec(TotalPayableAmount), allmrp: ALLMRP, bv: dec(BV), allbv: ALLBV, rbv: dec(RBV), allrbv: ALLRBV,
      discount: dec(DISCOUNT), alldiscount: ALLDISCOUNT, dp: dec(DP), alldp: ALLDP, allgstid: ALLGSTID, gstamount: dec(GSTAMOUNT),
      allgstamount: ALLGSTAMOUNT, allgstpercentage: ALLGSTPERCENTAGE, paymode: int32(String(PaymentMode).trim()),
      allproductid: ALLPRODUCTID, allproductname: ALLPRODUCTNAME, handlingfee: dec(HANDLINGFEE), allhandlingfee: ALLHANDLINGFEE,
      branchid: '1', address: ADDRESS, country: COUNTRY, state: STATES, city: CITYS, pincode: int32(PINCODE),
      customername: CUSTOMERNAME, mobile: MOBILE, emailid: EMAILID, purchasetype: int32(PURCHASETYPE), frid: FRID,
    });
    ReturnOutput = out && out.stroutput != null ? String(out.stroutput) : '';
    // PORT-NOTE: legacy cleared Session["SessionOTP"] only when ExecuteSqlCommand returned > 0 rows; the PostgreSQL function gives no row count, so it is cleared whenever the call succeeded.
    sessionStore.set(req, 'SessionOTP', null);
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'Usp_AllSubscriptionMaster', 0, req.path); } catch (_) { /* ignore */ }
    ReturnOutput = 'Error^Some Exception Occur : ' + ExpObj.message;
  }
  res.json(ReturnOutput);
}));

module.exports = router;
