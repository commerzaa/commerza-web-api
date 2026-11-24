'use strict';
/** Port of Member/Controllers/CustomerPanel/Coin_Withdrawal.cs (Coin_WithdrawalController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { proc, queryOne } = require('../../db');
const { mapRow } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';

const outCol = (rows, name) => { const f = Array.isArray(rows) ? rows[0] : rows; if (!f) return ''; const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined || f[k] === null ? '' : String(f[k]); };
const reqNum = (name, v) => {
  const n = Number(v);
  if (v === undefined || v === null || String(v).trim() === '' || Number.isNaN(n)) {
    const e = new Error(`The parameters dictionary contains a null or invalid entry for parameter '${name}'.`);
    e.status = 400;
    throw e;
  }
  return n;
};

// route-config: referral/YJqJLL7sPXKFtrHEt9w4TA== -> Index
// auth
router.all(['/member/Coin_Withdrawal/Index{/:id}', '/member/referral/YJqJLL7sPXKFtrHEt9w4TA=='], auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  // PORT-NOTE: @AVAILABLECOMMISSIONWALLET / @AVAILABLECOINWALLET OUT params are returned as columns of the result row.
  const rows = await proc(DB, 'usp_getcoinforwithdrwal', { regno: Plid });
  const ViewBag = {
    AvailableCoinWallet: outCol(rows, 'availablecoinwallet'),
    AvailableCommisionWallet: outCol(rows, 'availablecommissionwallet'),
  };
  res.json({ view: '~/Views/CustomerPanel/Coin_Withdrawal/Index.cshtml', ViewBag });
}));

// auth
router.all('/member/Coin_Withdrawal/WithdrawalCoin{/:id}', auth, asyncHandler(async (req, res) => {
  const Amount = reqNum('Amount', req.p.Amount);
  const Paymode = Math.trunc(reqNum('Paymode', req.p.Paymode));
  const WalletAddres = req.p.WalletAddres;
  const Plid = Number(req.user.plid);
  const rows = await proc(DB, 'usp_coinwithdrawal', { regno: Plid, amount: Amount, paymode: Paymode, walletaddres: WalletAddres });
  res.json(outCol(rows, 'strresult'));
}));

// auth
router.all('/member/Coin_Withdrawal/GetDeductions{/:id}', auth, asyncHandler(async (req, res) => {
  const WithdrawalAmount = reqNum('WithdrawalAmount', req.p.WithdrawalAmount);
  const Plid = Number(req.user.plid);
  const row = await queryOne(DB, 'select * from fun_getfinalwithdrawalamount(@plid,@amount,2)', { plid: Plid, amount: WithdrawalAmount });
  res.json(row ? mapRow(row, ['FINALAMOUNT', 'TDS', 'ADMINCH', 'PROCESSINGFEE']) : null);
}));

module.exports = router;
