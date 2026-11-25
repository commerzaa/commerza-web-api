'use strict';
/**
 * Port of Franchise\Controllers\CustomerPanel\SMS_API.cs (SMS_APIController)
 * Actions: Index, SettingSMS_API (2)  [file is not in the .csproj but is ported]
 */
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const DB = 'shopping'; // Franchise DataBaseContext => Db_Shopping (Web.config)
const COMPANYPROFILE_PROPS = ['CompanyInfoEmailid', 'CompanySupportEmailid', 'CompanySendmailEmailid', 'CompanyNoReplyEmailid', 'CompanyMailServer', 'CompanyMailPassowrd', 'CompanyMailServerPort',
  'CompanyAffiliateURL', 'CompanyResellerURL', 'CompanyMerchantURL', 'CompanyAdminURL', 'CompanyAPIURL', 'CompanyAdvertisement', 'CompanyServices', 'CompanyCurrency', 'CompanyValidURL',
  'CompanyScope', 'CompanyClientID', 'CompanyRedirect', 'CompanyLogout', 'CompanyFacebookClientID', 'CompanyFacebookClientSecret', 'CompanyPGMerchantKEY', 'CompanyPGSALT', 'CompanyOauthURL',
  'SMSAPI', 'DedicatedProductURL', 'TRANSATIONPAYUMONEYRATE'];

// auth
router.all('/franchise/SMS_API/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const Pmid = Number(req.user.pmid);
  const rows = await db.proc(DB, 'USP_GETCOMPANYPROFILEDETAILS', { Pmid });
  res.json({ Model: mapRows(rows, COMPANYPROFILE_PROPS) });
}));

// auth
router.all('/franchise/SMS_API/SettingSMS_API{/:id}', auth, asyncHandler(async (req, res) => {
  const { FbClienID } = req.p;
  const Pmid = parseInt(req.user.pmid, 10);
  const r = await db.procOne(DB, 'usp_SMS_API', { SMSAPI: FbClienID, Pmid });
  const result = r && r.result !== null && r.result !== undefined ? String(r.result) : '';
  res.json(result);
}));

module.exports = router;
