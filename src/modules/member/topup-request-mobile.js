'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/Topup_Request_Mobile.cs  (Topup_Request_MobileController, 10 public actions)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
// Session["Plid"] -> req.user.plid ; Session["SessionOTP"] / TempData["TransactionId"] -> utils/sessionStore ('SessionOTP' / 'TempData.TransactionId')
// Config keys used (config.app.*): MasterCode, Currency, BFXWalletUrl (full BFX wallet API URL), BFXApiKey, BlueFoxAPITokenKey
const express = require('express');
const axios = require('axios');
const router = express.Router();
const config = require('../../config');
const { queryOne, scalar, proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const CoinPaymentAPI = require('../../lib/member/CoinPaymentAPI');

const DB = 'affiliate';
const BASE = '/member/Topup_Request_Mobile';
const s = (v) => (v === undefined || v === null ? '' : String(v));
const NRE = () => new Error('Object reference not set to an instance of an object.');
const outv = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
const fire = (fn) => { Promise.resolve().then(fn).catch(() => { /* background thread failures are not observable in the legacy app */ }); };
const text = { responseType: 'text', transformResponse: (d) => d };
const sessionOtp = (req) => { const v = sessionStore.get(req, 'SessionOTP'); if (v === undefined || v === null) throw NRE(); return String(v); };
const masterCode = () => s(config.app.MasterCode);
const toDecimal = (v) => { const n = Number(v); if (v === undefined || v === null || String(v).trim() === '' || Number.isNaN(n)) throw new Error('Input string was not in a correct format.'); return n; };
async function errInsert(req, name, e) {
  try { const DataUtility = require('../../lib/member/DataUtility'); await new DataUtility().ErrorInsert(0, e && e.message, name, 0, req.path); } catch (_) { /* ErrorInsert must never throw */ }
}

// Index()
// route-config: referral/Topup-Request-Mobile
// auth
router.all([`${BASE}/Index{/:id}`, BASE, '/member/referral/Topup-Request-Mobile'], auth, asyncHandler(async (req, res) => {
  // background auto-approval of BTC/ETH/LTC/XRP/BCH etc. e-wallet topups (new Thread in the C#)
  const RegNo = req.user.plid;
  fire(() => CoinPaymentAPI.PaymentAutoClearification(RegNo));
  res.json({ view: '~/Views/CustomerPanel/Topup_Request_Mobile/Index.cshtml', ViewBag: { secretkey: '' } });
}));

// GenerateOTP()
// auth
router.all(`${BASE}/GenerateOTP{/:id}`, auth, asyncHandler(async (req, res) => {
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0;
  let Emailstatus = 0;
  sessionStore.set(req, 'SessionOTP', OTP);
  const Plid = Number(req.user.plid);
  const msg = await queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id = 5 limit 1');
  if (!msg) throw NRE();
  Mobilestatus = msg.sms_send_status;
  const emailmsg = await queryOne(DB, 'select email_content, email_send_status from tbl_emailaction where eid = 5 limit 1');
  if (!emailmsg) throw NRE();
  Emailstatus = emailmsg.email_send_status;
  const PLDetails = await queryOne(DB, 'select plid, phone, username, tpassword, emailid from portal_login where plid = @plid limit 1', { plid: Plid });
  if (PLDetails) {
    // legacy condition (PHONE != null || PHONE != "") is always true
    const Userid = '';
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 4);
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
    if (Mobilestatus === 1) {
      fire(() => UtilityClass.SendSMSWithAPI(PLDetails.phone, messg, '1'));
    }
    if (Emailstatus === 1) {
      fire(() => UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Member Topup', Emailmsg, null, '', ''));
    }
  }
  if (Mobilestatus === 0 && Emailstatus === 0) {
    returnmessage = 'OTP BYPASS';
  } else {
    returnmessage = 'OTP SENT';
  }
  res.json(returnmessage);
}));

// TopupRequest(decimal Amount, string PaymentMode, string ModeName, string CommentORRemark, string ChallanImage, string BankName, string BranchName,
//   string ReferenceDate, string ReferenceNumber, string IFSCCode, string BTCAddress, string OTPCODE, string BtcUserId, string BTCLabelName, string BitCoinAmount, int BWAFW)  [SessionExpireCheck]
// auth
router.all(`${BASE}/TopupRequest{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const Amount = toDecimal(p.Amount);
  const PaymentMode = p.PaymentMode;
  const { ModeName, CommentORRemark, ChallanImage, BankName, BranchName, ReferenceDate, ReferenceNumber, IFSCCode, BTCAddress, BtcUserId, BTCLabelName, BitCoinAmount } = p;
  let OTPCODE = p.OTPCODE;
  const BWAFW = parseInt(p.BWAFW, 10);
  if (Number.isNaN(BWAFW)) throw new Error('Input string was not in a correct format.'); // int model binding
  let TransactionId = '';
  {
    const msg = await queryOne(DB, 'select sms_send_status from tbl_smsaction where id = 5 limit 1');
    const emailmsg = await queryOne(DB, 'select email_send_status from tbl_emailaction where eid = 5 limit 1');
    if (!msg || !emailmsg) throw NRE();
    if (msg.sms_send_status === 0 && emailmsg.email_send_status === 0) {
      if (masterCode() === OTPCODE) sessionStore.set(req, 'SessionOTP', OTPCODE);
    }
  }
  if (PaymentMode === '14') {
    TransactionId = s(sessionStore.get(req, 'TempData.TransactionId'));
    if (TransactionId === '') {
      return res.json('error^Invalid Transaction Id.');
    }
  }
  if (PaymentMode === '3') {
    TransactionId = ReferenceNumber;
  }
  if (OTPCODE === undefined || OTPCODE === null) OTPCODE = '0';
  if (OTPCODE !== sessionOtp(req)) {
    return res.json('error^You have entered wrong OTP.');
  }
  // (PaymentMode == "2": the BTC transaction validation block is commented out in the C#)
  const Plid = Number(req.user.plid);
  if (Amount <= 0 || PaymentMode === '' || PaymentMode === '0') {
    return res.json('error^Mandatory fields are required.');
  }
  let ImageName = '';
  let FullUrlWithFolder = '';
  let ReturnOutput = '';
  try {
    const rg = await scalar(DB, 'select regno from member_master where regno = @plid limit 1', { plid: Plid });
    const RegNo = rg === null || rg === undefined ? 0 : rg;
    if (ChallanImage !== '') {
      FullUrlWithFolder = `${req.protocol}://${req.get('host')}` + '/Challen_Image/';
      ImageName = await UtilityClass.ImageUploadMasterMethod(ChallanImage, '../Challen_Image', '../Challen_Image', UtilityClass.ImageMode.Both, String(RegNo));
      FullUrlWithFolder += ImageName;
    }
    // PORT-NOTE: @StrResult / @TotalCount OUT are read from the columns of the single result row
    const rows = await proc(DB, 'usp_fund_request', {
      mode: 1, regno: RegNo, type: 'Cr', amount: Amount, remark: CommentORRemark, paymentmode: PaymentMode, paymentmodename: ModeName,
      challanimage: FullUrlWithFolder, bankname: BankName, branchname: BranchName, referencenumber: ReferenceNumber, referencedate: ReferenceDate,
      fromdate: '', todate: '', startrowindex: '1', maxrows: '100', ifsccode: IFSCCode, btcaddress: BTCAddress, btcuserid: BtcUserId,
      btclabelname: BTCLabelName, bitcoinamount: (BitCoinAmount === '' ? '0.00000000' : BitCoinAmount), transactionid: TransactionId, bwafw: BWAFW,
    });
    const strResult = s(outv(rows[0], 'strresult'));
    if (strResult.toLowerCase() === 'success') {
      ReturnOutput = 'success^Thank you! Topup Request has been sent successfully.';
      sessionStore.set(req, 'SessionOTP', null);
    } else {
      ReturnOutput = strResult;
    }
  } catch (ExpObj) {
    await errInsert(req, 'Usp_Fund_Request', ExpObj);
    ReturnOutput = 'error^Some exception occured while making the request.';
  }
  res.json(ReturnOutput);
}));

