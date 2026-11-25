'use strict';
// Ported from ClusterofferShopingPortal\Controllers\WhatsappMarketing.cs (class whatsappmarketingController => /portal/whatsappmarketing/...)
// Database: shopping (Db_Shopping) via WebsiteDetail.GetWebsiteInfo(21).
const express = require('express');
const { outerPageIndex } = require('./_shared/batch-15-common');

const router = express.Router();
const handler = outerPageIndex(21, '~/Views/whatsappmarketing/Index.cshtml');

// Index(): ViewBag SEO data of WID 21 + view ~/Views/whatsappmarketing/Index.cshtml (no session check in legacy)
// public
router.all(['/portal/whatsappmarketing/Index{/:id}', '/portal/whatsappmarketing'], handler);
// public  route-config: whats-app-marketing -> whatsappmarketing/Index
router.all('/portal/whats-app-marketing', handler);

module.exports = router;
