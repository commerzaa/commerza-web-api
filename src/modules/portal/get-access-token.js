'use strict';
// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\GetAccessToken.cs
// (Web API class GetAccessTokenController : ApiController, [HttpGet, HttpPost] Index([FromBody] JObject))
// Database: shopping (Db_Shopping). WebApiConfig route "api/GetAccessToken" -> GetAccessToken/Index.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { DB, NRE } = require('./_shared/batch-09-common');

const router = express.Router();

/** JsonObject["X"].ToString() : missing key / null body => NullReferenceException. */
function jget(o, k) {
  if (!o || typeof o !== 'object' || !Object.prototype.hasOwnProperty.call(o, k)) throw NRE();
  const v = o[k];
  if (v === null) return '';
  return typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);
}

// ---------------------------------------------------------------- Index([FromBody] JObject JsonObject)
// route-config (WebApiConfig): "api/GetAccessToken"
// public (legacy API had no authentication; called by the external SSO/app with the token data)
router.route(['/portal/GetAccessToken/Index{/:id}', '/portal/GetAccessToken', '/portal/api/GetAccessToken'])
  .get(asyncHandler(handler))
  .post(asyncHandler(handler));

async function handler(req, res) {
  try {
    const JsonObject = req.body;
    const Email = jget(JsonObject, 'Email');
    const token = jget(JsonObject, 'token');
    const Name = jget(JsonObject, 'Name');
    const Country = jget(JsonObject, 'Country');
    const Mobile = jget(JsonObject, 'Mobile');
    const IdToken = jget(JsonObject, 'IdToken');
    const RefreshToken = jget(JsonObject, 'RefreshToken');
    const SessionId = jget(JsonObject, 'SessionId');
    await db.procExec(DB, 'usp_getaccesstoken', {
      email: Email, token, name: Name, country: Country, mobile: Mobile, idtoken: IdToken, refreshtoken: RefreshToken, sessionid: SessionId,
    });
    return res.json({ Message: 'success' });
  } catch (EX) {
    return res.json({ Message: 'error' });
  }
}

module.exports = router;
