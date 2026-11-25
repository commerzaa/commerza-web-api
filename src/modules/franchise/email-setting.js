'use strict';
/** Ported from Franchise\Controllers\CustomerPanel\EmailSetting.cs (EmailSettingController) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const P = '/franchise/EmailSetting';

const PROFILE = ['CompanyInfoEmailid', 'CompanySupportEmailid', 'CompanySendmailEmailid', 'CompanyNoReplyEmailid', 'CompanyMailServer', 'CompanyMailPassowrd',
  'CompanyMailServerPort', 'CompanyAffiliateURL', 'CompanyResellerURL', 'CompanyMerchantURL', 'CompanyAdminURL', 'CompanyAPIURL', 'CompanyAdvertisement',
  'CompanyServices', 'CompanyCurrency', 'CompanyValidURL', 'CompanyScope', 'CompanyClientID', 'CompanyRedirect', 'CompanyLogout', 'CompanyFacebookClientID',
  'CompanyFacebookClientSecret', 'CompanyPGMerchantKEY', 'CompanyPGSALT', 'CompanyOauthURL', 'SMSAPI', 'DedicatedProductURL', 'TRANSATIONPAYUMONEYRATE'];

// auth // route-config: franchisee/Email-Setting
router.all([`${P}/Index{/:id}`, '/franchise/franchisee/Email-Setting'], auth, asyncHandler(async (req, res) => {
  const Pmid = Number(req.user.pmid);
  const rows = await proc('shopping', 'USP_GETCOMPANYPROFILEDETAILS', { pmid: Pmid });
  res.json(mapRows(rows, PROFILE));
}));

// auth
router.all(`${P}/SettingEmail{/:id}`, auth, asyncHandler(async (req, res) => {
  const { EmailID, Mail_Server, SMTP_Port, Mail_Password } = req.p;
  const Pmid = Math.trunc(Number(req.user.pmid));
  const rows = await proc('shopping', 'Usp_Email_Setting', {
    companymailserver: Mail_Server, companymailpassowrd: Mail_Password, companymailserverport: SMTP_Port, companysendmailemailid: EmailID, pmid: Pmid,
  });
  const r = rows[0] || {};
  res.json(r.result == null ? '' : String(r.result));
}));

module.exports = router;
