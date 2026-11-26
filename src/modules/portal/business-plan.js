'use strict';
// Ported from ClusterofferShopingPortal\Controllers\business_plan.cs (class Business_planController => /portal/Business_plan/...)
// Static view. No filter attribute in legacy.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// public
// route-config: "business_plan" -> Business_plan/Index
router.all(['/portal/Business_plan/Index{/:id}', '/portal/business_plan'],
  asyncHandler(async (req, res) => res.json({ view: '~/Views/Business_plan/Index.cshtml' })));

module.exports = router;
