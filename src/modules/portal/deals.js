'use strict';
// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\DealsController.cs (class DealsController => /portal/Deals/...)
// Database: shopping (Db_Shopping). [CheckResellerTimeout] = no check (body commented out in legacy).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { pageUrl, seoViewBag } = require('./_shared/batch-09-common');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// (domain-management redirect block is commented out in the C#; RouteConfig "deal-listings" is commented out too)
// public
router.all(['/portal/Deals/Index{/:id}', '/portal/Deals'], ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  const ViewBag = {};
  ViewBag.Canonical = pageUrl(req);
  Object.assign(ViewBag, await seoViewBag(9));
  return res.json({ view: '~/Views/Deals/Index.cshtml', ...ViewBag });
}));

module.exports = router;
