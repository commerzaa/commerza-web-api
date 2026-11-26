'use strict';
// Ported from ClusterofferShopingPortal\Controllers\AffiliateProductController.cs (class AffiliateProductController => /portal/AffiliateProduct/...)
// [CheckResellerTimeout]: no check in legacy. Route-config entry "affiliate-program-product" is commented out in legacy (not registered).
const express = require('express');
const axios = require('axios');
const asyncHandler = require('../../middleware/asyncHandler');
const config = require('../../config');
const ps = require('./_shared/portal-session');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// public
router.all('/portal/AffiliateProduct/Index{/:id}', ps.portalSession, asyncHandler(async (req, res) => {
  const ViewBag = {};
  // WebClient.DownloadString with the Flipkart affiliate headers.
  // PORT-NOTE: affiliate id and token were hard-coded in C#; read from config.app.FkAffiliateId / config.app.FkAffiliateToken.
  const resp = await axios.get('https://affiliate-api.flipkart.net/affiliate/offers/v1/all/json', {
    headers: {
      'Fk-Affiliate-Id': (config.app.FkAffiliateId || ''),
      'Fk-Affiliate-Token': (config.app.FkAffiliateToken || ''),
    },
    responseType: 'text',
    transformResponse: [(d) => d],
  });
  // (JObject)JsonConvert.DeserializeObject(AllResHere); ObjJObject["apiListings"] (missing key => null)
  const ObjJObject = JSON.parse(resp.data);
  const JsonProductData = ObjJObject && Object.prototype.hasOwnProperty.call(ObjJObject, 'apiListings') ? ObjJObject.apiListings : null;
  ViewBag.JsonProductData = JsonProductData;
  return res.json({ view: '~/Views/AffiliateProduct/Index.cshtml', ViewBag });
}));

module.exports = router;
