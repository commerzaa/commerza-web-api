'use strict';
// Ported from Franchise/Controllers/CustomerPanel/Sms_ApiSetting.cs  (DB: shopping - Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const axios = require('axios');
const router = express.Router();
const { proc, procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const BASE = '/franchise/Sms_ApiSetting';
const COMPANY = ['CompanyInfoEmailid', 'CompanySupportEmailid', 'CompanySendmailEmailid', 'CompanyNoReplyEmailid', 'CompanyMailServer', 'CompanyMailPassowrd', 'CompanyMailServerPort', 'CompanyAffiliateURL', 'CompanyResellerURL', 'CompanyMerchantURL', 'CompanyAdminURL', 'CompanyAPIURL', 'CompanyAdvertisement', 'CompanyServices', 'CompanyCurrency', 'CompanyValidURL', 'CompanyScope', 'CompanyClientID', 'CompanyRedirect', 'CompanyLogout', 'CompanyFacebookClientID', 'CompanyFacebookClientSecret', 'CompanyPGMerchantKEY', 'CompanyPGSALT', 'CompanyOauthURL', 'SMSAPI', 'DedicatedProductURL', 'TRANSATIONPAYUMONEYRATE'];

// auth
router.all([`${BASE}/Index{/:id}`, BASE], auth, asyncHandler(async (req, res) => {
  const Pmid = req.user.pmid;
  const rows = await proc('shopping', 'usp_getcompanyprofiledetails', { pmid: Pmid });
  res.json({ Model: mapRows(rows, COMPANY) });
}));

// auth
router.all(`${BASE}/SettingSMS_API{/:id}`, auth, asyncHandler(async (req, res) => {
  const Pmid = Math.trunc(Number(req.user.pmid));
  const row = await procOne('shopping', 'usp_sms_api', { smsapi: req.p.SMS, pmid: Pmid });
  // PORT-NOTE: @Result OUT read from "result" column
  res.json(String(row && row.result !== null && row.result !== undefined ? row.result : ''));
}));

// auth
router.all(`${BASE}/sendsmsonmobile{/:id}`, auth, asyncHandler(async (req, res) => {
  let result = '';
  try {
    await axios.get(req.p.api, { timeout: 100000 });
    result = 'Valid API';
  } catch (e) {
    result = 'Invalid Transtional API';
  }
  res.json(result);
}));

module.exports = router;
