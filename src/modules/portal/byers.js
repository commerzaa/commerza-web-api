'use strict';
// Ported from ClusterofferShopingPortal\Controllers\ByersController.cs (class ByersController => /portal/Byers/...)
// Static view. [CheckResellerTimeout] / [DistributerSessionExpireCheck]: bodies commented out in legacy => no check.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// public
// route-config: "byers" -> Byers/Index
router.all(['/portal/Byers/Index{/:id}', '/portal/byers'], ps.DistributerSessionExpireCheck,
  asyncHandler(async (req, res) => res.json({ view: '~/Views/Byers/Index.cshtml' })));

module.exports = router;
