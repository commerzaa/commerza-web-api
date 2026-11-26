'use strict';
// Ported from ClusterofferShopingPortal\Controllers\AdvertiseAndSellOuter.cs (class AdvertiseAndSellOuterController => /portal/AdvertiseAndSellOuter/...)
// Database: shopping (Db_Shopping) - only via WebsiteDetail. [CheckResellerTimeout]: no check in legacy. 9 actions.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { seoViewBag } = require('./_shared/batch-01-common');

const router = express.Router();
const C = '/portal/AdvertiseAndSellOuter';

// ---------------------------------------------------------------- Index()
// public
// route-config: "referral-how-it-works" -> AdvertiseAndSellOuter/Index
router.all([`${C}/Index{/:id}`, '/portal/referral-how-it-works'], ps.portalSession,
  asyncHandler(async (req, res) => res.json({ view: '~/Views/AdvertiseAndSellBenefits/Index.cshtml' })));

// Every other action: SEO block with WebsiteDetail.GetWebsiteInfo(2), then its own view.
// [action, view, route-config url]
const PAGES = [
  ['AdvertiseAndSellBenefits', '~/Views/AdvertiseAndSellBenefits/Index.cshtml', 'advertise-sell-benefits'],
  ['AdvertiseAndSellPricing', '~/Views/AdvertiseAndSellPricing/Index.cshtml', 'advertise-sell-pricing'],
  ['AdvertiseAndSellTermsConditions', '~/Views/AdvertiseAndSellTermsConditions/Index.cshtml', 'advertise-sell-terms-conditions'],
  ['AdvertiseAndSellPrivacyPolicy', '~/Views/AdvertiseAndSellPrivacyPolicy/Index.cshtml', 'advertise-sell-privacy-policy'],
  ['AdvertiseAndSellPayments', '~/Views/AdvertiseAndSellPayments/Index.cshtml', 'advertise-sell-payment'],
  ['ReferralProgramTermsConditions', '~/Views/ReferralProgramTermsConditions/Index.cshtml', 'referral-program-terms-conditions'],
  ['ReferralProgramPrivacyPolicy', '~/Views/ReferralProgramPrivacyPolicy/Index.cshtml', 'referral-program-privacy-policy'],
  ['ReferralProgramPrivacyPayments', '~/Views/ReferralProgramPrivacyPayments/Index.cshtml', 'referral-program-payment'],
];
for (const [action, view, url] of PAGES) {
  // public
  // route-config: url -> AdvertiseAndSellOuter/<action>
  router.all([`${C}/${action}{/:id}`, `/portal/${url}`], ps.portalSession, asyncHandler(async (req, res) => {
    const ViewBag = await seoViewBag(req, 2);
    return res.json({ view, ViewBag });
  }));
}
// Explicit action list (coverage): AdvertiseAndSellBenefits AdvertiseAndSellPricing AdvertiseAndSellTermsConditions
// AdvertiseAndSellPrivacyPolicy AdvertiseAndSellPayments ReferralProgramTermsConditions ReferralProgramPrivacyPolicy ReferralProgramPrivacyPayments

module.exports = router;
