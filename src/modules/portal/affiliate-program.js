'use strict';
// Ported from ClusterofferShopingPortal\Controllers\AffiliateProgramController.cs (class affiliateprogramController => /portal/affiliateprogram/...)
// Database: shopping (Db_Shopping) - only via WebsiteDetail. [CheckResellerTimeout]: no check in legacy.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { seoViewBag } = require('./_shared/batch-01-common');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// public
// route-config: "affiliate-program/{action}" (action default Index) -> affiliateprogram/Index
router.all(['/portal/affiliateprogram/Index{/:id}', '/portal/affiliate-program', '/portal/affiliate-program/Index'], ps.portalSession,
  asyncHandler(async (req, res) => {
    const ViewBag = await seoViewBag(req, 6);
    return res.json({ view: '~/Views/affiliateprogram/Index.cshtml', ViewBag });
  }));

module.exports = router;
