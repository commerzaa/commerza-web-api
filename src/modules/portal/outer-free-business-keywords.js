'use strict';
// Ported from ClusterofferShopingPortal\Controllers\OuterFreeBusinessKeywords.cs (class OuterFreeBusinessKeywordsController, 1 action)
// Database: shopping (Db_Shopping) - DB access inside DAL_BusinessListing.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const DAL_BusinessListing = require('../../lib/portal/DAL_BusinessListing');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// Legacy: if (Session["PLID"] == null) return RedirectToAction("Index","Home") -> ps.customerAuth. [CheckResellerTimeout] = no check.
async function Index(req, res) {
  let CountryId = 0;
  if (ps.isCustomer(req)) {
    CountryId = req.user.cid;
  }
  const Obj = {};
  Obj.LiGetKeywordForBusinessListing = await DAL_BusinessListing.GetKeyword();
  Obj.LiSTATE = await DAL_BusinessListing.GetSTATE(CountryId);
  Obj.LiCity = await DAL_BusinessListing.GetCity(CountryId);
  res.json({ view: '~/Views/OuterFreeBusinessKeywords/Index.cshtml', Model: Obj });
}

// auth
// route-config: "outer-business-listing" -> OuterFreeBusinessKeywords/Index
router.all(['/portal/OuterFreeBusinessKeywords', '/portal/OuterFreeBusinessKeywords/Index{/:id}', '/portal/outer-business-listing{/:id}'],
  ps.customerAuth, asyncHandler(Index));

module.exports = router;
