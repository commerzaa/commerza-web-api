'use strict';
// Ported from ClusterofferShopingPortal\Controllers\ReferralOuterController.cs (class ReferralOuterController, [CheckResellerTimeout] = no check)
// Database: shopping (Db_Shopping) via WebsiteDetail lib.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { pageUrl, seoViewBag } = require('./_shared/batch-13-common');

const router = express.Router();
const C = 'ReferralOuter';

/** Common body of the three actions (they differ only in the view). */
function page(view) {
  return asyncHandler(async (req, res) => {
    const ViewBag = {};
    // For Domain Management Code: reading Request.Url cannot throw here; legacy catch set ViewBag.Message = Exp.Message.
    try {
      pageUrl(req);
    } catch (Exp) {
      ViewBag.Message = Exp.message;
    }
    const PageUrl = pageUrl(req);
    ViewBag.Canonical = PageUrl;
    await seoViewBag(ViewBag, 1);
    return res.json({ view, ...ViewBag });
  });
}

// ---------------------------------------------------------------- Index()
// public (outer page). Note: RouteConfig "referral-how-it-works" points at AdvertiseAndSellOuter, not here.
router.all([`/portal/${C}`, `/portal/${C}/Index{/:id}`], ps.CheckResellerTimeout, page('~/Views/referral/referral-how-it-works.cshtml'));

// ---------------------------------------------------------------- Referral_Commissions()
// public
// route-config: "referral-commissions"
router.all([`/portal/${C}/Referral_Commissions{/:id}`, '/portal/referral-commissions'], ps.CheckResellerTimeout,
  page('~/Views/referral/referral-commissions.cshtml'));

// ---------------------------------------------------------------- Referral_Marketing_Tools()
// public
// route-config: "referral-marketing-tools"
router.all([`/portal/${C}/Referral_Marketing_Tools{/:id}`, '/portal/referral-marketing-tools'], ps.CheckResellerTimeout,
  page('~/Views/referral/referral-marketing-tools.cshtml'));

module.exports = router;