// GetDoller(string currency): no session check -> public
// public
router.all(`${BASE}/GetDoller{/:id}`, asyncHandler(async (req, res) => {
  const currency = req.p.currency;
  const UrlForHit = 'https://api.fixer.io/latest?base=' + 'USD';
  const r = await axios.get(UrlForHit, text);
  const ObjATCRateManagement = JSON.parse(r.data);
  const v = ObjATCRateManagement.rates[currency];
  if (v === undefined || v === null) throw NRE();
  res.json(String(v));
}));

// internal: GenrateBFXAddress(decimal amount, string bfxaddress) - public int method => also routed below
async function GenrateBFXAddress(req, amount, bfxaddress) {
  // PORT-NOTE: @intResult / @BWAFW OUT are read from the columns of the single result row
  const rows = await proc(DB, 'usp_getbfxwalletaddressdetails', { plid: req.user.plid, bfxwalletaddress: bfxaddress, amount, mode: '1' });
  const v = parseInt(outv(rows[0], 'bwafw'), 10);
  return Number.isNaN(v) ? 0 : v;
}

// GetBFXRateInDoller(decimal amount): uses the session member in GenrateBFXAddress => auth
// auth
router.all(`${BASE}/GetBFXRateInDoller{/:id}`, auth, asyncHandler(async (req, res) => {
  const amount = toDecimal(req.p.amount);
  let bfxaddress = '';
  const StrPostData = JSON.stringify({ APIKey: s(config.app.BFXApiKey) });
  try {
    const r = await axios.post(s(config.app.BFXWalletUrl), StrPostData, { headers: { 'Content-Type': 'application/json' }, ...text });
    const Return = String(r.data);
    const WordObj = Return.split(':');
    if (WordObj[1] === '"error","Message"') {
      return res.json(Return);
    } else if (WordObj[1] === '"success","Message"') {
      const wordobj1 = WordObj[2].split('"');
      bfxaddress = wordobj1[1];
    }
  } catch (ExpObj) {
    await errInsert(req, 'GetBFXRateInDoller', ExpObj);
  }
  const rate = await scalar(DB, 'SELECT coalesce(inr, 0) FROM tbl_atc_inr_ratio_master limit 1');
  const Amount = rate === null || rate === undefined ? 0 : rate;
  const BWAFW = await GenrateBFXAddress(req, amount, bfxaddress);
  res.json(String(Amount) + '^' + bfxaddress + '^' + BWAFW);
}));

