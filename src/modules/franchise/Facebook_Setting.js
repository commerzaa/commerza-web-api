'use strict';
/** Port of Franchise/Controllers/CustomerPanel/Facebook_Setting.cs. DB: 'shopping' */
const express = require('express');
const { query, scalar, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const router = express.Router();
const DB = 'shopping';
const s = (v) => (v === null || v === undefined ? '' : String(v));
const pint = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const totalOf = (rows, name = 'totalcount') => { const f = rows && rows[0]; if (!f) return 0; const k = Object.keys(f).find((x) => x.toLowerCase() === name); return k === undefined ? 0 : (parseInt(f[k], 10) || 0); };
const PROPS = ['CompanyInfoEmailid', 'CompanySupportEmailid', 'CompanySendmailEmailid', 'CompanyNoReplyEmailid', 'CompanyMailServer', 'CompanyMailPassowrd',
  'CompanyMailServerPort', 'CompanyAffiliateURL', 'CompanyResellerURL', 'CompanyMerchantURL', 'CompanyAdminURL', 'CompanyAPIURL', 'CompanyAdvertisement',
  'CompanyServices', 'CompanyCurrency', 'CompanyValidURL', 'CompanyScope', 'CompanyClientID', 'CompanyRedirect', 'CompanyLogout', 'CompanyFacebookClientID',
  'CompanyFacebookClientSecret', 'CompanyPGMerchantKEY', 'CompanyPGSALT', 'CompanyOauthURL', 'SMSAPI', 'DedicatedProductURL', 'TRANSATIONPAYUMONEYRATE'];

// route-config: franchisee/Facebook-Setting
// auth
router.all(['/franchise/Facebook_Setting/Index{/:id}', '/franchise/franchisee/Facebook-Setting'], auth, asyncHandler(async (req, res) => {
  const Pmid = Number(req.user.pmid);
  const rows = await proc(DB, 'usp_getcompanyprofiledetails', { pmid: Pmid });
  res.json({ Model: mapRows(rows, PROPS) });
}));

// auth
router.all('/franchise/Facebook_Setting/SettingFacebook{/:id}', auth, asyncHandler(async (req, res) => {
  const Pmid = Math.trunc(Number(req.user.pmid));
  const row = await procOne(DB, 'usp_facebook_setting', {
    companyfacebookclientid: req.p.FbClienID, companyfacebookclientsecret: req.p.FbClientsecret, pmid: Pmid,
  });
  const k = row && Object.keys(row).find((x) => x.toLowerCase() === 'result');
  res.json(s(k ? row[k] : (row ? row[Object.keys(row)[0]] : '')));
}));

module.exports = router;
