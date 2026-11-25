'use strict';
// Ported from ClusterofferShopingPortal/Controllers/MarketingToolsController.cs (class marketingtoolsController)
// Actions: Index (1)   DB: Db_Shopping => 'shopping' (via WebsiteDetail.GetWebsiteInfo)
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');

const WebsiteDetail = require('../../lib/portal/WebsiteDetail');
const c10 = require('./_shared/batch-10-common');

const router = express.Router();

// ---- Index -----------------------------------------------------------------------------------------------
// public
router.all(['/portal/marketingtools/Index{/:id}', '/portal/marketingtools',
  '/portal/marketing-tools', '/portal/marketing-tools/Index', // route-config: "marketing-tools/{action}" (only Index exists)
], asyncHandler(async (req, res) => {
  // "Domain Management" block: only reads Request.Url (redirect logic commented out in legacy).
  const PageUrl = c10.fullUrl(req);
  const ViewBag = { Canonical: PageUrl, Title: '', MetaDesc: '', MetaKeyword: '' };
  const ObjWebsiteDescription = await WebsiteDetail.GetWebsiteInfo(4);
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
