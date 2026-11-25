'use strict';
// Ported from ClusterofferShopingPortal\Controllers\ReferralProgramController.cs (class referralprogramController, [CheckResellerTimeout] = no check)
// Database: shopping (Db_Shopping) via WebsiteDetail lib.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { pageUrl, seoViewBag } = require('./_shared/batch-13-common');

const router = express.Router();
const C = 'referralprogram';

// ---------------------------------------------------------------- Index()
// public ([CheckResellerTimeout] body commented out in legacy; outer page). RouteConfig "referralprogram/{action}" is commented out.
router.all([`/portal/${C}`, `/portal/${C}/Index{/:id}`], ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  const ViewBag = {};
  // Domain-management block: only read the URL (redirect logic commented out in legacy).
  const PageUrl = pageUrl(req);
  ViewBag.Canonical = PageUrl;
  await seoViewBag(ViewBag, 3);
  return res.json({ view: '~/Views/referralprogram/Index.cshtml', ...ViewBag });
}));

module.exports = router;
