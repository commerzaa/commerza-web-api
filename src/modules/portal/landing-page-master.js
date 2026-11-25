'use strict';
// Ported from ClusterofferShopingPortal/Controllers/LandingPageMaster.cs (class LandingPageMasterController) [CheckResellerTimeout] (body commented out in legacy => no check)
// Actions: Index (1)   DB: Db_Shopping => 'shopping' (via WebsiteDetail.GetWebsiteInfo)
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const WebsiteDetail = require('../../lib/portal/WebsiteDetail');
const c10 = require('./_shared/batch-10-common');

const router = express.Router();

// ---- Index -----------------------------------------------------------------------------------------------
// public
router.all(['/portal/LandingPageMaster/Index{/:id}', '/portal/LandingPageMaster',
  '/portal/landing-page-master', // route-config: "landing-page-master"
], ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  // "Domain Management" block: only reads Request.Url (redirect logic commented out in legacy).
  const PageUrl = c10.fullUrl(req);
  const ViewBag = { Canonical: PageUrl, Title: '', MetaDesc: '', MetaKeyword: '' };
  const ObjWebsiteDescription = await WebsiteDetail.GetWebsiteInfo(0);
  if (ObjWebsiteDescription != null) {
    ViewBag.Title = ObjWebsiteDescription.SeoTitle;
    ViewBag.MetaDesc = ObjWebsiteDescription.SeoDescription;
    ViewBag.MetaKeyword = ObjWebsiteDescription.SeoKeyword;
  }
  res.json({
    ViewBag,
  });
}));

module.exports = router;
