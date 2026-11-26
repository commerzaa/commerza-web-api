'use strict';
// Ported from ClusterofferShopingPortal\Controllers\Support.cs (class supportController => /portal/support/...)
// Database: shopping (Db_Shopping).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { seoViewBag } = require('./_shared/batch-14-common');

const router = express.Router();
const C = 'support';

// ---------------------------------------------------------------- ActionResult Index()
// public ([CheckResellerTimeout] = no check)
// route-config: "support" -> support/Index
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`], ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  const ViewBag = await seoViewBag(req, 22);
  return res.json({ view: '~/Views/support/Index.cshtml', ...ViewBag });
}));

module.exports = router;
