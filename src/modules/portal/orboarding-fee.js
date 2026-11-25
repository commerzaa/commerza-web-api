// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\Orboarding_FeeController.cs
'use strict';
// Database: shopping (Db_Shopping) - not used: the action only returns a view.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');

const router = express.Router();

// public ([CheckResellerTimeout] / [DistributerSessionExpireCheck]: bodies commented out in legacy => no check)
// route-config: orboarding-fee
router.all(['/portal/Orboarding_Fee/Index{/:id}', '/portal/orboarding-fee'], ps.DistributerSessionExpireCheck, asyncHandler(async (req, res) => {
  // return View("~/Views/Orboarding_Fee/Index.cshtml") - no model / ViewBag
  res.json({});
}));

module.exports = router;
