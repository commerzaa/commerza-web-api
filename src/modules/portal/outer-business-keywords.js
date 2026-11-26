// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\OuterBusinessKeywords.cs
'use strict';
const DB = 'shopping'; // eslint-disable-line no-unused-vars
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const DAL_BusinessListing = require('../../lib/portal/DAL_BusinessListing');

const router = express.Router();

// auth (Session["PLID"] == null -> RedirectToAction("Index","Home"))
// route-config: outer-business-keywords
router.all(['/portal/OuterBusinessKeywords/Index{/:id}', '/portal/outer-business-keywords'], ps.customerAuth, asyncHandler(async (req, res) => {
  let CountryId = 0;
  if (ps.isCustomer(req)) {
    CountryId = req.user.cid;
  }
  const Obj = {};
  Obj.LiGetKeywordForBusinessListing = await DAL_BusinessListing.GetKeyword();
  Obj.LiSTATE = await DAL_BusinessListing.GetSTATE(CountryId);
  Obj.LiCity = await DAL_BusinessListing.GetCity(CountryId);
  // model BusinessListingAll { LiSTATE, LiCity, LiGetKeywordForBusinessListing }
  res.json({ Model: { LiSTATE: Obj.LiSTATE, LiCity: Obj.LiCity, LiGetKeywordForBusinessListing: Obj.LiGetKeywordForBusinessListing } });
}));

module.exports = router;
