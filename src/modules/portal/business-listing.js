'use strict';
// Ported from ClusterofferShopingPortal\Controllers\BusinessListingController.cs (class BusinessListingController => /portal/BusinessListing/...)
// Database: shopping (Db_Shopping) - only via WebsiteDetail. [CheckResellerTimeout]: no check in legacy.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { seoViewBag } = require('./_shared/batch-01-common');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// public
// route-config: "business-listing" -> BusinessListing/Index
router.all(['/portal/BusinessListing/Index{/:id}', '/portal/business-listing'], ps.portalSession, asyncHandler(async (req, res) => {
  const ViewBag = await seoViewBag(req, 7);
  return res.json({ view: '~/Views/BusinessListing/Index.cshtml', ViewBag });
}));

module.exports = router;
