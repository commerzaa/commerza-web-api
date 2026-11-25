'use strict';
// Ported from Member/Controllers/CustomerPanel/Month_Wise_Income.cs  (view only, no server logic)
const express = require('express');
const router = express.Router();
const asyncHandler = require('../../middleware/asyncHandler');

// public (legacy had no session check). route-config: url "referral/_plus_8_slash_U7JrlVkU4YQJzYr9PzcpP8n236HeVrtoU2EbrKos=" -> Month_Wise_Income/Index
router.all([
  '/member/Month_Wise_Income/Index{/:id}',
  '/member/Month_Wise_Income',
  '/member/referral/_plus_8_slash_U7JrlVkU4YQJzYr9PzcpP8n236HeVrtoU2EbrKos=',
], asyncHandler(async (req, res) => {
  res.json({ View: '~/Views/CustomerPanel/Month_Wise_Inacome/Index.cshtml' });
}));

module.exports = router;
