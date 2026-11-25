'use strict';
// Ported from ClusterofferShopingPortal\Controllers\PrivacyPolicyController.cs (class privacy_policyController, 1 action)
// Database: shopping (Db_Shopping) - DB access inside WebsiteDetail.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { seoViewBag } = require('./_shared/batch-12-common');

const router = express.Router();

// ---------------------------------------------------------------- Index()  [DistributerSessionExpireCheck] (no check in legacy)
async function Index(req, res) {
  // "Domain Management" block only read Request.Url parts (redirects commented out) -> nothing to port.
  const ViewBag = await seoViewBag(req, 10);
  res.json({ view: '~/Views/privacy_policy/Index.cshtml', ViewBag });
}

// public
// route-config: "privacy-policy/{action}" (default Index) -> privacy_policy
router.all(['/portal/privacy_policy', '/portal/privacy_policy/Index{/:id}', '/portal/privacy-policy{/Index}'],
  ps.DistributerSessionExpireCheck, asyncHandler(Index));

module.exports = router;
