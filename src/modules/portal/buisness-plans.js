'use strict';
// Ported from ClusterofferShopingPortal\Controllers\Buisness_Plans.cs (class Buisness_PlansController => /portal/Buisness_Plans/...)
// Static view. [CheckResellerTimeout]: no check in legacy.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// public
// route-config: "Buisness-Plans" -> Buisness_Plans/Index
router.all(['/portal/Buisness_Plans/Index{/:id}', '/portal/Buisness-Plans'], ps.portalSession,
  asyncHandler(async (req, res) => res.json({ view: '~/Views/Buisness_Plans/Index.cshtml' })));

module.exports = router;
