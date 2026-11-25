'use strict';
// Ported from Shoping Portal Merchant Panel\Controllers\GetAccessToken.cs (Web API controller inside the MVC app; database: shopping)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'shopping';

const KEYS = ['Email', 'token', 'Name', 'Country', 'Mobile', 'IdToken', 'RefreshToken', 'SessionId'];
const get = (o, k) => {
  const v = o ? o[k] : undefined;
  if (v === undefined || v === null) throw new Error('Object reference not set to an instance of an object.'); // JObject null .ToString()
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
};

// public (token hand-off endpoint called by the identity server; no session in legacy)
// route-config: WebApiConfig  api/GetAccessToken -> GetAccessToken/Index
router.all(['/merchant/GetAccessToken/Index{/:id}', '/merchant/api/GetAccessToken'], asyncHandler(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ Message: 'The requested resource does not support http method \'' + req.method + '\'.' });
  try {
    const JsonObject = req.body || {};
    const v = {};
    for (const k of KEYS) v[k] = get(JsonObject, k);
    await db.proc(DB, 'usp_getaccesstoken_merchant', {
      email: v.Email, token: v.token, name: v.Name, country: v.Country, mobile: v.Mobile, idtoken: v.IdToken, refreshtoken: v.RefreshToken, sessionid: v.SessionId,
    });
    return res.json({ Message: 'success' });
  } catch (EX) {
    return res.json({ Message: 'error' });
  }
}));

module.exports = router;
