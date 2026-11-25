'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/DealsOffers.cs (DealsOffersController)
// Actions: Index (1)
const express = require('express');
const ps = require('./_shared/portal-session');

const router = express.Router();

// auth (legacy: Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: none active (the "DealsOffers" MapRoute is commented out in RouteConfig.cs)
router.all(['/portal/DealsOffers/Index{/:id}', '/portal/DealsOffers'], ps.customerAuth, (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/DealsOffers/Index.cshtml' });
});

module.exports = router;
