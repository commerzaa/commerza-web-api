'use strict';
// Ported from ClusterofferShopingPortal\Controllers\OuterPages.cs (class OuterPagesController, 12 actions)
// Database: shopping (Db_Shopping) - DB access inside WebsiteDetail.
// [CheckResellerTimeout] / [DistributerSessionExpireCheck]: bodies commented out in legacy -> no check (ps.portalSession).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { seoViewBag } = require('./_shared/batch-12-common');

const router = express.Router();
const BASE = '/portal/OuterPages';

// [action, view, route-config urls]. Every action: "Domain Management" block (Request.Url reads only), then
// ViewBag Canonical/Title/MetaDesc/MetaKeyword from WebsiteDetail.GetWebsiteInfo(22).
const PAGES = [
  ['Career', '~/Views/Career/Index.cshtml', ['career']],
  ['AdvertiseSell', '~/Views/AdvertiseSell/Index.cshtml', ['advertise-sell']],
  ['Disclaimer', '~/Views/Disclaimer/Index.cshtml', ['disclaimer']],
  ['ReturnPolicy', '~/Views/ReturnPolicy/Index.cshtml', ['return-policy']],
  ['ReportInfringement', '~/Views/ReportInfringement/Index.cshtml', ['report-infringement']],
  ['TermAndConditionRefferal', '~/Views/TermAndConditionRefferal/Index.cshtml', ['term-and-condition-referral']],
  ['TermAndConditionAdvertiseSell', '~/Views/TermAndConditionAdvertiseSell/Index.cshtml', ['term-and-condition-advertise-sell']],
  ['PrivacyPolicyReferral', '~/Views/PrivacyPolicyReferral/Index.cshtml', ['privacy-policy-referral']],
  // PORT-NOTE: legacy RouteConfig url was " privacy-policy-advertise-sell" (leading space); registered trimmed.
  ['PrivacyPolicyAdvertiseSell', '~/Views/PrivacyPolicyAdvertiseSell/Index.cshtml', ['privacy-policy-advertise-sell']],
  ['PaymentRefferal', '~/Views/PaymentRefferal/Index.cshtml', ['payment-referral']],
  ['PaymentRefferalSell', '~/Views/PaymentRefferalSell/Index.cshtml', ['payment-advertise-sell']],
  ['Benefites', '~/Views/benefites/Index.cshtml', ['advertise-benefits']],
];

for (const [action, view, friendly] of PAGES) {
  // public (outer page)
  // route-config: see PAGES
  router.all([`${BASE}/${action}{/:id}`, ...friendly.map((u) => `/portal/${u}`)], ps.DistributerSessionExpireCheck,
    asyncHandler(async (req, res) => {
      const ViewBag = await seoViewBag(req, 22);
      res.json({ view, ViewBag });
    }));
}

module.exports = router;
