'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\PayItForwardList.cs (class PayItForwardListController => /portal/PayItForwardList/...)
// Database: shopping (Db_Shopping). PaidIfForwarsListList is a model class only (no routes).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');

const router = express.Router();
const C = '/portal/PayItForwardList';

// ---------------------------------------------------------------- Index()
// public (no session check in legacy)
// route-config: "referral/payitforwardlist" -> PayItForwardList/Index
router.all([`${C}/Index{/:id}`, C, '/portal/referral/payitforwardlist'], ps.portalSession, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/PayItForwardList/Index.cshtml' });
}));

module.exports = router;
