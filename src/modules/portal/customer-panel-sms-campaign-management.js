'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/SmsCampaignManagement.cs (SmsCampaignManagementController)
const express = require('express');
const ps = require('./_shared/portal-session');

const router = express.Router();
const DB = 'shopping'; // eslint-disable-line no-unused-vars

// auth (Session["Plid"] == null -> RedirectToAction("Index","Home")). RouteConfig "user/smscampaignmanagement" is commented out.
router.all(['/portal/SmsCampaignManagement/Index{/:id}', '/portal/SmsCampaignManagement'], ps.customerAuth, (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/SmsCampaignManagement/Index.cshtml' });
});

module.exports = router;
