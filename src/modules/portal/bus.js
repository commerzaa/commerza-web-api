'use strict';
// Ported from ClusterofferShopingPortal\Controllers\Bus.cs (class BusController => /portal/Bus/...)
// Static view. [CheckResellerTimeout]: no check in legacy.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// public
// route-config: "Bus" -> Bus/Index
router.all(['/portal/Bus/Index{/:id}', '/portal/Bus'], ps.portalSession,
  asyncHandler(async (req, res) => res.json({ view: '~/Views/Bus/Index.cshtml' })));

module.exports = router;
