'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/commission_wallet.cs (commission_walletController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate' (no DB access in this controller)
 */
const express = require('express');
const { auth } = require('../../middleware/auth');

const router = express.Router();

// auth (Session["Plid"] == null => RedirectToAction("Index","Home") is replaced by the auth middleware)
// route-config: "referral/commission-wallet"
router.all(['/member/commission_wallet/Index{/:id}', '/member/referral/commission-wallet'], auth, (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/commission_wallet/Index.cshtml' });
});

module.exports = router;
