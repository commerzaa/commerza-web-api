'use strict';
// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\flight.cs (class flightController => /portal/flight/...)
// Database: shopping (Db_Shopping). The only action returns a static view; no server-side logic. [CheckResellerTimeout] = no check.
const express = require('express');
const ps = require('./_shared/portal-session');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// route-config: "flight" -> flight/Index
// public
router.all(['/portal/flight/Index{/:id}', '/portal/flight'], ps.portalSession, (req, res) => res.json({ view: '~/Views/flight/Index.cshtml' }));

module.exports = router;
