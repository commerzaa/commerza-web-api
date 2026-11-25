'use strict';
// Ported from ClusterofferShopingPortal\Controllers\AdvertiseWithUsController.cs (class advertise_with_usController => /portal/advertise_with_us/...)
// Database: shopping (Db_Shopping) - only via WebsiteDetail. [CheckResellerTimeout]: no check in legacy.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { seoViewBag } = require('./_shared/batch-01-common');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// public
// route-config: "advertise-with-us/{action}" (action default Index) -> advertise_with_us/Index
router.all(['/portal/advertise_with_us/Index{/:id}', '/portal/advertise-with-us', '/portal/advertise-with-us/Index'], ps.portalSession,
  asyncHandler(async (req, res) => {
    const ViewBag = await seoViewBag(req, 2);
    return res.json({ view: '~/Views/advertise_with_us/Index.cshtml', ViewBag });
  }));

module.exports = router;
