// Ported from ClusterofferShopingPortal\Controllers\UserPanel\Business_KYC.cs (class Business_KYCController => /portal/Business_KYC/...)
'use strict';
// Database: shopping (Db_Shopping; legacy DataBaseContext). String parameters: see the PORT-NOTEs at the top of _shared/batch-19-common.js.
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const {
  DB, s, NRE, str, outAny, sqlInt, requiredInt, mapPath, bg, appFolder, legacyKycImgName, deleteIfExists, updatemerchantkyc,
  businessKycViewBagDefaults, portalLoginByPlid, BusinessKycSendConfirmationEmail, CompanySettings,
} = require('./_shared/batch-19-common');

const router = express.Router();
const C = '/portal/Business_KYC';

/** class getdetails (Controllers/CustomerPanel/KYCCheck.cs) */
const GETDETAILS = ['id', 'Regno', 'Type', 'Image'];

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["PLID"] == null => RedirectToAction("Index","Home"))
// route-config: "merchant/businesskyc" -> Business_KYC/Index
router.all([`${C}/Index{/:id}`, C, '/portal/merchant/businesskyc'], ps.customerAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  businessKycViewBagDefaults(ViewBag);
  const Plid = req.user.plid; void Plid;
  // (Tbl_BusinessKycDetails / _BANK_ACCOUNTS_MERCHANT reads commented out in legacy)
  return res.json({ view: '~/Views/UserPanel/Business_KYC/Index.cshtml', ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult InsertKYCViaJquery(string Typetext, string MemberImg, int Mode, int Id, string GetThisId, string FirstValue, string SecondValue, string EntityType, string AddressType, string AddressTypeNumber)
// auth ((Login)Session["Plid"] cast without null check)
router.all(`${C}/InsertKYCViaJquery{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const sig = 'System.Web.Mvc.JsonResult InsertKYCViaJquery(System.String, System.String, Int32, Int32, System.String, System.String, System.String, System.String, System.String, System.String)';
  const Typetext = str(req.p.Typetext);
  const MemberImg = str(req.p.MemberImg);
  const Mode = requiredInt(req.p.Mode, 'Mode', sig);
  const Id = requiredInt(req.p.Id, 'Id', sig);
  const GetThisId = str(req.p.GetThisId);
  const FirstValue = str(req.p.FirstValue);
  const SecondValue = str(req.p.SecondValue);
  const EntityType = str(req.p.EntityType);
  const AddressType = str(req.p.AddressType);
  const AddressTypeNumber = str(req.p.AddressTypeNumber);
  let ret = '';
  let result = 0;
  const Plid = req.user.plid;
  // (empty if-blocks per Typetext in legacy)
  let strValidFullName = '';
  try {
    let ImgName = '';
    if (MemberImg === null) throw NRE(); // MemberImg.Trim()
    if (MemberImg.trim() !== '' && MemberImg.includes('base64,')) {
      const SavePaths = appFolder('KYC_Images');
      if (MemberImg !== '') {
        ImgName = legacyKycImgName('', Plid); // private string loginid = ""
      } else {
        ImgName = ' ';
      }
      strValidFullName = mapPath(SavePaths) + '/' + ImgName;
      ImgName = s(await UtilityClass.ImageUploadMasterMethod(MemberImg, SavePaths, SavePaths, UtilityClass.ImageMode.Original, 'KYC'));
    }
    const sp = await db.procOne(DB, 'USP_INSERTKYC', {
      PLID: Plid, TYPE: GetThisId, IMAGE: ImgName, ID: Id, MODE: Mode, KYCTYPE: 2, AddressType, AddressTypeNumber,
    });
    ret = outAny(sp, 'STRRESULT').toLowerCase();
    if (s(ret) === 'ok') {
      const r = await db.procOne(DB, 'USP_UPDATEBUSINESSKYCDETAILS', {
        PLID: Plid, EntityType: sqlInt(EntityType), PANNO: FirstValue, DOI: SecondValue, Type: Typetext,
      });
      const ResValue = outAny(r, 'INTRESULT');
      if (ResValue === '3') {
        ret = ResValue;
        return res.json(ret);
      }
    }
    let emailid = ''; let mobile = ''; const username = '';
    const row = await portalLoginByPlid(Plid);
    result = await updatemerchantkyc(Plid);
    if (row !== null) {
      emailid = row.emailid;
      mobile = row.phone;
      if (result === 1) {
        await BusinessKycSendConfirmationEmail(emailid, username, 'Thanks For Uploading Business KYC.');
        bg(() => UtilityClass.SendMsgOnMobile(mobile, 'Dear Customer, \r\n Thanks for submitting your Business KYC, \r\n The' + s(CompanySettings.CompanyName) + ' Team '));
      }
    }
  } catch (Exp) {
    // ViewBag.Message = Exp.Message
    deleteIfExists(strValidFullName);
    return res.json(Exp.message);
  }
  return res.json({ ret, result });
}));

// ---------------------------------------------------------------- JsonResult getdetails(int newid)
// auth
// PORT-NOTE: legacy had no session check (any KYC row by id, KYCTYPE=2); the port requires a logged-in customer because the
// response exposes KYC documents. No ownership check (kept as legacy).
router.all(`${C}/getdetails{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const newid = requiredInt(req.p.newid, 'newid', 'System.Web.Mvc.JsonResult getdetails(Int32)');
  const rows = await db.query(DB, 'select id, regno, type, image from kyc where kyctype = 2 and id = @newid', { newid });
  const getdetails = mapRows(rows, GETDETAILS);
  return res.json(getdetails);
}));

// ---------------------------------------------------------------- JsonResult GetBankDetailsPincode(string IFSCCODE)
// public (no session use)
router.all(`${C}/GetBankDetailsPincode{/:id}`, asyncHandler(async (req, res) => {
  try {
    const Baseurl = 'https://ifsc.razorpay.com/' + s(str(req.p.IFSCCODE));
    const r = await axios.get(Baseurl, { responseType: 'text', transformResponse: (x) => x });
    const bankdetails = s(r.data);
    return res.json(bankdetails);
  } catch (Ex) {
    const Error_ = 'Not Found';
    return res.json(Error_);
  }
}));

// ---------------------------------------------------------------- JsonResult SaveBankDetails(string Name, string BranchName, string AccountNo, string Ifsccode, string BankName, string Cancelled_Cheque_img, string Address, string state, string city, int EntityType)
// auth ((Login)Session["Plid"] cast without null check)
// PORT-NOTE: the legacy EXEC passed its 12 arguments positionally while DBO.USP_INSERTBANKDETAISMERCHANT (dbshopping.sql) has 13
// parameters (@PANCARDNO 7th), which shifted Address..Kyctype by one and requested OUTPUT on @KYCTYPE (SQL error 8162). The port
// binds the arguments by their evident names (ADDRESS, STATE, CITY, CANCELLED_CHEQUE_IMG, KYCTYPE; PANCARDNO left to its default).
router.all(`${C}/SaveBankDetails{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  const EntityType = requiredInt(p.EntityType, 'EntityType',
    'System.Web.Mvc.JsonResult SaveBankDetails(System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String, Int32)');
  const Name = str(p.Name); const BranchName = str(p.BranchName); const AccountNo = str(p.AccountNo);
  const Ifsccode = str(p.Ifsccode); const BankName = str(p.BankName); const Cancelled_Cheque_img = str(p.Cancelled_Cheque_img);
  const Address = str(p.Address); const state = str(p.state); const city = str(p.city);
  let ret = '';
  let result = 0;
  let imgname = '';
  const Plid = req.user.plid;
  const loginid = req.user.loginid; void loginid;
  const SavePaths = appFolder('KYC_Images');
  if (Cancelled_Cheque_img === null) throw NRE(); // Cancelled_Cheque_img.Contains(...)
  if (Cancelled_Cheque_img.includes('base64,')) {
    imgname = s(await UtilityClass.ImageUploadMasterMethod(Cancelled_Cheque_img, SavePaths, SavePaths, UtilityClass.ImageMode.Thumbnail, 'Kyc_Images'));
  }
  const sp = await db.procOne(DB, 'USP_INSERTBANKDETAISMERCHANT', {
    PLID: Plid, HOLDERNAME: Name, ACOUNTNO: AccountNo, BANKNAME: BankName, BRANCHNAME: BranchName, IESCCODE: Ifsccode,
    ADDRESS: Address, STATE: state, CITY: city, CANCELLED_CHEQUE_IMG: imgname, KYCTYPE: EntityType,
  });
  ret = outAny(sp, 'INTRESULT').toLowerCase();
  if (ret === '2') {
    let emailid = ''; let mobile = ''; const username = '';
    const row = await portalLoginByPlid(Plid);
    result = await updatemerchantkyc(Plid);
    if (result === 1) {
      if (row !== null) {
        emailid = row.emailid;
        mobile = row.phone;
        await BusinessKycSendConfirmationEmail(emailid, username, 'Thanks For Uploading Business KYC.');
        bg(() => UtilityClass.SendMsgOnMobile(mobile, 'Dear Sir/ Ma’m \r\n Thanks for Submitting your Business KYC. \r\n ' + s(CompanySettings.CompanyName) + ' Team '));
      }
    }
  }
  return res.json({ ret, result });
}));

module.exports = router;
