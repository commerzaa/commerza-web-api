'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/APIIntegration.cs (APIIntegrationController, 1 action). No database access.
const express = require('express');
const ps = require('./_shared/portal-session');

const router = express.Router();
const C = 'APIIntegration';

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: the friendly URL for this controller is commented out in RouteConfig.cs
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`], ps.customerAuth, (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/APIIntegration/Index.cshtml' });
});

module.exports = router;
