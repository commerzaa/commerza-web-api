'use strict';
// Ported from ClusterofferShopingPortal\Controllers\BusinessProfile.cs (class businessprofileController => /portal/businessprofile/...)
// Database: shopping (Db_Shopping) - only via WebsiteDetail. [CheckResellerTimeout]: no check in legacy.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { seoViewBag } = require('./_shared/batch-01-common');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// public
// route-config: "businessprofile" -> businessprofile/Index
router.all(['/portal/businessprofile/Index{/:id}', '/portal/businessprofile'], ps.portalSession, asyncHandler(async (req, res) => {
  const ViewBag = await seoViewBag(req, 1);
  return res.json({ view: '~/Views/businessprofile/Index.cshtml', ViewBag });
}));

module.exports = router;
