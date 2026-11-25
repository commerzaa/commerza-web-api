'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/CustomizeUrl.cs (CustomizeUrlController)
// Actions: Index (1)
const express = require('express');
const ps = require('./_shared/portal-session');

const router = express.Router();

// auth (legacy: Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: none active (the "CustomizeUrl" MapRoute is commented out in RouteConfig.cs)
router.all(['/portal/CustomizeUrl/Index{/:id}', '/portal/CustomizeUrl'], ps.customerAuth, (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/CustomizeUrl/Index.cshtml' });
});

module.exports = router;
