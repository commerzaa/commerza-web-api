'use strict';
// Ported from ClusterofferShopingPortal\Controllers\PoliciesController.cs (class PoliciesController, 9 actions, all `return View()`)
// Database: shopping (Db_Shopping) - not used (static views).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();

const ACTIONS = ['PricingPolicy', 'CancelationReturns', 'RefundPolicy', 'TermOfUse', 'SecurityPolicy', 'PrivacyPolicy',
  'TermsAndCondtions', 'ShippingPolicy', 'ExchangePolicy'];

for (const action of ACTIONS) {
  // public (static policy page)
  router.all(`/portal/Policies/${action}{/:id}`,
    asyncHandler(async (req, res) => res.json({ view: `~/Views/Policies/${action}.cshtml` })));
}

module.exports = router;
