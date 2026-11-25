'use strict';
// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\Franchise_ModelController.cs (class Franchise_ModelController => /portal/Franchise_Model/...)
// Database: shopping (Db_Shopping). The only action returns a static view; no server-side logic. [CheckResellerTimeout]/[DistributerSessionExpireCheck] = no check.
const express = require('express');
const ps = require('./_shared/portal-session');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// route-config: "franchisemodel" -> Franchise_Model/Index
// public
router.all(['/portal/Franchise_Model/Index{/:id}', '/portal/Franchise_Model', '/portal/franchisemodel'], ps.portalSession, (req, res) => res.json({ view: '~/Views/Franchise_Model/Index.cshtml' }));

module.exports = router;
