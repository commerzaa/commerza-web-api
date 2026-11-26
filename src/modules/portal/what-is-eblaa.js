'use strict';
// Ported from ClusterofferShopingPortal\Controllers\WhatIsEblaaController.cs (class what_is_ATCShoppingController => /portal/what_is_ATCShopping/...)
// Database: shopping (Db_Shopping) via WebsiteDetail.GetWebsiteInfo(1).
// [CheckResellerTimeout] on the class: body commented out in legacy => no check (ps.CheckResellerTimeout = portalSession).
const express = require('express');
const ps = require('./_shared/portal-session');
const { outerPageIndex } = require('./_shared/batch-15-common');

const router = express.Router();
const handler = outerPageIndex(1, '~/Views/what_is_ATCShopping/Index.cshtml');

// Index(): ViewBag SEO data of WID 1 + default view
// public
router.all(['/portal/what_is_ATCShopping/Index{/:id}', '/portal/what_is_ATCShopping'], ps.CheckResellerTimeout, handler);
// public  route-config: what-is-ATCShopping/{action} (default action Index; the controller has no other action)
router.all(['/portal/what-is-ATCShopping', '/portal/what-is-ATCShopping/Index'], ps.CheckResellerTimeout, handler);

module.exports = router;
