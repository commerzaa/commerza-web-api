'use strict';
// Ported from Member\Controllers\CustomerPanel\Topup_Request.cs (12 actions + 1 static helper) - database: affiliate (Db_Affiliate)
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();
const config = require('../../config');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const DB = 'affiliate';
const P = '/member/Topup_Request';
const col = (row, name) => { const k = row && Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k !== undefined ? row[k] : undefined; };
const NRE = () => new Error('Object reference not set to an instance of an object.');
const fire = (fn) => { setImmediate(() => { Promise.resolve().then(fn).catch((e) => console.error(e.message)); }); }; // legacy System.Threading.Thread(...).Start()
async function errorInsert(err, procName, req) { // legacy DataUtility.ErrorInsert(code, message, procedure, line, url)
  try {
    const DU = require('../../lib/member/DataUtility');
    const ut = typeof DU === 'function' ? new DU() : (DU.DataUtility ? new DU.DataUtility() : DU);
    await ut.ErrorInsert(0, err.message, procName, 0, req ? req.path : '');
  } catch (e) { console.error(e.message); }
}
// legacy: JObject["x"].ToString()
const jstr = (v) => { if (v === undefined || v === null) throw NRE(); return typeof v === 'string' ? v : JSON.stringify(v); };
// (config keys: BFXAPIKey, BFXWalletUrl, BluefoxAPITokenKey - values were hard-coded in the C#, moved to config)
const bluefoxToken = () => (config.app.BluefoxAPITokenKey || '');

function Generatehash512(text) { // public string Generatehash512(string text)
  return crypto.createHash('sha512').update(String(text), 'utf8').digest('hex');
}
// public static decimal PoundToBitcoinConvertor(decimal Amount) - static helper, not an MVC action
async function PoundToBitcoinConvertor(Amount) { // eslint-disable-line no-unused-vars
  try {
    const BaseUrl = 'https://blockchain.info/tobtc?currency=' + (config.app.Currency || '') + '&value=' + Amount;
    const r = await axios.get(BaseUrl, { responseType: 'text', transformResponse: (x) => x });
    const n = Number(String(r.data).split(/\r?\n/)[0]);
    if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
    return n;
  } catch (ExpObj) {
    await errorInsert(ExpObj, 'PoundToBitcoinConvertor', null);
    return 0;
  }
}
async function GenrateBFXAddress(req, amount, bfxaddress) { // public int GenrateBFXAddress(decimal amount, string bfxaddress)
  const r = await db.procOne(DB, 'USP_GETBFXWALLETADDRESSDETAILS', { PLID: Number(req.user.plid), BFXWALLETADDRESS: bfxaddress, AMOUNT: amount, Mode: '1' });
  const v = col(r, 'BWAFW');
  const n = parseInt(String(v === undefined || v === null ? 0 : v), 10);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
}

// auth
// route-config: referral/new-deposit-request -> Index
router.all([P + '/Index{/:id}', '/member/referral/new-deposit-request'], auth, asyncHandler(async (req, res) => {
  const type = req.p.type === undefined || req.p.type === null ? '1' : String(req.p.type);
  res.json({ Type: type });
}));

// auth
router.all(P + '/GenerateOTP{/:id}', auth, asyncHandler(async (req, res) => {
  const Amount = Number(req.p.Amount);
  if (req.p.Amount === undefined || req.p.Amount === '' || Number.isNaN(Amount)) return res.status(400).json({ message: "The parameters dictionary contains a null entry for parameter 'Amount'" });
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0; let Emailstatus = 0;
  sessionStore.set(req, 'SessionOTP', OTP);
  const Mobile = req.user.mobile; const Emailid = req.user.emailid; const UserName = req.user.username;
  // legacy conditions (Mobile != null || Mobile != "") are always true
  const msg = await db.queryOne(DB, 'select * from TBL_SMSACTION where ID=5 limit 1');
  Mobilestatus = msg.sms_send_status;
  if (Mobilestatus === 1) {
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(UserName, msg.sms_content, '', OTP, 4);
    fire(() => UtilityClass.SendSMSWithAPI(Mobile, messg, '1'));
  }
  const emailmsg = await db.queryOne(DB, 'select * from tbl_emailaction where EID=5 limit 1');
  Emailstatus = emailmsg.email_send_status;
  if (Emailstatus === 1) {
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(UserName, emailmsg.email_content, '', OTP, 2, '');
    fire(() => UtilityClass.SendEmailByApiSetting(UserName, '', '', '', '', '', Emailid, 'Member Topup', Emailmsg, null, '', ''));
  }
  if (Mobilestatus === 0 && Emailstatus === 0) returnmessage = 'OTP BYPASS'; else returnmessage = 'OTP SENT';
  res.json(returnmessage);
}));

