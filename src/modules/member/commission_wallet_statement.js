'use strict';
// Ported from Member\Controllers\CustomerPanel\commission_wallet_statement.cs (commission_wallet_statementController) - no data access
const express = require('express');
const { auth, requireType } = require('../../middleware/auth');

const router = express.Router();
const guard = [auth, requireType('member')];

// route-config: referral/commission-wallet-statement
// auth
router.all(['/member/commission_wallet_statement/Index{/:id}', '/member/referral/commission-wallet-statement'], ...guard, (req, res) => {
  res.json({});
});

module.exports = router;