// GenrateBFXAddress(decimal amount, string bfxaddress): public int method (MVC action) => plain-text number
// auth
router.all(`${BASE}/GenrateBFXAddress{/:id}`, auth, asyncHandler(async (req, res) => {
  const n = await GenrateBFXAddress(req, toDecimal(req.p.amount), req.p.bfxaddress);
  res.type('text/plain').send(String(n));
}));

// GetEtherAmount(decimal amount): public rate lookup
// public
router.all(`${BASE}/GetEtherAmount{/:id}`, asyncHandler(async (req, res) => {
  const amount = toDecimal(req.p.amount);
  let ETHRate = 0;
  const currencyFrom = 'ethereum';
  const currencyTo = s(config.app.Currency);
  try {
    const UrlForHit = 'https://api.coinmarketcap.com/v1/ticker/ethereum/?convert=' + currencyTo;
    const r = await axios.get(UrlForHit, text);
    const ObjBTCRateManagement = JSON.parse(r.data);
    for (const Item of ObjBTCRateManagement) {
      if (String(Item.id) === currencyFrom) {
        ETHRate = Number(Item['price_' + currencyTo.toLowerCase()]);
        ETHRate = amount / ETHRate;
      }
    }
  } catch (ExpObj) {
    ETHRate = 0;
    await errInsert(req, 'GetEtherAmount', ExpObj);
  }
  res.json(ETHRate);
}));

const BLUEFOX = 'http://walletapi.bluefoxmovie.com';
const bluefoxToken = () => s(config.app.BlueFoxAPITokenKey);

// GetBluefoxBalance(string Username)
// auth
router.all(`${BASE}/GetBluefoxBalance{/:id}`, auth, asyncHandler(async (req, res) => {
  const Username = req.p.Username;
  let Return = '';
  if (Username === '') {
    Return = 'Error^Please Enter Username';
  } else {
    const UrlForHit = BLUEFOX + '//api/APIMaster?UserName=' + Username + '&APITokenKey=' + bluefoxToken();
    const r = await axios.get(UrlForHit, text);
    const o = JSON.parse(r.data);
    if (o.Data === undefined || o.Data === null) throw NRE();
    Return = typeof o.Data === 'string' ? o.Data : JSON.stringify(o.Data);
  }
  res.json(Return);
}));

// SetBlueFoxWalletOTP(string Username, string Amount)  [HttpPost]
// (the C# `if (Username == "")` message is overwritten by the following if/else, which always runs)
// auth
router.post(`${BASE}/SetBlueFoxWalletOTP{/:id}`, auth, asyncHandler(async (req, res) => {
  const { Username, Amount } = req.p;
  let Return = '';
  if (Username === '') {
    Return = 'Error^Please Enter Username';
  }
  if (toDecimal(Amount) < 0) {
    Return = 'Error^Insufficient Balance!';
  } else {
    const r = await axios.post(BLUEFOX + '/api/APIMaster?UserName=' + Username + '&APITokenKey=' + bluefoxToken() + '&WalletForRedeem=' + Amount,
      { UserName: null, APITokenKey: null, WalletForRedeem: null, OTP: null }, { headers: { 'Content-Type': 'application/json' } });
    const d = r.data && r.data.Data;
    if (d === undefined || d === null) throw NRE();
    Return = typeof d === 'string' ? d : JSON.stringify(d);
  }
  res.json(Return);
}));

// UseBlueFoxWalletOTP(string Username, string Amount, string OTP)  [HttpPost]
// auth
router.post(`${BASE}/UseBlueFoxWalletOTP{/:id}`, auth, asyncHandler(async (req, res) => {
  const { Username, Amount, OTP } = req.p;
  let Return = '';
  if (Username === '') {
    Return = 'Error^Please Enter Username';
  }
  if (OTP === '') {
    Return = 'Error^Please Enter OTP';
  }
  if (toDecimal(Amount) < 0) {
    Return = 'Error^Insufficient Balance!';
  } else {
    const r = await axios.post(BLUEFOX + '/api/APIMaster?UserName=' + Username + '&APITokenKey=' + bluefoxToken() + '&WalletForRedeem=' + Amount + '&OTP=' + OTP,
      { UserName: null, APITokenKey: null, WalletForRedeem: null, OTP: null }, { headers: { 'Content-Type': 'application/json' } });
    const d = r.data && r.data.Data;
    if (d === undefined || d === null) throw NRE();
    Return = typeof d === 'string' ? d : JSON.stringify(d);
    const WordObj = Return.split('^');
    if (WordObj[0] === 'Success') {
      sessionStore.set(req, 'TempData.TransactionId', WordObj[1]);
    }
    Return = WordObj[0];
  }
  res.json(Return);
}));

module.exports = router;
