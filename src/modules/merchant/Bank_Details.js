'use strict';
// Port of Merchant Panel Controllers/CustomerPanel/Bank_Details.cs (Bank_DetailsController) - 4 actions
// DB: Db_Shopping => 'shopping'
const express = require('express');
const axios = require('axios');
const config = require('../../config');
const { queryOne, procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const BASE = '/merchant/Bank_Details';

// ---- GetBankDetails(Int64 PLID) - first active BANK_ACCOUNTS_MERCHANT row for PLID ------------------------
// auth (public method acting on a merchant's data; legacy had no session check)
router.all(`${BASE}/GetBankDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const PLID = req.p.PLID !== undefined ? req.p.PLID : req.p.id;
  const row = await queryOne(DB, 'select * from bank_accounts_merchant where plid = @plid and active = true limit 1', { plid: PLID });
  res.json(row);
}));

// ---- Index (view only) ---------------------------------------------------------------------------------
// route-config: merchant/BankDetails
// auth
router.all([`${BASE}/Index{/:id}`, BASE, '/merchant/BankDetails', '/merchant/merchant/BankDetails'], auth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/Bank_Details/Index.cshtml' });
}));

// ---- SaveBankDetails -----------------------------------------------------------------------------------
// auth
router.all(`${BASE}/SaveBankDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const { Name, BranchName, AccountNo, Ifsccode, BankName, Pancard, Cancelled_Cheque_img } = req.p;
  let imgname = '';
  const Plid = req.user.plid;
  const loginid = req.user.loginid; // legacy: read but unused
  const SavePaths = config.app.MemberImagePath || '';
  if (Cancelled_Cheque_img.includes('base64,')) { // legacy: null => NullReferenceException
    const r = await UtilityClass.ImageUploadMasterMethod(Cancelled_Cheque_img, SavePaths, SavePaths, UtilityClass.ImageMode.Thumbnail, 'Member_profile');
    imgname = r === null || r === undefined ? '' : String(r);
  }
  const row = await procOne(DB, 'usp_insertbankdetaismerchant', {
    plid: Plid, holdername: Name, acountno: AccountNo, bankname: BankName, branchname: BranchName,
    iesccode: Ifsccode, pancardno: Pancard, address: '', state: '', city: '',
    cancelled_cheque_img: imgname, kyctype: '0',
  });
  // PORT-NOTE: @INTRESULT OUT is read from the "intresult" column of the single result row
  const ret = String(row ? row.intresult : '').toLowerCase();
  res.json(ret);
}));

// ---- GetBankDetailsPincode -----------------------------------------------------------------------------
// auth
router.all(`${BASE}/GetBankDetailsPincode{/:id}`, auth, asyncHandler(async (req, res) => {
  try {
    const r = await axios.get('https://ifsc.razorpay.com/' + req.p.IFSCCODE, { responseType: 'text', transformResponse: (d) => d });
    res.json(r.data);
  } catch (e) {
    res.json('Not Found');
  }
}));

module.exports = router;
