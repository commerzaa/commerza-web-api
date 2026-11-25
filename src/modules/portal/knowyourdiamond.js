'use strict';
// Ported from ClusterofferShopingPortal/Controllers/Knowyourdiamond.cs (the file declares class paymentinforamtionController)
// Actions: Index (1). The view ~/Views/paymentinforamtion/Index.cshtml is static; no server-side data.
// route-config "payment-inforamtion" is commented out in RouteConfig.cs => not registered.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();

// ---- Index -----------------------------------------------------------------------------------------------
// public
router.all(['/portal/paymentinforamtion/Index{/:id}', '/portal/paymentinforamtion'], asyncHandler(async (req, res) => {
  res.json({ View: '~/Views/paymentinforamtion/Index.cshtml' });
}));

module.exports = router;
