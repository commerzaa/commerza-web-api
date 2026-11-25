'use strict';
// Ported from ClusterofferShopingPortal\Controllers\WebSiteBuilderController.cs (class WebSiteBuilderController => /portal/WebSiteBuilder/...)
// Database: shopping (Db_Shopping) via WebsiteDetail.GetWebsiteInfo(25).
const express = require('express');
const { outerPageIndex } = require('./_shared/batch-15-common');

const router = express.Router();

// Index(): ViewBag SEO data of WID 25 + view ~/Views/WebSiteBuilder/Index.cshtml (no session check in legacy)
// public
router.all(['/portal/WebSiteBuilder/Index{/:id}', '/portal/WebSiteBuilder'], outerPageIndex(25, '~/Views/WebSiteBuilder/Index.cshtml'));
// public  route-config: website-builder -> WebSiteBuilder/Index
router.all('/portal/website-builder', outerPageIndex(25, '~/Views/WebSiteBuilder/Index.cshtml'));

module.exports = router;
