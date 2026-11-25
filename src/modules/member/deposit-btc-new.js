'use strict';
// Port of Member\Common\Controllers\CustomerPanel\DepositBTCNew.cs (DepositBTCNewController)
const express = require('express');
const axios = require('axios');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const config = require('../../config');
const BitCoinCoreDaemon = require('../../lib/member/BitCoinCoreDaemon');
const DB = 'affiliate';
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row.
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : null);
const tokStr = (v) => (v === undefined || v === null ? '' : String(v));

// route-config: referral/deposit-btc -> DepositBTCNew/Index
// auth (SessionExpireCheck)
router.all(['/member/DepositBTCNew/Index{/:id}', '/member/referral/deposit-btc'], auth, asyncHandler(async (req, res) => {
  // Auto approval of BTC node deposit (background thread)
  Promise.resolve().then(() => BitCoinCoreDaemon.PaymentAutoClearificationBTCNode(Number(req.user.plid))).catch(() => {});
  let coincode = req.p.coincode;
  if (coincode === undefined || coincode === null) coincode = 'BTC';
  res.json({ CoinCode: coincode });
}));

// auth
router.get('/member/DepositBTCNew/GenerateWalletAddress{/:id}', auth, asyncHandler(async (req, res) => {
  let OutPutResult = '';
  let GeneratedBtcAddress = '';
  try {
    const Plid = parseInt(req.user.plid, 10);
    try {
      const Response = await BitCoinCoreDaemon.GetNewAddress();
      const ObjWalletManagement = JSON.parse(Response);
      if (tokStr(ObjWalletManagement.Flag) !== 'success') GeneratedBtcAddress = 'wallet under maintenance';
      else GeneratedBtcAddress = tokStr(ObjWalletManagement.Message);
    } catch (e) {
      GeneratedBtcAddress = 'wallet under maintenance';
    }
    const TempCoinName = 'bitcoin';
    const UrlForHitforrate = 'https://api.coinmarketcap.com/v1/ticker/' + TempCoinName + '/?convert=' + (config.app.Currency || '');
    const r = await axios.get(UrlForHitforrate, { responseType: 'text', transformResponse: (x) => x });
    const ObjRateManagement = JSON.parse(r.data);
    const price = tokStr(ObjRateManagement[0].price_usd);
    if (price === '' || price === 'null') {
      return res.json('Wallet under maintenance');
    }
    const BTCPriceInUSD = price;
    const rows = await db.proc(DB, 'usp_generatewalletaddress', {
      regno: Plid, typeid: '1', id: '2', wallet_address: GeneratedBtcAddress, coincode: 'BTC', txn_id: '',
      confirms_needed: '0', status_url: '', qrcode_url: '', coinrateinusd: BTCPriceInUSD,
    });
    const IntOutPutFlag = tokStr(outv(rows, 'flag'));
    const IntOutPutResult = tokStr(outv(rows, 'wallet_address'));
    OutPutResult = IntOutPutFlag + '^' + IntOutPutResult;
    return res.json(OutPutResult);
  } catch (ex) {
    return res.json(ex.message);
  }
}));

// auth
router.get('/member/DepositBTCNew/IpnConfirmation{/:id}', auth, asyncHandler(async (req, res) => {
  const WalletAddress = req.p.WalletAddress;
  let ReceivedFund = '';
  try {
    const APIResponseBalance = await BitCoinCoreDaemon.GetReceivedByAddress(WalletAddress, '0');
    const ObjWalletManagement = JSON.parse(APIResponseBalance);
    if (tokStr(ObjWalletManagement.Flag).toLowerCase() !== 'success') {
      ReceivedFund = '0.00000000';
      return res.json('false' + '^' + ReceivedFund);
    }
    ReceivedFund = tokStr(ObjWalletManagement.Message);
    const n = Number(ReceivedFund);
    if (ReceivedFund.trim() === '' || Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
    if (n > 0) return res.json('true' + '^' + ReceivedFund);
    return res.json('false' + '^' + ReceivedFund);
  } catch (ExpObj) {
    ReceivedFund = '0.00000000';
    return res.json(ExpObj.message + '^' + ReceivedFund);
  }
}));

module.exports = router;