// public (pure hash function; public string action)
router.all(P + '/Generatehash512{/:id}', asyncHandler(async (req, res) => {
  if (req.p.text === undefined) return res.status(400).json({ message: "The parameters dictionary contains a null entry for parameter 'text'" });
  res.type('text/plain').send(Generatehash512(req.p.text));
}));

// auth
router.all(P + '/TopupRequest{/:id}', auth, asyncHandler(async (req, res) => {
  const q = req.p;
  const Amount = Number(q.Amount);
  const BWAFW = parseInt(q.BWAFW, 10); const BANKID = parseInt(q.BANKID, 10);
  if (q.Amount === undefined || q.Amount === '' || Number.isNaN(Amount) || Number.isNaN(BWAFW) || Number.isNaN(BANKID)) {
    return res.status(400).json({ message: 'The parameters dictionary contains a null or invalid entry for Amount/BWAFW/BANKID.' });
  }
  const { PaymentMode, ModeName, CommentORRemark, ChallanImage, BankName, BranchName, ReferenceDate, IFSCCode, BTCAddress, BtcUserId, BTCLabelName } = q;
  let { ReferenceNumber, OTPCODE } = q;
  const BitCoinAmount = q.BitCoinAmount;
  if (ReferenceNumber === '') {
    // rnd.ToString() is "System.Random"; DateTime.Now appended
    const StrHash = Generatehash512('System.Random' + new Date().toString());
    ReferenceNumber = StrHash.substring(0, 20);
  }
  let TransactionId = '';
  {
    const msg = await db.queryOne(DB, 'select * from TBL_SMSACTION where ID=5 limit 1');
    const emailmsg = await db.queryOne(DB, 'select * from tbl_emailaction where EID=5 limit 1');
    if (PaymentMode === '14') {
      try {
        const t = sessionStore.get(req, 'TransactionId'); // TempData["TransactionId"] (read once)
        sessionStore.set(req, 'TransactionId', null);
        TransactionId = t === undefined || t === null ? '' : String(t);
        if (TransactionId === '') return res.json('error^Invalid Transaction Id.');
      } catch (ExpObj) {
        await errorInsert(ExpObj, 'TopupRequest', req);
        return res.json('error^Invalid Transaction Id.' + ExpObj.message);
      }
    }
    if (PaymentMode === '3') TransactionId = ReferenceNumber;
    if (OTPCODE === undefined || OTPCODE === null) OTPCODE = '0';
    if (msg.sms_send_status !== 0 && emailmsg.email_send_status !== 0) {
      const so = sessionStore.get(req, 'SessionOTP');
      if (so === undefined || so === null) throw NRE();
      if (OTPCODE !== String(so)) return res.json('error^You have entered wrong OTP.');
    }
  }
  // PaymentMode == "2": legacy block is entirely commented out (BTC verification), nothing to do
  const Plid = Number(req.user.plid);
  if (Amount <= 0 || PaymentMode === '' || PaymentMode === '0') return res.json('error^Mandatory fields are required.');
  let ImageName = ''; let FullUrlWithFolder = '';
  let ReturnOutput = '';
  try {
    const RegNo = Number(await db.scalar(DB, 'select regno from member_master where regno=@plid limit 1', { plid: Plid })) || 0;
    if (ChallanImage !== '') {
      FullUrlWithFolder = req.protocol + '://' + req.get('host') + '/Challen_Image/';
      ImageName = await UtilityClass.ImageUploadMasterMethod(ChallanImage, '../Challen_Image', '../Challen_Image', UtilityClass.ImageMode.Both, String(RegNo));
      FullUrlWithFolder += ImageName;
    }
    const r = await db.procOne(DB, 'Usp_Fund_Request', {
      Mode: 1, RegNo, Type: 'Cr', Amount, Remark: CommentORRemark, PaymentMode, PaymentModeName: ModeName, ChallanImage: FullUrlWithFolder, BankName, BranchName,
      ReferenceNumber, ReferenceDate, FromDate: '', ToDate: '', StartRowIndex: '1', MaxRows: '100', IFSCCode, BTCAddress, BtcUserId, BTCLabelName,
      BitCoinAmount: (BitCoinAmount === '' ? '0.00000000' : BitCoinAmount), TransactionId, BWAFW, BANKID,
    });
    const sv = col(r, 'StrResult');
    const StrResult = sv === undefined || sv === null ? '' : String(sv);
    if (StrResult.toLowerCase() === 'success') {
      // PaymentMode 6 online-payment redirect block is commented out in legacy
      ReturnOutput = 'success^Thank you! Topup Request has been sent successfully.^/referral/do-not-refresh-payment?CommentORRemark=' + CommentORRemark + '&Amount=' + String(q.Amount).trim() + '&OrderId=' + ReferenceNumber + '';
      sessionStore.set(req, 'SessionOTP', null); // Session.Remove("SessionOTP")
    } else {
      ReturnOutput = StrResult;
    }
  } catch (ExpObj) {
    console.error(ExpObj.message);
    await errorInsert(ExpObj, 'Usp_Fund_Request', req);
    ReturnOutput = 'error^Some exception occured while making the request.';
  }
  res.json(ReturnOutput);
}));

