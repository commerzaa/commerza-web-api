'use strict';
// Ported from ClusterofferShopingPortal\Controllers\ClassifiedAdsController.cs (class ClassifiedAdController => /portal/ClassifiedAd/...)
// Database: shopping (Db_Shopping) - only via WebsiteDetail. [CheckResellerTimeout]: no check in legacy.
// (Not to be confused with the ClassifiedAds controller of another file: this class is "ClassifiedAd", one action.)
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { seoViewBag } = require('./_shared/batch-01-common');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// public
// route-config: "classified-ads/{action}" (action default Index) -> ClassifiedAd/Index
router.all(['/portal/ClassifiedAd/Index{/:id}', '/portal/classified-ads', '/portal/classified-ads/Index'], ps.portalSession,
  asyncHandler(async (req, res) => {
    const ViewBag = await seoViewBag(req, 8);
    return res.json({ view: '~/Views/ClassifiedAd/Index.cshtml', ViewBag });
  }));

module.exports = router;
