'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/ChatHistory.cs (ChatHistoryController, 1 action). No database access.
const express = require('express');
const ps = require('./_shared/portal-session');

const router = express.Router();
const C = 'ChatHistory';

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: the friendly URL for this controller is commented out in RouteConfig.cs
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`], ps.customerAuth, (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/ChatHistory/Index.cshtml' });
});

module.exports = router;
