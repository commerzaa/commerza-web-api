'use strict';
// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\Emailblasting.cs (class emailblastingController => /portal/emailblasting/...)
// Database: shopping (Db_Shopping). [CheckResellerTimeout] = no check (body commented out in legacy).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { pageUrl, seoViewBag } = require('./_shared/batch-09-common');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// (domain-management redirect block is commented out in the C#)
// route-config: "email-blasting" -> emailblasting/Index
// public
router.all(['/portal/emailblasting/Index{/:id}', '/portal/emailblasting', '/portal/email-blasting'], ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  const ViewBag = {};
  ViewBag.Canonical = pageUrl(req);
  Object.assign(ViewBag, await seoViewBag(17));
  return res.json({ view: '~/Views/emailblasting/Index.cshtml', ...ViewBag });
}));

module.exports = router;
