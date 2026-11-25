'use strict';
/** Port of Merchant Panel Controllers/CustomerPanel/Payment_overview.cs (Payment_overviewController, 1 action). */
const express = require('express');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const router = express.Router();

// route-config: merchant/JitDVZY_plus_Ju1YaAP4_slash_Un6_slash_5zYWYRmdC1h -> Index
// auth ([SessionExpireCheck]); the action only returns the view
router.all(['/merchant/Payment_overview/Index{/:id}', '/merchant/JitDVZY_plus_Ju1YaAP4_slash_Un6_slash_5zYWYRmdC1h'], auth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/Payment_overview/Index.cshtml' });
}));

module.exports = router;
