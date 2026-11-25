'use strict';
// Ported from Member/Controllers/Websit_CoinRate.cs  (view only, no server logic)
const express = require('express');
const router = express.Router();
const asyncHandler = require('../../middleware/asyncHandler');

// public (outer website page). route-config: url "coin-rate" -> Websit_CoinRate/Index 
router.all([
  '/member/Websit_CoinRate/Index{/:id}',
  '/member/Websit_CoinRate',
  '/member/coin-rate',
], asyncHandler(async (req, res) => {
  res.json({ View: '~/Views/Websit_CoinRate/Index.cshtml' });
}));

module.exports = router;
