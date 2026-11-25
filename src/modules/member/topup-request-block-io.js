'use strict';
// Ported from Member/Controllers/CustomerPanel/Topup_Request_BlockIO.cs  (view only, no server logic)
const express = require('express');
const router = express.Router();
const asyncHandler = require('../../middleware/asyncHandler');

// public (legacy had no session check). route-config: url "referral/xN7ZZCwoYQ5rxh4YU0RZ8Hh3rfgdgdfBIO4upfJtpcnNhZhGZ0LWE" -> Topup_Request_BlockIO/Index
router.all([
  '/member/Topup_Request_BlockIO/Index{/:id}',
  '/member/Topup_Request_BlockIO',
  '/member/referral/xN7ZZCwoYQ5rxh4YU0RZ8Hh3rfgdgdfBIO4upfJtpcnNhZhGZ0LWE',
], asyncHandler(async (req, res) => {
  res.json({ View: '~/Views/CustomerPanel/Topup_Request_BlockIO/Index.cshtml' });
}));

module.exports = router;
