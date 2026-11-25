'use strict';
/** Port of Franchise/Controllers/CustomerPanel/Company_Profile.cs. DB: 'shopping' */
const express = require('express');
const { proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'shopping';
const s = (v) => (v === null || v === undefined ? '' : String(v));
const PROPS = ['CompanyInfoEmailid', 'CompanySupportEmailid', 'CompanySendmailEmailid', 'CompanyNoReplyEmailid', 'CompanyMailServer', 'CompanyMailPassowrd',
  'CompanyMailServerPort', 'CompanyAffiliateURL', 'CompanyResellerURL', 'CompanyMerchantURL', 'CompanyAdminURL', 'CompanyAPIURL', 'CompanyAdvertisement',
  'CompanyServices', 'CompanyCurrency', 'CompanyValidURL', 'CompanyScope', 'CompanyClientID', 'CompanyRedirect', 'CompanyLogout', 'CompanyFacebookClientID',
  'CompanyFacebookClientSecret', 'CompanyPGMerchantKEY', 'CompanyPGSALT', 'CompanyOauthURL', 'SMSAPI', 'DedicatedProductURL', 'TRANSATIONPAYUMONEYRATE'];

// route-config: franchisee/company-profile
// auth
router.all(['/franchise/Company_Profile/Index{/:id}', '/franchise/franchisee/company-profile'], auth, asyncHandler(async (req, res) => {
  const Pmid = Number(req.user.pmid);
  const rows = await proc(DB, 'usp_getcompanyprofiledetails', { pmid: Pmid });
  res.json({ Model: mapRows(rows, PROPS) });
}));

// auth
router.all('/franchise/Company_Profile/Insert_ComapnyProfileDetail{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const pmid = Number(req.user.pmid);
  const row = await procOne(DB, 'usp_addcompanyprofiledetails', {
    pmid, companyinfoemailid: p.CompanyInfoEmailid, companysupportemailid: p.CompanySupportEmailid, companysendmailemailid: p.CompanySendmailEmailid,
    companynoreplyemailid: p.CompanyNoReplyEmailid, companymailserver: p.CompanyMailServer, companymailpassowrd: p.CompanyMailPassowrd,
    companymailserverport: p.CompanyMailServerPort, companyaffiliateurl: p.CompanyAffiliateURL, companyresellerurl: p.CompanyResellerURL,
    companymerchanturl: p.CompanyMerchantURL, companyadminurl: p.CompanyAdminURL, companyapiurl: p.CompanyAPIURL, companyadvertisement: p.CompanyAdvertisement,
    companyservices: p.CompanyServices, companycurrency: p.CompanyCurrency, companyvalidurl: p.CompanyValidURL, companyscope: p.CompanyScope,
    companyclientid: p.CompanyClientID, companyredirect: p.CompanyRedirect, companylogout: p.CompanyLogout, companyfacebookclientid: p.CompanyFacebookClientID,
    companyfacebookclientsecret: p.CompanyFacebookClientSecret, companypgmerchantkey: p.CompanyPGMerchantKEY, companypgsalt: p.CompanyPGSALT,
    companyauthourl: p.CompanyAuthoURL, dedicatedproducturl: p.DedicatedProductURL, smsapi: p.SMSAPI,
  });
  const k = row && Object.keys(row).find((x) => x.toLowerCase() === 'intresult');
  res.json(s(k ? row[k] : (row ? row[Object.keys(row)[0]] : '')));
}));

module.exports = router;
