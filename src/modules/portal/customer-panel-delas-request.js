'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/DelasRequest.cs (DelasRequestController)
// Actions: Index (1)
const express = require('express');
const ps = require('./_shared/portal-session');

const router = express.Router();

// auth (legacy: Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: none active (the "DealsRequest" MapRoute (user/dealsrequest) is commented out in RouteConfig.cs)
router.all(['/portal/DelasRequest/Index{/:id}', '/portal/DelasRequest'], ps.customerAuth, (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/DelasRequest/Index.cshtml' });
});

module.exports = router;
