'use strict';
// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\Distribution_Chart.cs (class Distribution_ChartController => /portal/Distribution_Chart/...)
// Database: shopping (Db_Shopping). The only action returns a static view; no server-side logic. [CheckResellerTimeout] = no check.
const express = require('express');
const ps = require('./_shared/portal-session');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// route-config: "Bonaza" -> Distribution_Chart/Index
// public
router.all(['/portal/Distribution_Chart/Index{/:id}', '/portal/Distribution_Chart', '/portal/Bonaza'], ps.portalSession, (req, res) => res.json({ view: '~/Views/Distribution_Chart/Index.cshtml' }));

module.exports = router;
