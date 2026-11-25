'use strict';
// Ported from Member/Controllers/CustomerPanel/DepositBTC.cs  (DB: affiliate)
const express = require('express');
const axios = require('axios');
const router = express.Router();
const config = require('../../config');
const { procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const DB = 'affiliate';
const regexItem = /^[a-zA-Z0-9 ]*$/;
const BAD_WORDS = ['union', 'union all', 'insert', 'update', 'drop', 'delete', 'exec', 'select'];
const hasBadWord = (s) => { const l = s.toLowerCase(); return BAD_WORDS.some((w) => l.includes(w)); };
// legacy "Validation Here" block: returns true when the value is rejected
const invalid = (v) => v != null && (String(v).length > 100 || hasBadWord(String(v)) || !regexItem.test(String(v)));

// static CallBackAddress(string Currency, string Ipn_Url) - not an action
async function CallBackAddress(Currency, Ipn_Url) {
  const OBjGETDepositeAddress = {
    PublicKey: (config.app.PublicKey || ''),
    PrivateKey: (config.app.PrivateKey || ''),
    Currency,
    Ipn_Url,
  };
  let StrPostData = JSON.stringify(OBjGETDepositeAddress);
  try {
    const r = await axios.post('http://coinpayment.awapal.com/api/CallBackAddress', StrPostData, {
      headers: { 'Content-Type': 'application/json' }, responseType: 'text', transformResponse: (d) => d,
    });
    StrPostData = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
  } catch (e) { /* legacy: empty catch, the posted JSON is returned */ }
  return StrPostData;
}

// static GenerateWalletAddress(int PLID, int PurchaseType, int ID, string CoinCode, string CoinName, string coinrateinusd) - not an action
async function GenerateWalletAddressInternal(PLID, PurchaseType, ID, CoinCode, CoinName, coinrateinusd) {
  let GeneratedBtcAddress = '';
  try {
    if (PurchaseType === 2) {
      if (['BTC', 'LTC', 'ETH', 'XRP', 'BCH', 'DOGE', 'XMR', 'EOS', 'ADA', 'XLM', 'TRX', 'MIOTA', 'NEO', 'DASH', 'XEM', 'XTZ', 'VET', 'BCN', 'LSK', 'ICX', 'ZIL', 'AE', 'ZEC', 'ZRX', 'DCR', 'OMG', 'QTUM', 'BTG', 'BTM'].includes(CoinCode)) {
        const Response = await CallBackAddress(CoinCode, (config.app.CompanyDomain || '') + '/api/auto-deposit-ipn');
        const ObjWalletManagement = JSON.parse(Response);
        if (ObjWalletManagement.Flag.toString() !== 'success') {
          GeneratedBtcAddress = 'wallet under maintenance';
        } else {
          const ObjWalletManagementNew = JSON.parse(ObjWalletManagement.Message.toString());
          const ObjWalletManagementResult = JSON.parse(ObjWalletManagementNew.result.toString());
          GeneratedBtcAddress = ObjWalletManagementResult.address.toString();
        }
      }
    }
    // WALLET_ADDRESS is an INPUT/OUTPUT parameter (initial value GeneratedBtcAddress), FLAG is OUTPUT
    const out = await procOne(DB, 'usp_generatewalletaddress', {
      regno: PLID, typeid: PurchaseType, id: ID, wallet_address: GeneratedBtcAddress, coincode: CoinCode,
      txn_id: '', confirms_needed: '0', status_url: '', qrcode_url: '', coinrateinusd,
    });
    const IntOutPutFlag = out && out.flag != null ? String(out.flag) : '';
    const IntOutPutResult = out && out.wallet_address != null ? String(out.wallet_address) : '';
    return IntOutPutFlag + '^' + IntOutPutResult;
  } catch (Exp) {
    return Exp.message;
  }
}

// auth ([SessionExpireCheck]). route-config: url "referral/deposit-crypto-coin-in-wallet"
router.all(['/member/DepositBTC/Index{/:id}', '/member/DepositBTC', '/member/referral/deposit-crypto-coin-in-wallet'], auth, asyncHandler(async (req, res) => {
  let coincode = req.p.coincode;
  if (coincode == null) coincode = 'BTC';
  res.json({ View: '~/Views/CustomerPanel/DepositBTC/Index.cshtml', ViewBag: { CoinCode: coincode } });
}));

// auth (HttpGet)
router.get('/member/DepositBTC/GenerateWalletAddress{/:id}', auth, asyncHandler(async (req, res) => {
  const PurchaseType = parseInt(req.p.PurchaseType, 10);
  const ID = parseInt(req.p.ID, 10);
  const { CoinCode, CoinName } = req.p;
  if (invalid(CoinName)) return res.json('Invalid Attempts.');
  if (invalid(CoinCode)) return res.json('Invalid Attempts.');
  try {
    const Plid = Math.trunc(Number(req.user.plid));
    let TempCoinName = '';
    if (CoinCode === 'BTC') TempCoinName = 'bitcoin';
    else if (CoinCode === 'LTC') TempCoinName = 'litecoin';
    else if (CoinCode === 'ETH') TempCoinName = 'ethereum';
    const UrlForHitforrate = 'https://api.coinmarketcap.com/v1/ticker/' + TempCoinName + '/?convert=' + (config.app.Currency || '');
    const Resultforrate = (await axios.get(UrlForHitforrate, { responseType: 'text', transformResponse: (d) => d })).data;
    const ObjRateManagement = JSON.parse(Resultforrate);
    const price = ObjRateManagement[0].price_usd;
    if (price == null || String(price) === 'null' || String(price) === '') {
      return res.json('Wallet under maintenance');
    }
    const coinrateinusd = String(price);
    const outPutResult = await GenerateWalletAddressInternal(Plid, PurchaseType, ID, CoinCode, CoinName, coinrateinusd);
    return res.json(outPutResult);
  } catch (ex) {
    return res.json(ex.message);
  }
}));

// auth (HttpGet)
router.get('/member/DepositBTC/ReceiveWalletByEmail{/:id}', auth, asyncHandler(async (req, res) => {
  const { ReceiverEmail, CoinName, WalletAddress } = req.p;
  if (invalid(CoinName)) return res.json('Invalid Attempts.');
  if (invalid(ReceiverEmail)) return res.json('Invalid Attempts.');
  let strResult = 0;
  try {
    const Plid = Math.trunc(Number(req.user.plid)); // eslint-disable-line no-unused-vars
    const UserName = req.user.userName != null ? req.user.userName : req.user.username; // eslint-disable-line no-unused-vars
    if (ReceiverEmail !== '' && CoinName !== '' && WalletAddress !== '') {
      strResult = 1;
    }
    return res.json(strResult);
  } catch (ex) {
    return res.json(ex.message);
  }
}));

module.exports = router;
