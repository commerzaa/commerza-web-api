'use strict';
// Ported from ClusterofferShopingPortal\Controllers\BusinessDeals.cs (class businessdealsController => /portal/businessdeals/...)
// Database: shopping (Db_Shopping) - only via WebsiteDetail. [CheckResellerTimeout]: no check in legacy. No route-config entry.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { seoViewBag } = require('./_shared/batch-01-common');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// public
router.all('/portal/businessdeals/Index{/:id}', ps.portalSession, asyncHandler(async (req, res) => {
  const ViewBag = await seoViewBag(req, 1);
  return res.json({ view: '~/Views/businessdeal/Index.cshtml', ViewBag });
}));

module.exports = router;
