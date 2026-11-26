'use strict';
// Ported from ClusterofferShopingPortal\Controllers\SocialMediaPromo.cs (class socialmediapromoController => /portal/socialmediapromo/...)
// Database: shopping (Db_Shopping).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { seoViewBag } = require('./_shared/batch-14-common');

const router = express.Router();
const C = 'socialmediapromo';

// ---------------------------------------------------------------- ActionResult Index()
// public ([CheckResellerTimeout] = no check)
// route-config: "social-media-promotion" -> socialmediapromo/Index
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, '/portal/social-media-promotion'], ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  const ViewBag = await seoViewBag(req, 20);
  return res.json({ view: '~/Views/socialmediapromo/Index.cshtml', ...ViewBag });
}));

module.exports = router;
