'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/EmailCampaignManagement.cs (EmailCampaignManagementController)
// Actions: Index (1)
const express = require('express');
const ps = require('./_shared/portal-session');

const router = express.Router();

// auth (legacy: Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: none active (the "EmailCampaignManagement" MapRoute is commented out in RouteConfig.cs)
router.all(['/portal/EmailCampaignManagement/Index{/:id}', '/portal/EmailCampaignManagement'], ps.customerAuth, (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/EmailCampaignManagement/Index.cshtml' });
});

module.exports = router;
