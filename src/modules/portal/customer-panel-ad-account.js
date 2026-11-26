'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\AdAccount.cs (class AdAccountController => /portal/AdAccount/...)
// No database access. (RouteConfig entry for AdAccount is commented out.)
const express = require('express');
const ps = require('./_shared/portal-session');
const { view } = require('./_shared/batch-02-common');

const router = express.Router();
const C = '/portal/AdAccount';

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
router.all([`${C}/Index{/:id}`, C], ps.customerAuth, (req, res) => view(res, '~/Views/CustomerPanel/AdAccount/Index.cshtml'));

module.exports = router;
