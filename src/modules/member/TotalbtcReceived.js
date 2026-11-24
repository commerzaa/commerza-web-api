'use strict';
/** Port of Member/Controllers/CustomerPanel/TotalbtcReceived.cs (TotalbtcReceivedController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { scalar } = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';

// route-config: total-btc-Received -> Index
// public (legacy had no session check)
router.all(['/member/TotalbtcReceived/Index{/:id}', '/member/total-btc-Received'], asyncHandler(async (req, res) => {
  const v = await scalar(DB, 'SELECT 20+COALESCE(SUM(bitcoinamount),0) FROM tbl_fund_history WHERE paymentmode = 11 AND isverifiedbyadmin = 1 AND status = 1 AND active = 1');
  const a = v === null || v === undefined ? 0 : Number(v);
  const ViewBag = { TotalBtcRecived: a };
  res.json({ view: '~/Views/CustomerPanel/TotalbtcReceived/Index.cshtml', ViewBag });
}));

module.exports = router;
