'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\All_News_Show.cs (class All_News_ShowController => /portal/All_News_Show/...)
// No database access. (RouteConfig entry for All_News_Show is commented out.)
const express = require('express');
const ps = require('./_shared/portal-session');
const { view } = require('./_shared/batch-02-common');

const router = express.Router();
const C = '/portal/All_News_Show';

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
router.all([`${C}/Index{/:id}`, C], ps.customerAuth, (req, res) => view(res, '~/Views/CustomerPanel/All_News_Show/Index.cshtml'));

module.exports = router;
