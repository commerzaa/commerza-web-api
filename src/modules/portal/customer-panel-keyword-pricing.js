'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/KeywordPricing.cs (KeywordPricingController)
// Actions: Index (1)
const express = require('express');

const router = express.Router();

// public (legacy had no session check; view only, no server-side data)
// route-config: none active (the "KeywordPricing" MapRoute is commented out in RouteConfig.cs)
router.all(['/portal/KeywordPricing/Index{/:id}', '/portal/KeywordPricing'], (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/KeywordPricing/Index.cshtml' });
});

module.exports = router;
