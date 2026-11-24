'use strict';
// Ported from Franchise/Controllers/OuterPages.cs  (DB: shopping - Franchise DataBaseContext = Db_Shopping)
// All actions are public outer pages (no session check).
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const WebsiteDetail = require('../../lib/franchise/WebsiteDetail');
const DAL_RegistrationOrLogin = require('../../lib/franchise/DAL_RegistrationOrLogin');

const BASE = '/franchise/OuterPages';
const PKG = ['TRPID', 'SERVICENAME', 'PACKAGENAME', 'PACKAGEAMOUNT', 'PACKAGEFEATURES', 'ACTIVE', 'BUYSTATUS', 'ISTRIAL'];

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

// simple page actions (view only)
const pages = ['Career', 'AdvertiseSell', 'Disclaimer', 'ReturnPolicy', 'ReportInfringement', 'TermAndConditionRefferal',
  'TermAndConditionAdvertiseSell', 'PrivacyPolicyReferral', 'Howit_work', 'PrivacyPolicyAdvertiseSell', 'PaymentRefferal',
  'PaymentRefferalSell', 'Benefites'];
for (const name of pages) {
  // public
  router.all(`${BASE}/${name}{/:id}`, asyncHandler(async (req, res) => {
    res.json({ ViewBag: await seoViewBag(req) });
  }));
}

// public
router.all(`${BASE}/PricingPackages{/:id}`, asyncHandler(async (req, res) => {
  const ViewBag = await seoViewBag(req);
  const resellerPackages = mapRows(await proc('shopping', 'get_resellerallpackages', { trsid: 1 }), PKG);
  const resellerPackages1 = mapRows(await proc('shopping', 'get_resellerallpackages', { trsid: 2 }), PKG);
  ViewBag.resellerPackages1 = resellerPackages1;
  res.json({ Model: resellerPackages, ViewBag });
}));

// public
const faq = asyncHandler(async (req, res) => {
  const objFAQ_Category = await DAL_RegistrationOrLogin.GET_FAQCATEGORY();
  res.json({ ViewBag: { FAQCategory: objFAQ_Category } });
});
router.all(`${BASE}/FAQ{/:id}`, faq);
// route-config: franchisee/faq
router.all('/franchise/franchisee/faq', faq);

module.exports = router;
