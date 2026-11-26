'use strict';
// Ported from ClusterofferShopingPortal/Controllers/LeadGenerators.cs (class leadgeneratorsController) [CheckResellerTimeout] (body commented out in legacy => no check)
// Actions: Index (1)   DB: Db_Shopping => 'shopping' (via WebsiteDetail.GetWebsiteInfo)
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const WebsiteDetail = require('../../lib/portal/WebsiteDetail');
const c10 = require('./_shared/batch-10-common');

const router = express.Router();

// ---- Index -----------------------------------------------------------------------------------------------
// public
router.all(['/portal/leadgenerators/Index{/:id}', '/portal/leadgenerators',
  '/portal/lead-generator', // route-config: "lead-generator" (routes leadgenerators + leadgeneratorouter)
], ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  // "Domain Management" block: only reads Request.Url (redirect logic commented out in legacy).
  const PageUrl = c10.fullUrl(req);
  const ViewBag = { Canonical: PageUrl, Title: '', MetaDesc: '', MetaKeyword: '' };
  const ObjWebsiteDescription = await WebsiteDetail.GetWebsiteInfo(19);
  if (ObjWebsiteDescription != null) {
    ViewBag.Title = ObjWebsiteDescription.SeoTitle;
    ViewBag.MetaDesc = ObjWebsiteDescription.SeoDescription;
    ViewBag.MetaKeyword = ObjWebsiteDescription.SeoKeyword;
  }
  res.json({
    View: '~/Views/leadgenerator/Index.cshtml',
    ViewBag,
  });
}));

module.exports = router;
