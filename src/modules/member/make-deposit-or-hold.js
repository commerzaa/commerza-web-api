'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/MakeDepositOrHoldController.cs (MakeDepositOrHoldController)
 * Prefix: /member   DB: affiliate (DataBaseContext => Db_Affiliate)
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';

const PROPS = ['TILMID', 'CoinLogoBase64Code', 'CoinName', 'CoinCode', 'PHASENAME', 'PriceInUSD', 'PriceInBTC', 'CurrentWallet', 'DepositedCoin',
  'COINSUPPLY', 'COINSOLDOUT', 'COINAVAILABLEFORSELL', 'BTCWALLETPERCENTAGE', 'OTHERWALLETPERCENTAGE'];
const outOf = (rows, name) => {
  const f = rows && rows[0];
  if (!f) return '';
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined || f[k] === null || f[k] === undefined ? '' : String(f[k]);
};

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: referral/new-deposit  (MakeDepositOrHold / Index)
// auth
router.all(['/member/MakeDepositOrHold/Index{/:id}', '/member/referral/new-deposit'], auth, asyncHandler(async (req, res) => {
  let ObjMakeDepositOrHold = [];
  const ViewBag = {};
  try {
    const Plid = Number(req.user.plid);
    // PORT-NOTE: @UNITWALLET / @BTCWallet OUT params are read from the first result row (columns unitwallet, btcwallet).
    const rows = await proc(DB, 'usp_depositorholdico', { mode: '3', plid: Plid });
    ObjMakeDepositOrHold = mapRows(rows, PROPS);
    ViewBag.UNITWALLET = outOf(rows, 'UNITWALLET');
    ViewBag.BTCWallet = outOf(rows, 'BTCWallet');
  } catch (e) {
    console.error(e);
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found")
  }
  return res.json({ view: '~/Views/CustomerPanel/MakeDepositOrHold/Index.cshtml', Model: ObjMakeDepositOrHold, ViewBag });
}));

module.exports = router;
