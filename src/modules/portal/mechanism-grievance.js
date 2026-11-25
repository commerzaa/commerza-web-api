'use strict';
// Ported from ClusterofferShopingPortal/Controllers/MechanismGrievance.cs
// Actions: Index (1). The view is static; no server-side data.
// route-config "mechanism_grievance" is commented out in RouteConfig.cs => not registered.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();

// ---- Index -----------------------------------------------------------------------------------------------
// public
router.all(['/portal/MechanismGrievance/Index{/:id}', '/portal/MechanismGrievance'], asyncHandler(async (req, res) => {
  res.json({ View: '~/Views/MechanismGrievance/Index.cshtml' });
}));

module.exports = router;