// public (legacy had no session check)
router.all(P + '/GetDoller{/:id}', asyncHandler(async (req, res) => {
  const currency = req.p.currency;
  const UrlForHit = 'https://api.fixer.io/latest?base=' + 'USD';
  const r = await axios.get(UrlForHit, { responseType: 'text', transformResponse: (x) => x });
  const ObjATCRateManagement = JSON.parse(r.data);
  if (!ObjATCRateManagement.rates) throw NRE();
  res.json(jstr(ObjATCRateManagement.rates[currency]));
}));

// auth (calls GenrateBFXAddress which reads the member session)
router.all(P + '/GetBFXRateInDoller{/:id}', auth, asyncHandler(async (req, res) => {
  const amount = Number(req.p.amount);
  if (req.p.amount === undefined || req.p.amount === '' || Number.isNaN(amount)) return res.status(400).json({ message: "The parameters dictionary contains a null entry for parameter 'amount'" });
  let Return = ''; let bfxaddress = '';
  const StrPostData0 = JSON.stringify({ APIKey: (config.app.BFXAPIKey || '') });
  try {
    const wr = await axios.post(config.app.BFXWalletUrl || '', StrPostData0, { headers: { 'Content-Type': 'application/json' }, responseType: 'text', transformResponse: (x) => x });
    const StrPostData = String(wr.data);
    Return = StrPostData;
    const WordObj = Return.split(':');
    if (WordObj[1] === '"error","Message"') {
      return res.json(StrPostData);
    } else if (WordObj[1] === '"success","Message"') {
      Return = WordObj[2];
      const wordobj1 = Return.split('"');
      bfxaddress = wordobj1[1];
    }
  } catch (ExpObj) {
    await errorInsert(ExpObj, 'GetBFXRateInDoller', req);
  }
  const iv = await db.scalar(DB, 'SELECT coalesce(INR,0) FROM TBL_ATC_INR_RATIO_MASTER limit 1');
  const Amount = iv === null || iv === undefined ? 0 : iv;
  const BWAFWv = await GenrateBFXAddress(req, amount, bfxaddress);
  res.json(String(Amount) + '^' + bfxaddress + '^' + BWAFWv);
}));

// auth (public int action; reads the member session)
router.all(P + '/GenrateBFXAddress{/:id}', auth, asyncHandler(async (req, res) => {
  const amount = Number(req.p.amount);
  if (req.p.amount === undefined || req.p.amount === '' || Number.isNaN(amount)) return res.status(400).json({ message: "The parameters dictionary contains a null entry for parameter 'amount'" });
  res.type('text/plain').send(String(await GenrateBFXAddress(req, amount, req.p.bfxaddress)));
}));

// public (legacy had no session check)
router.all(P + '/bankdetails{/:id}', asyncHandler(async (req, res) => {
  const ID = parseInt(req.p.ID, 10);
  if (Number.isNaN(ID)) return res.status(400).json({ message: "The parameters dictionary contains a null entry for parameter 'ID'" });
  try {
    let AccountHolderName = ''; let AccountNo = ''; let BankName = ''; let BranchName = ''; let IFSCCode = ''; let LOGO = '';
    const row = await db.queryOne(DB, `select coalesce(AccountHolderName,'') as AccountHolderName, coalesce(AccountNo,'') as AccountNo, coalesce(BankName,'') as BankName,
      coalesce(BranchName,'') as BranchName, coalesce(IFSCCode,'') as IFSCCode, LOGO from Tbl_Admin_BankDetails where Status=1 and Active=1 and TABDID=@id limit 1`, { id: ID });
    if (row != null) {
      AccountHolderName = row.accountholdername; AccountNo = row.accountno; BankName = row.bankname; BranchName = row.branchname; IFSCCode = row.ifsccode; LOGO = row.logo;
    }
    const nn = (v) => (v === null || v === undefined ? '' : v);
    res.json('^' + 'Success' + '^' + AccountHolderName + '^' + AccountNo + '^' + BankName + '^' + BranchName + '^' + IFSCCode + '^' + nn(LOGO));
  } catch (ExpObj) {
    res.json('Error occurred. Please try later');
  }
}));

