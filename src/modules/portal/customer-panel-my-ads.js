'use strict';
// Ported from C:/Users/MY ASUS/cluster/ClusterofferShopingPortal/ClusterofferShopingPortal/Controllers/CustomerPanel/MyAds.cs (class MyAdsController => /portal/MyAds/...)
// Database: shopping (Db_Shopping). The only action returns a view without any server-side logic or session check.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { view } = require('./_shared/batch-06-common');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// public (no session check in legacy). RouteConfig entry "MyAds" is commented out => no friendly URL.
router.all(['/portal/MyAds/Index{/:id}', '/portal/MyAds'], asyncHandler(async (req, res) => {
  view(res, '~/Views/CustomerPanel/MyAds/Index.cshtml');
}));

module.exports = router;
