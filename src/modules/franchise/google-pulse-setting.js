'use strict';
// Ported from Franchise\Controllers\CustomerPanel\GooglePulse_Setting.cs  (database: shopping — Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const router = express.Router();
const P = '/franchise/GooglePulse_Setting';

const COMPANYPROFILE = ['CompanyInfoEmailid', 'CompanySupportEmailid', 'CompanySendmailEmailid', 'CompanyNoReplyEmailid', 'CompanyMailServer', 'CompanyMailPassowrd', 'CompanyMailServerPort', 'CompanyAffiliateURL', 'CompanyResellerURL', 'CompanyMerchantURL', 'CompanyAdminURL', 'CompanyAPIURL', 'CompanyAdvertisement', 'CompanyServices', 'CompanyCurrency', 'CompanyValidURL', 'CompanyScope', 'CompanyClientID', 'CompanyRedirect', 'CompanyLogout', 'CompanyFacebookClientID', 'CompanyFacebookClientSecret', 'CompanyPGMerchantKEY', 'CompanyPGSALT', 'CompanyOauthURL', 'SMSAPI', 'DedicatedProductURL', 'TRANSATIONPAYUMONEYRATE'];

async function Index(req, res) {
  const Pmid = Number(req.user.pmid);
  const rows = await db.proc('shopping', 'usp_getcompanyprofiledetails', { Pmid });
  const comdetails = mapRows(rows, COMPANYPROFILE);
  res.json({ Model: comdetails });
}
// auth
router.all(P + '/Index{/:id}', auth, asyncHandler(Index));
// route-config: franchisee/GooglePluse-Setting
router.all('/franchise/franchisee/GooglePluse-Setting{/:id}', auth, asyncHandler(Index));

// auth
router.all(P + '/SettingGoogePluse{/:id}', auth, asyncHandler(async (req, res) => {
  const { AuthURL, validURL, Scope, ClientId, Redirect, Logout } = req.p;
  const Pmid = parseInt(req.user.pmid, 10);
  const r = await db.procOne('shopping', 'usp_googlepluse_setting', {
    companyauthourl: AuthURL, companyvalidurl: validURL, companyscope: Scope, companyclientid: ClientId,
    companyredirect: Redirect, companylogout: Logout, pmid: Pmid,
  });
  const out = r ? (('result' in r) ? r.result : r[Object.keys(r)[0]]) : null;
  res.json(String(out === null || out === undefined ? '' : out));
}));

module.exports = router;
