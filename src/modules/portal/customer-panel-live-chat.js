'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/LiveChat.cs (LiveChatController)
// Actions: Index (1)
const express = require('express');

const router = express.Router();

// public (legacy had no session check; view only, no server-side data)
// route-config: none active (the "LiveChat" MapRoute is commented out in RouteConfig.cs)
router.all(['/portal/LiveChat/Index{/:id}', '/portal/LiveChat'], (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/LiveChat/Index.cshtml' });
});

module.exports = router;
