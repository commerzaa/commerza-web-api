'use strict';
// Ported from ClusterofferShopingPortal\Controllers\BmsBlasting.cs (class smsblastingController => /portal/smsblasting/...)
// Database: shopping (Db_Shopping) - only via WebsiteDetail. [CheckResellerTimeout]: no check in legacy.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { seoViewBag } = require('./_shared/batch-01-common');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// public
// route-config: "sms-blasting" -> smsblasting/Index
router.all(['/portal/smsblasting/Index{/:id}', '/portal/sms-blasting'], ps.portalSession, asyncHandler(async (req, res) => {
  const ViewBag = await seoViewBag(req, 18);
  return res.json({ view: '~/Views/smsblasting/Index.cshtml', ViewBag });
}));

module.exports = router;
