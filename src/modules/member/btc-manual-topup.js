'use strict';
// Port of Member\Common\Controllers\CustomerPanel\BTC_Manual_Topup.cs (BTC_Manual_TopupController)
const express = require('express');
const axios = require('axios');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const config = require('../../config');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');
const CoinPaymentAPI = require('../../lib/member/CoinPaymentAPI');
const DB = 'affiliate';
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row.
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : null);
const errorInsert = async (e, procName, req) => {
  try { await new DataUtility().ErrorInsert(0, e && e.message, procName, 0, req.path); } catch (_) { /* ignore */ }
};
const dec = (v) => {
  const n = Number(v);
  if (v === undefined || v === null || String(v).trim() === '' || Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
};
const str = (v) => (v === undefined || v === null ? '' : String(v));

// auth
// route-config: referral/cl14_slash_4Sd6nrLk2Atv6xzCpzYWYRmdC1h -> BTC_Manual_Topup/Index
router.all(['/member/BTC_Manual_Topup/Index{/:id}', '/member/referral/cl14_slash_4Sd6nrLk2Atv6xzCpzYWYRmdC1h'], auth, asyncHandler(async (req, res) => {
  // Auto approval of BTC/ETH/LTC/XRP/BCH etc. for e-wallet topup (fire and forget background thread)
  Promise.resolve().then(() => CoinPaymentAPI.PaymentAutoClearification(Number(req.user.plid))).catch(() => {});
  res.json({});
}));

// auth
router.all('/member/BTC_Manual_Topup/GetBTCAddress{/:id}', auth, asyncHandler(async (req, res) => {
  let BTCAddress = await db.scalar(DB, "select coalesce(SECRET_PIN,'') as SECRET_PIN from TBL_PAYMODE where PMOID=2 and status=1 limit 1", {});
  BTCAddress = await UtilityClass.Decryptword(BTCAddress);
  res.json(BTCAddress);
}));

// auth (SessionExpireCheck)
router.all('/member/BTC_Manual_Topup/TopupRequest{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const Plid = Number(req.user.plid);
  const Amount = dec(p.Amount);
  const PaymentMode = p.PaymentMode;
  if (Amount <= 0 || PaymentMode === '' || PaymentMode === '0') {
    return res.json('error^Mandatory fields are required.');
  }
  let ImageName = '';
  let FullUrlWithFolder = '';
  let ReturnOutput = '';
  try {
    const rm = await db.queryOne(DB, 'select regno from member_master where regno=@plid limit 1', { plid: Plid });
    const RegNo = rm === null ? 0 : rm.regno;
    const ChallanImage = p.ChallanImage;
    if (ChallanImage !== '') {
      FullUrlWithFolder = req.protocol + '://' + req.get('host') + '/Challen_Image/';
      ImageName = await UtilityClass.ImageUploadMasterMethod(ChallanImage, '../Challen_Image', '../Challen_Image', UtilityClass.ImageMode.Both, String(RegNo));
      FullUrlWithFolder += ImageName;
    }
    const rows = await db.proc(DB, 'usp_fund_request', {
      mode: 1, regno: RegNo, type: 'Cr', amount: Amount, remark: p.CommentORRemark, paymentmode: PaymentMode,
      paymentmodename: p.ModeName, challanimage: FullUrlWithFolder, bankname: p.BankName, branchname: p.BranchName,
      referencenumber: p.ReferenceNumber, referencedate: p.ReferenceDate, fromdate: '', todate: '', startrowindex: '1',
      maxrows: '100', ifsccode: p.IFSCCode, btcaddress: p.BTCAddress, btcuserid: p.BtcUserId, btclabelname: p.BTCLabelName,
      bitcoinamount: (p.BitCoinAmount === '' ? '0.00000000' : p.BitCoinAmount), transactionid: p.TransactionId, bwafw: parseInt(p.BWAFW, 10),
    });
    const strResult = str(outv(rows, 'strresult'));
    if (strResult.toLowerCase() === 'success') {
      ReturnOutput = 'success^Thank you! Topup Request has been sent successfully.';
      sessionStore.set(req, 'SessionOTP', null); // Session.Remove("SessionOTP")
    } else {
      ReturnOutput = strResult;
    }
  } catch (ExpObj) {
    await errorInsert(ExpObj, 'Usp_Fund_Request', req);
    ReturnOutput = 'error^Some exception occured while making the request.';
  }
  return res.json(ReturnOutput);
}));

// auth
router.all('/member/BTC_Manual_Topup/GetDoller{/:id}', auth, asyncHandler(async (req, res) => {
  const currency = req.p.currency;
  const UrlForHit = 'https://api.fixer.io/latest?base=' + 'USD';
  const r = await axios.get(UrlForHit, { responseType: 'text', transformResponse: (x) => x });
  const obj = JSON.parse(r.data);
  const abc = String(obj.rates[currency]);
  res.json(abc);
}));

// Shared by GetBFXRateInDoller / GenrateBFXAddress (public int method that uses Session["Plid"])
async function GenrateBFXAddress(req, amount, bfxaddress) {
  const rows = await db.proc(DB, 'usp_getbfxwalletaddressdetails', {
    plid: Number(req.user.plid), bfxwalletaddress: bfxaddress, amount, mode: '1',
  });
  return parseInt(String(outv(rows, 'bwafw') === null ? 0 : outv(rows, 'bwafw')), 10);
}

