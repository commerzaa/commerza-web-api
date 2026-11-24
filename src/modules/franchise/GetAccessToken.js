'use strict';
// Ported from Franchise\Controllers\GetAccessToken.cs (Web API controller inside the MVC app; database: shopping)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();

const KEYS = ['Email', 'token', 'Name', 'Mobile', 'IdToken', 'RefreshToken', 'SessionId', 'ExpiresAt', 'Kyc_Status', 'SponsorId', 'Country', 'UserName', 'ReferralURl'];
const get = (o, k) => {
  const v = o ? o[k] : undefined;
  if (v === undefined || v === null) throw new Error('Object reference not set to an instance of an object.'); // JObject null .ToString()
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
};

// public (token hand-off endpoint called by the identity server; no session in legacy)
// route-config: WebApiConfig  api/GetAccessToken -> GetAccessToken/Index
router.all(['/franchise/GetAccessToken/Index{/:id}', '/franchise/api/GetAccessToken'], asyncHandler(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ Message: 'The requested resource does not support http method \'' + req.method + '\'.' });
  try {
    const JsonObject = req.body || {};
    const v = {};
    for (const k of KEYS) v[k] = get(JsonObject, k);
    await db.proc('shopping', 'usp_getaccesstoken_franchise', {
      EMAIL: v.Email, TOKEN: v.token, NAME: v.Name, COUNTRY: v.Country, MOBILE: v.Mobile, IDTOKEN: v.IdToken, REFRESHTOKEN: v.RefreshToken,
      SESSIONID: v.SessionId, EXPIRESAT: v.ExpiresAt, KYC_STATUS: v.Kyc_Status, SPONSORID: v.SponsorId, USERNAME: v.UserName, REFERRALURL: v.ReferralURl,
    });
    return res.json({ Message: 'success' });
  } catch (EX) {
    return res.json({ Message: 'error ' + EX.message });
  }
}));

module.exports = router;
