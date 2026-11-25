'use strict';
// Ported from Franchise/Controllers/CustomerPanel/Bank_Details.cs  (DB: shopping - Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const axios = require('axios');
const router = express.Router();
const config = require('../../config');
const { queryOne, procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const BASE = '/franchise/Bank_Details';

// public method GetBankDetails(Int64 PLID) - first active BANK_ACCOUNTS_MERCHANT row for DID
// auth
router.all(`${BASE}/GetBankDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const PLID = req.p.PLID !== undefined ? req.p.PLID : req.p.id;
  const row = await queryOne('shopping', 'select * from bank_accounts_merchant where did = @plid and active = true limit 1', { plid: PLID });
  res.json(row);
}));

// auth - ActionResult Index() (view only)
router.all(`${BASE}/Index{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json({});
}));
router.all(`${BASE}`, auth, asyncHandler(async (req, res) => { res.json({}); }));

// auth
router.all(`${BASE}/SaveBankDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const { Name, BranchName, AccountNo, Ifsccode, BankName, Pancard, Cancelled_Cheque_img } = req.p;
  let imgname = '';
  const Plid = req.user.did;
  const SavePaths = config.app.MemberImagePath || '';
  if (String(Cancelled_Cheque_img).includes('base64,')) {
    const r = await UtilityClass.ImageUploadMasterMethod(Cancelled_Cheque_img, SavePaths, SavePaths, UtilityClass.ImageMode.Thumbnail, 'Member_profile');
    imgname = r === null || r === undefined ? '' : String(r);
  }
  const row = await procOne('shopping', 'usp_insertbankdetaismerchant', {
    plid: Plid, holdername: Name, acountno: AccountNo, bankname: BankName, branchname: BranchName,
    iesccode: Ifsccode, pancard: Pancard, cancelled_cheque_img: imgname,
  });
  // PORT-NOTE: @INTRESULT OUT is read from the "intresult" column of the single result row
  const ret = String(row ? row.intresult : '').toLowerCase();
  res.json(ret);
}));

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
