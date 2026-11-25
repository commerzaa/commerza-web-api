'use strict';
// Ported from C:/Users/MY ASUS/cluster/ClusterofferShopingPortal/ClusterofferShopingPortal/Controllers/CustomerPanel/MyPayMode.cs (class MyPayModeController => /portal/MyPayMode/...)
// Database: shopping (Db_Shopping). The only action returns a view without any server-side logic or session check.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { view } = require('./_shared/batch-06-common');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// public (no session check in legacy). RouteConfig entry "MyPayMode" is commented out => no friendly URL.
router.all(['/portal/MyPayMode/Index{/:id}', '/portal/MyPayMode'], asyncHandler(async (req, res) => {
  view(res, '~/Views/CustomerPanel/MyPayMode/Index.cshtml');
}));

module.exports = router;
