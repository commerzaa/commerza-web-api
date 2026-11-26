'use strict';
// Ported from ClusterofferShopingPortal\Controllers\AboutUsController.cs (class about_usController => /portal/about_us/...)
// Database: shopping (Db_Shopping) - only via WebsiteDetail.
// [CheckResellerTimeout] / [DistributerSessionExpireCheck]: bodies commented out in legacy => no check (ps.portalSession).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { seoViewBag } = require('./_shared/batch-01-common');

const router = express.Router();
const C = '/portal/about_us';

// ---------------------------------------------------------------- Index()
// public
// route-config: "about-us/{action}" (action default Index) -> about_us/Index
router.all([`${C}/Index{/:id}`, '/portal/about-us', '/portal/about-us/Index'], ps.portalSession, asyncHandler(async (req, res) => {
  const ViewBag = {};
  // PORT-NOTE: legacy decrypted a hard-coded encrypted password here (UtilityClass.Decryptword("<literal>")) and never used it;
  // the literal is not copied (secret). Its only effect was ViewBag.Message on a decrypt exception, which cannot happen for that constant.
  await seoViewBag(req, 0, ViewBag);
  return res.json({ view: '~/Views/about_us/Index.cshtml', ViewBag });
}));

// ---------------------------------------------------------------- ShopNowMenu()
// public
// route-config: "shop-now-menu" -> about_us/ShopNowMenu ; "about-us/{action}"
router.all([`${C}/ShopNowMenu{/:id}`, '/portal/shop-now-menu', '/portal/about-us/ShopNowMenu'], ps.portalSession,
  asyncHandler(async (req, res) => res.json({ view: '~/Views/Partial_Views/ShopNowMenu.cshtml' })));

module.exports = router;
