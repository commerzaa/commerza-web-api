'use strict';
// Ported from ClusterofferShopingPortal\Controllers\TraffficBoosterController.cs (class TrafficBoosterController => /portal/TrafficBooster/...)
// Database: shopping (Db_Shopping).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { seoViewBag } = require('./_shared/batch-14-common');

const router = express.Router();
const C = 'TrafficBooster';

// ---------------------------------------------------------------- ActionResult Index()
// public ([CheckResellerTimeout] = no check)
// route-config: "traffic-booster" -> TrafficBooster/Index
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, '/portal/traffic-booster'], ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  const ViewBag = await seoViewBag(req, 24);
  return res.json({ view: '~/Views/TrafficBooster/Index.cshtml', ...ViewBag });
}));

module.exports = router;
