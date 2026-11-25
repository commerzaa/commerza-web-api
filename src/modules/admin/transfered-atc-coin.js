'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\TransferedAtcCoin.cs (class TransferedAtcCoinController => /admin/TransferedAtcCoin/...)
// Database: affiliate (Db_Affiliate) - not used (view only).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const C = 'TransferedAtcCoin';

// ---------------------------------------------------------------- ActionResult Index()
// public (legacy had no session check; view only, no server-side data)
// route-config: "AdminPanel/send-receive-atc-transaction-details" -> TransferedAtcCoin/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/send-receive-atc-transaction-details'],
  asyncHandler(async (req, res) => res.json({ view: '~/Views/AdminPanel/TransferedAtcCoin/Index.cshtml' })));

module.exports = router;
