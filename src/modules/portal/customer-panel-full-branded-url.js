'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/FullBrandedUrl.cs (FullBrandedUrlController)
// Actions: Index (1)
const express = require('express');

const router = express.Router();

// public (legacy had no session check; view only, no server-side data)
// route-config: none active (the "FullBrandedUrl" MapRoute is commented out in RouteConfig.cs)
router.all(['/portal/FullBrandedUrl/Index{/:id}', '/portal/FullBrandedUrl'], (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/FullBrandedUrl/Index.cshtml' });
});

module.exports = router;
