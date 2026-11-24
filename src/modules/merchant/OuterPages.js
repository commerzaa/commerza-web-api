'use strict';
// Port of Merchant Panel Controllers/OuterPages.cs (OuterPagesController) - 14 actions
// DB access is inside libs (WebsiteDetail, DAL_RegistrationOrLogin). All actions are public outer pages (no session check).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const WebsiteDetail = require('../../lib/merchant/WebsiteDetail');
const DAL_RegistrationOrLogin = require('../../lib/merchant/DAL_RegistrationOrLogin');

const router = express.Router();
const BASE = '/merchant/OuterPages';

// ViewBag.Canonical/Title/MetaDesc/MetaKeyword block shared by every page action (WebsiteDetail.GetWebsiteInfo(22))
async function seoViewBag(req) {
  const ViewBag = {
    Canonical: req.protocol + '://' + req.get('host') + req.originalUrl,
    Title: '', MetaDesc: '', MetaKeyword: '',
  };
  const ObjWebsiteDescription = await WebsiteDetail.GetWebsiteInfo(22);
  if (ObjWebsiteDescription !== null && ObjWebsiteDescription !== undefined) {
    ViewBag.Title = ObjWebsiteDescription.SeoTitle;
    ViewBag.MetaDesc = ObjWebsiteDescription.SeoDescription;
    ViewBag.MetaKeyword = ObjWebsiteDescription.SeoKeyword;
  }
  return ViewBag;
}
const masterPageShow = (req) => {
  const v = sessionStore.get(req, 'LoginwithMobile');
  return v !== undefined && v !== null ? 'MobileLogin' : '';
};

// [action, view, extra route-config urls, sets ViewBag.masterpageshow]
const pages = [
  ['Career', '~/Views/Career/Index.cshtml', [], false],
  ['AdvertiseSell', '~/Views/AdvertiseSell/Index.cshtml', ['advertise-sell'], false],
  ['Disclaimer', '~/Views/Disclaimer/Index.cshtml', [], false],
  ['ReturnPolicy', '~/Views/ReturnPolicy/Index.cshtml', [], false],
  ['ReportInfringement', '~/Views/ReportInfringement/Index.cshtml', [], false],
  ['TermAndConditionRefferal', '~/Views/TermAndConditionRefferal/Index.cshtml', [], false],
  ['TermAndConditionAdvertiseSell', '~/Views/TermAndConditionAdvertiseSell/Index.cshtml', [], false],
  ['PrivacyPolicyReferral', '~/Views/PrivacyPolicyReferral/Index.cshtml', [], false],
  ['PrivacyPolicyAdvertiseSell', '~/Views/PrivacyPolicyAdvertiseSell/Index.cshtml', [], false],
  ['PaymentRefferal', '~/Views/PaymentRefferal/Index.cshtml', [], false],
  ['PaymentRefferalSell', '~/Views/PaymentRefferalSell/Index.cshtml', [], false],
  ['Benefites', '~/Views/benefites/Index.cshtml', ['advertise-benefits'], true],
  ['TermAndConditions', '~/Views/TermAndConditions/Index.cshtml', ['terms-and-conditions'], true],
];
for (const [name, view, friendly, mps] of pages) {
  // route-config urls (advertise-sell, advertise-benefits, terms-and-conditions) where present
  // public
  router.all([`${BASE}/${name}{/:id}`, ...friendly.map((u) => `/merchant/${u}`)], asyncHandler(async (req, res) => {
    const ViewBag = {};
    if (mps) ViewBag.masterpageshow = masterPageShow(req);
    Object.assign(ViewBag, await seoViewBag(req));
    res.json({ view, ViewBag });
  }));
}

// ---- FAQ -----------------------------------------------------------------------------------------------
// route-config: faq
// public
router.all([`${BASE}/FAQ{/:id}`, '/merchant/faq'], asyncHandler(async (req, res) => {
  const ViewBag = {};
  ViewBag.masterpageshow = masterPageShow(req);
  const objFAQ_Category = await DAL_RegistrationOrLogin.GET_FAQCATEGORY();
  ViewBag.FAQCategory = objFAQ_Category;
  res.json({ view: '~/Views/FAQ/Index.cshtml', ViewBag });
}));

module.exports = router;