// auth
router.all('/member/BTC_Manual_Topup/GetBFXRateInDoller{/:id}', auth, asyncHandler(async (req, res) => {
  const amount = dec(req.p.amount);
  let Return = '';
  let bfxaddress = '';
  try {
    // PORT-NOTE: API key / endpoint were hard-coded in C#; read from config.app.BFXWalletApiKey / BFXWalletUrl instead.
    const postBody = JSON.stringify({ APIKey: config.app.BFXWalletApiKey || '' });
    const r = await axios.post(config.app.BFXWalletUrl || '', postBody, { headers: { 'Content-Type': 'application/json' }, responseType: 'text', transformResponse: (x) => x });
    const StrPostData = r.data;
    Return = String(StrPostData);
    const WordObj = Return.split(':');
    if (WordObj[1] === '"error","Message"') {
      return res.json(StrPostData);
    } else if (WordObj[1] === '"success","Message"') {
      Return = WordObj[2].toString();
      const wordobj1 = Return.split('"');
      bfxaddress = wordobj1[1];
    }
  } catch (ExpObj) {
    await errorInsert(ExpObj, 'GetBFXRateInDoller', req);
  }
  let Amount = await db.scalar(DB, 'SELECT coalesce(INR,0) FROM TBL_ATC_INR_RATIO_MASTER limit 1', {});
  if (Amount === null || Amount === undefined) Amount = 0;
  const BWAFW = await GenrateBFXAddress(req, amount, bfxaddress);
  const returnresult = String(Amount) + '^' + bfxaddress + '^' + BWAFW;
  res.json(returnresult);
}));

// auth
router.all('/member/BTC_Manual_Topup/GenrateBFXAddress{/:id}', auth, asyncHandler(async (req, res) => {
  res.json(await GenrateBFXAddress(req, dec(req.p.amount), req.p.bfxaddress));
}));

// auth
router.all('/member/BTC_Manual_Topup/GetEtherAmount{/:id}', auth, asyncHandler(async (req, res) => {
  const amount = dec(req.p.amount);
  let ETHRate = 0;
  const currencyFrom = 'ethereum';
  const currencyTo = config.app.Currency || '';
  try {
    const UrlForHit = 'https://api.coinmarketcap.com/v1/ticker/ethereum/?convert=' + currencyTo;
    const r = await axios.get(UrlForHit, { responseType: 'text', transformResponse: (x) => x });
    const arr = JSON.parse(r.data);
    for (const Item of arr) {
      if (String(Item.id) === currencyFrom) {
        ETHRate = Number(Item['price_' + currencyTo.toLowerCase()]);
        ETHRate = amount / ETHRate;
      }
    }
  } catch (ExpObj) {
    ETHRate = 0;
    await errorInsert(ExpObj, 'GetEtherAmount', req);
  }
  res.json(ETHRate);
}));

// PORT-NOTE: the Bluefox APITokenKey (BFMWDAPIOUT) was hard-coded in C#; read from config.app.BluefoxAPITokenKey.
const bluefoxKey = () => config.app.BluefoxAPITokenKey || '';
const bluefoxBase = 'http://walletapi.bluefoxmovie.com';

// auth
router.all('/member/BTC_Manual_Topup/GetBluefoxBalance{/:id}', auth, asyncHandler(async (req, res) => {
  const Username = req.p.Username;
  let Return = '';
  if (Username === '') {
    Return = 'Error^Please Enter Username';
  } else {
    const UrlForHit = bluefoxBase + '//api/APIMaster?UserName=' + Username + '&APITokenKey=' + bluefoxKey();
    const r = await axios.get(UrlForHit, { responseType: 'text', transformResponse: (x) => x });
    Return = String(JSON.parse(r.data).Data);
  }
  res.json(Return);
}));

// auth
router.post('/member/BTC_Manual_Topup/SetBlueFoxWalletOTP{/:id}', auth, asyncHandler(async (req, res) => {
  const Username = req.p.Username;
  const Amount = req.p.Amount;
  let Return = '';
  if (Username === '') {
    Return = 'Error^Please Enter Username';
  }
  if (dec(Amount) < 0) {
    Return = 'Error^Insufficient Balance!';
  } else {
    const Obj = { UserName: null, APITokenKey: null, WalletForRedeem: null, OTP: null };
    const r = await axios.post(bluefoxBase + '/api/APIMaster?UserName=' + Username + '&APITokenKey=' + bluefoxKey() + '&WalletForRedeem=' + Amount, Obj, { validateStatus: () => true });
    Return = String(r.data.Data);
  }
  res.json(Return);
}));

// auth
router.post('/member/BTC_Manual_Topup/UseBlueFoxWalletOTP{/:id}', auth, asyncHandler(async (req, res) => {
  const Username = req.p.Username;
  const Amount = req.p.Amount;
  const OTP = req.p.OTP;
  let Return = '';
  if (Username === '') {
    Return = 'Error^Please Enter Username';
  }
  if (OTP === '') {
    Return = 'Error^Please Enter OTP';
  }
  if (dec(Amount) < 0) {
    Return = 'Error^Insufficient Balance!';
  } else {
    const Obj = { UserName: null, APITokenKey: null, WalletForRedeem: null, OTP: null };
    const r = await axios.post(bluefoxBase + '/api/APIMaster?UserName=' + Username + '&APITokenKey=' + bluefoxKey() + '&WalletForRedeem=' + Amount + '&OTP=' + OTP, Obj, { validateStatus: () => true });
    Return = String(r.data.Data);
    const WordObj = Return.split('^');
    if (WordObj[0] === 'Success') {
      sessionStore.set(req, 'TempData.TransactionId', WordObj[1]); // TempData["TransactionId"]
    }
    Return = WordObj[0];
  }
  res.json(Return);
}));

module.exports = router;
