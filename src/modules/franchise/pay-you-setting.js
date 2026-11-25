'use strict';
// Ported from Franchise\Controllers\CustomerPanel\PayYou_Setting.cs (database: shopping - Franchise DataBaseContext points at Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const { mapRows } = require('../../utils/shape');
const CP = ['CompanyInfoEmailid', 'CompanySupportEmailid', 'CompanySendmailEmailid', 'CompanyNoReplyEmailid', 'CompanyMailServer', 'CompanyMailPassowrd', 'CompanyMailServerPort', 'CompanyAffiliateURL', 'CompanyResellerURL', 'CompanyMerchantURL', 'CompanyAdminURL', 'CompanyAPIURL', 'CompanyAdvertisement', 'CompanyServices', 'CompanyCurrency', 'CompanyValidURL', 'CompanyScope', 'CompanyClientID', 'CompanyRedirect', 'CompanyLogout', 'CompanyFacebookClientID', 'CompanyFacebookClientSecret', 'CompanyPGMerchantKEY', 'CompanyPGSALT', 'CompanyOauthURL', 'SMSAPI', 'DedicatedProductURL', 'TRANSATIONPAYUMONEYRATE'];
const router = express.Router();
const guard = [auth, requireType('franchise')];
const P = '/franchise/PayYou_Setting';

// auth
router.all(`${P}/Index{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const Pmid = Number(req.user.pmid);
  // List<CompanyProfile>: keys kept as returned by the procedure (lower-cased by PostgreSQL)
  const comdetails = await db.proc('shopping', 'usp_getcompanyprofiledetails', { Pmid });
  const v = await db.scalar('shopping', 'SELECT coalesce(ispayuactive::int,0) FROM tbl_companysettings WHERE pmid = @pmid LIMIT 1', { pmid: Pmid });
  const IsPayuActive = v === null || v === undefined ? 0 : Number(v);
  res.json({ Model: mapRows(comdetails, CP), IsPayuActive });
}));

// auth
router.all(`${P}/SettingPayYou{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const Pmid = parseInt(req.user.pmid, 10);
  const { PGMerchantKey, Pgsalt, Payutransationrate } = req.p;
  const rows = await db.proc('shopping', 'usp_payyou_setting', {
    CompanyPGMerchantKEY: PGMerchantKey, CompanyPGSALT: Pgsalt, Pmid, Payutransationrate,
  });
  // @Result OUT => 'result' column
  const r = rows.length ? rows[0].result : null;
  if (r === null || r === undefined) throw new TypeError('Object reference not set to an instance of an object.');
  res.json(String(r));
}));

// auth
router.all(`${P}/UpdatePaymentGateway{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const Pmid = parseInt(req.user.pmid, 10);
  const raw = req.p.Ischecked;
  const Ischecked = (raw === undefined || raw === null || raw === '') ? 0 : parseInt(raw, 10);
  try {
    await db.exec('shopping', 'UPDATE tbl_companysettings SET ispayuactive = (@v <> 0) WHERE pmid = @pmid', { v: Ischecked, pmid: Pmid });
  } catch (ex) { console.error(ex.message); } // legacy: resultStatus = "ERROR" (unused)
  res.json(Ischecked);
}));

module.exports = router;
