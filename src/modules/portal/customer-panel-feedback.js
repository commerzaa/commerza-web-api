'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Feedback.cs (FeedbackController)
// Actions: Index (1)
const express = require('express');
const ps = require('./_shared/portal-session');

const router = express.Router();

// auth (legacy: Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: none active (the "Feedback" MapRoute is commented out in RouteConfig.cs)
router.all(['/portal/Feedback/Index{/:id}', '/portal/Feedback'], ps.customerAuth, (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/Feedback/Index.cshtml' });
});

module.exports = router;
