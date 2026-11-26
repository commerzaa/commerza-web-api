// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\kyc_mobileController.cs (class kyc_mobileController => /portal/kyc_mobile/...)
'use strict';
// Database: shopping (Db_Shopping; legacy DataBaseContext). String parameters: see the PORT-NOTEs at the top of
// _shared/batch-19-common.js. InsertKYCViaJquery / SaveBankDetails are identical to KYCController (shared bodies).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const {
  DB, businessKycViewBagDefaults, customerKycDetailsViewBag, customerKycInsertViaJquery, customerKycSaveBankDetails,
} = require('./_shared/batch-19-common');

const router = express.Router();
const C = '/portal/kyc_mobile';

/** class BANK_ACCOUNTS_MERCHANT ([Table("DBO.TBL_CUSTOMER_BANK_ACCOUNTS")], Controllers/UserPanel/BANK_ACCOUNTS_MERCHANT.cs) */
const BANK_ACCOUNTS_MERCHANT = ['TCBAID', 'CLID', 'LOGINID', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'BANKNAME', 'BRANCHNAME', 'IFSCCODE', 'ACTIVE',
  'DTM_DATE', 'DTM_UPDATE_DATE', 'PancardNo', 'Cancelled_Cheque_img', 'Address', 'State', 'City', 'KYCTYPE', 'ISAPROVE', 'CommentorRemark'];

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["PLID"] == null => RedirectToAction("Index","Home"))
// route-config: "customer/kyc-mobile" -> kyc_mobile/Index
// PORT-NOTE: the BANK_ACCOUNTS_MERCHANT entity maps columns that DBO.TBL_CUSTOMER_BANK_ACCOUNTS does not have (LOGINID, DTM_DATE,
// DTM_UPDATE_DATE, PancardNo, Cancelled_Cheque_img, Address, State, City, KYCTYPE, ISAPROVE, CommentorRemark) and a bool ACTIVE on
// an int column, so the legacy EF query failed. The port selects the existing columns (missing ones => null, ACTIVE as bool).
router.all([`${C}/Index{/:id}`, C, '/portal/customer/kyc-mobile{/:id}'], ps.customerAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  businessKycViewBagDefaults(ViewBag);
  const Plid = req.user.plid;
  // DbContext._BANK_ACCOUNTS_MERCHANT.Where(Obj => Obj.CLID == Plid && Obj.ACTIVE == true).ToList()
  const rows = await db.query(DB, `select tcbaid, clid, accountholdername, accountno, bankname, branchname, ifsccode,
(active = 1) as active
from tbl_customer_bank_accounts where clid = @Plid and active = 1`, { Plid });
  const ObjBank_Master = mapRows(rows, BANK_ACCOUNTS_MERCHANT);
  await customerKycDetailsViewBag(ViewBag, Plid);
  ViewBag.ObjBank_Master = ObjBank_Master;
  return res.json({ view: '~/Views/CustomerPanel/kyc_mobile/Index.cshtml', ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult InsertKYCViaJquery(string Typetext, string MemberImg, int Mode, int Id, string GetThisId, string FirstValue, string SecondValue, string AddressType, string AddressTypeNumber)
// auth ((Login)Session["Plid"] cast without null check)
router.all(`${C}/InsertKYCViaJquery{/:id}`, ps.customerAuth, asyncHandler((req, res) => customerKycInsertViaJquery(req, res, 'kyc_mobile')));

// ---------------------------------------------------------------- JsonResult SaveBankDetails(string Name, string BranchName, string AccountNo, string Ifsccode, string BankName, string Cancelled_Cheque_img, string Address, string state, string city)
// auth ((Login)Session["Plid"] cast without null check)
router.all(`${C}/SaveBankDetails{/:id}`, ps.customerAuth, asyncHandler((req, res) => customerKycSaveBankDetails(req, res)));

module.exports = router;