// public (legacy had no session check)
router.all(P + '/GetEtherAmount{/:id}', asyncHandler(async (req, res) => {
  const amount = Number(req.p.amount);
  if (req.p.amount === undefined || req.p.amount === '' || Number.isNaN(amount)) return res.status(400).json({ message: "The parameters dictionary contains a null entry for parameter 'amount'" });
  let ETHRate = 0;
  const currencyFrom = 'ethereum';
  const currencyTo = config.app.Currency || '';
  try {
    const UrlForHit = 'https://api.coinmarketcap.com/v1/ticker/ethereum/?convert=' + currencyTo;
    const r = await axios.get(UrlForHit, { responseType: 'text', transformResponse: (x) => x });
    const arr = JSON.parse(r.data);
    for (const Item of arr) {
      if (jstr(Item.id) === currencyFrom) {
        ETHRate = Number(Item['price_' + currencyTo.toLowerCase()]);
        if (Number.isNaN(ETHRate)) throw new Error('Input string was not in a correct format.');
        ETHRate = amount / ETHRate;
      }
    }
  } catch (ExpObj) {
    ETHRate = 0;
    await errorInsert(ExpObj, 'GetEtherAmount', req);
  }
  res.json(ETHRate);
}));

// public (legacy had no session check)
router.all(P + '/GetBluefoxBalance{/:id}', asyncHandler(async (req, res) => {
  const Username = req.p.Username;
  let Return = '';
  if (Username === '') {
    Return = 'Error^Please Enter Username';
  } else {
    const r = await axios.get('http://walletapi.bluefoxmovie.com//api/APIMaster', {
      params: { UserName: Username, APITokenKey: bluefoxToken() }, responseType: 'text', transformResponse: (x) => x,
    });
    Return = jstr(JSON.parse(r.data).Data);
  }
  res.json(Return);
}));

// auth
router.post(P + '/SetBlueFoxWalletOTP{/:id}', auth, asyncHandler(async (req, res) => {
  const { Username, Amount } = req.p;
  let Return = '';
  if (Username === '') Return = 'Error^Please Enter Username';
  const amt = Amount === undefined || Amount === null ? 0 : Number(Amount); // Convert.ToDecimal(null) = 0
  if (Number.isNaN(amt) || (Amount !== undefined && Amount !== null && String(Amount).trim() === '')) throw new Error('Input string was not in a correct format.');
  if (amt < 0) {
    Return = 'Error^Insufficient Balance!';
  } else {
    const r = await axios.post('http://walletapi.bluefoxmovie.com/api/APIMaster', { UserName: null, APITokenKey: null, WalletForRedeem: null, OTP: null }, {
      params: { UserName: Username, APITokenKey: bluefoxToken(), WalletForRedeem: Amount }, headers: { 'Content-Type': 'application/json' },
    });
    Return = jstr(r.data && r.data.Data);
  }
  res.json(Return);
}));

// auth
router.post(P + '/UseBlueFoxWalletOTP{/:id}', auth, asyncHandler(async (req, res) => {
  const { Username, Amount, OTP } = req.p;
  let Return = '';
  if (Username === '') Return = 'Error^Please Enter Username';
  if (OTP === '') Return = 'Error^Please Enter OTP';
  const amt = Amount === undefined || Amount === null ? 0 : Number(Amount);
  if (Number.isNaN(amt) || (Amount !== undefined && Amount !== null && String(Amount).trim() === '')) throw new Error('Input string was not in a correct format.');
  if (amt < 0) {
    Return = 'Error^Insufficient Balance!';
  } else {
    const r = await axios.post('http://walletapi.bluefoxmovie.com/api/APIMaster', { UserName: null, APITokenKey: null, WalletForRedeem: null, OTP: null }, {
      params: { UserName: Username, APITokenKey: bluefoxToken(), WalletForRedeem: Amount, OTP }, headers: { 'Content-Type': 'application/json' },
    });
    Return = jstr(r.data && r.data.Data);
    const WordObj = Return.split('^');
    if (WordObj[0] === 'Success') sessionStore.set(req, 'TransactionId', WordObj[1]); // TempData["TransactionId"]
    Return = WordObj[0];
  }
  res.json(Return);
}));

module.exports = router;
