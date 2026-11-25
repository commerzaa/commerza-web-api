'use strict';
// Ported from C:/Users/MY ASUS/cluster/ClusterofferShopingPortal/ClusterofferShopingPortal/Controllers/CustomerPanel/PartiallyBrandedUrl.cs (class PartiallyBrandedUrlController => /portal/PartiallyBrandedUrl/...)
// Database: shopping (Db_Shopping). The only action returns a view without any server-side logic or session check.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { view } = require('./_shared/batch-06-common');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// public (no session check in legacy). RouteConfig entry "PartiallyBrandedUrl" is commented out => no friendly URL.
router.all(['/portal/PartiallyBrandedUrl/Index{/:id}', '/portal/PartiallyBrandedUrl'], asyncHandler(async (req, res) => {
  view(res, '~/Views/CustomerPanel/PartiallyBrandedUrl/Index.cshtml');
}));

module.exports = router;
