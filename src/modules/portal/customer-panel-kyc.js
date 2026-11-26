// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\KYCController.cs (class KYCController => /portal/KYC/...)
'use strict';
// Database: shopping (Db_Shopping; legacy DataBaseContext). [CheckResellerTimeout] / [DistributerSessionExpireCheck] have
// commented-out bodies => no check. String parameters: see the PORT-NOTEs at the top of _shared/batch-19-common.js.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const {
  businessKycViewBagDefaults, customerKycDetailsViewBag, customerKycInsertViaJquery, customerKycSaveBankDetails,
} = require('./_shared/batch-19-common');

const router = express.Router();
const C = '/portal/KYC';

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["PLID"] == null => RedirectToAction("Index","Home"))
// route-config: "customer/kyc" -> KYC/Index
router.all([`${C}/Index{/:id}`, C, '/portal/customer/kyc{/:id}'], ps.customerAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  ViewBag.masterpageshow = ps.sessionGet(req, 'LoginwithMobile') !== null ? 'MobileLogin' : '';
  businessKycViewBagDefaults(ViewBag);
  const Plid = req.user.plid;
  // (ObjBank_Master = _BANK_ACCOUNTS_MERCHANT... commented out in legacy)
  await customerKycDetailsViewBag(ViewBag, Plid);
  return res.json({ view: '~/Views/CustomerPanel/Customer_KYC/Index.cshtml', ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult InsertKYCViaJquery(string Typetext, string MemberImg, int Mode, int Id, string GetThisId, string FirstValue, string SecondValue, string AddressType, string AddressTypeNumber)
// auth ((Login)Session["Plid"] cast without null check)
router.all(`${C}/InsertKYCViaJquery{/:id}`, ps.customerAuth, asyncHandler((req, res) => customerKycInsertViaJquery(req, res, 'KYC')));

// ---------------------------------------------------------------- JsonResult SaveBankDetails(string Name, string BranchName, string AccountNo, string Ifsccode, string BankName, string Cancelled_Cheque_img, string Address, string state, string city)
// auth ((Login)Session["Plid"] cast without null check)
router.all(`${C}/SaveBankDetails{/:id}`, ps.customerAuth, asyncHandler((req, res) => customerKycSaveBankDetails(req, res)));

module.exports = router;
