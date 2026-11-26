'use strict';
// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\DiamondCertification.cs (class DiamondCertificationController => /portal/DiamondCertification/...)
// Database: shopping (Db_Shopping). The only action returns a static view; no server-side logic. (RouteConfig diamond_certification is commented out.)
const express = require('express');
const ps = require('./_shared/portal-session');

const router = express.Router();

// ---------------------------------------------------------------- Index()

// public
router.all(['/portal/DiamondCertification/Index{/:id}', '/portal/DiamondCertification'], ps.portalSession, (req, res) => res.json({ view: '~/Views/DiamondCertification/Index.cshtml' }));

module.exports = router;
