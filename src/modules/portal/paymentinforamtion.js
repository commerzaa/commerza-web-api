'use strict';
// Ported from ClusterofferShopingPortal\Controllers\paymentinforamtion.cs (file contains class KnowyourdiamondController, 1 action)
// Database: shopping (Db_Shopping) - not used (static view).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();

// ---------------------------------------------------------------- Index() => View("~/Views/Knowyourdiamond/Index.cshtml")
// public (static page). RouteConfig "Know-your-diamond" entry is commented out in legacy -> not registered.
router.all(['/portal/Knowyourdiamond', '/portal/Knowyourdiamond/Index{/:id}'],
  asyncHandler(async (req, res) => res.json({ view: '~/Views/Knowyourdiamond/Index.cshtml' })));

module.exports = router;
