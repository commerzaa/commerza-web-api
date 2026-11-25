'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\PostAnAd.cs (class PostAnAdController => /portal/PostAnAd/...)
// Database: shopping (Db_Shopping). The friendly URL "user/postanad" is commented out in RouteConfig.cs.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');

const router = express.Router();
const C = '/portal/PostAnAd';

// ---------------------------------------------------------------- Index()
// public (no session check in legacy)
router.all([`${C}/Index{/:id}`, C], ps.portalSession, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/PostAnAd/Index.cshtml' });
}));

module.exports = router;
