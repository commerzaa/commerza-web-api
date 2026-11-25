'use strict';
// Ported from ClusterofferShopingPortal\Controllers\SiteMapController.cs (class sitemapController => /portal/sitemap/...)
// Database: shopping (Db_Shopping).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { seoViewBag } = require('./_shared/batch-14-common');

const router = express.Router();
const C = 'sitemap';

// ---------------------------------------------------------------- ActionResult Index()
// public (no session check)
// route-config: "sitemap/{action}" -> sitemap/Index
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`], asyncHandler(async (req, res) => {
  const ViewBag = await seoViewBag(req, 14);
  return res.json({ view: '~/Views/sitemap/Index.cshtml', ...ViewBag });
}));

module.exports = router;
