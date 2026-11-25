'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Topup_Request_Coin.cs (Topup_Request_CoinController)
 *  - 5 actions: Index, GenerateOTP, TopupRequest, GetDoller, GetEtherAmount (PoundToBitcoinConvertor is static => not an action; ported as internal function) */
const express = require('express');
const axios = require('axios');
const { queryOne, proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const config = require('../../config');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Topup_Request_Coin';
const outv = (rows, name) => { const r = rows && rows[0]; if (!r) return undefined; const k = Object.keys(r).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e)); };
const reqDec = (v, name) => {
  const n = Number(String(v === undefined || v === null ? '' : v).trim());
  if (v === undefined || v === null || String(v).trim() === '' || Number.isNaN(n)) throw new Error(`The parameters dictionary contains a null or invalid entry for parameter '${name}' of non-nullable type 'System.Decimal'.`);
  return n;
};
const reqInt = (v, name) => {
  const n = Number(v);
  if (v === undefined || v === null || String(v).trim() === '' || !Number.isInteger(n)) throw new Error(`The parameters dictionary contains a null or invalid entry for parameter '${name}' of non-nullable type 'System.Int32'.`);
  return n;
};

// public static decimal PoundToBitcoinConvertor(decimal Amount) - static helper, not routed
async function PoundToBitcoinConvertor(Amount) {
  try {
    const BaseUrl = 'https://blockchain.info/tobtc?currency=' + config.app.Currency + '&value=' + Amount;
    const r = await axios.get(BaseUrl, { responseType: 'text', transformResponse: (d) => d });
    const str = String(r.data).split(/\r?\n/)[0];
    const n = Number(str);
    if (str.trim() === '' || Number.isNaN(n)) throw new Error('format');
    return n;
  } catch (e) {
    return 0;
  }
}
router.PoundToBitcoinConvertor = PoundToBitcoinConvertor;

// route-config: none in RouteConfig.cs
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
router.all(`${P}/Index{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json({});
}));

// auth (uses Session["plid"])
router.all(`${P}/GenerateOTP{/:id}`, auth, asyncHandler(async (req, res) => {
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0;
  let Emailstatus = 0;
  sessionStore.set(req, 'SessionOTP', OTP);
  const Plid = Number(req.user.plid);
  const msg = await queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id = 5 limit 1');
  Mobilestatus = msg.sms_send_status; // msg null => TypeError (legacy NullReferenceException)
  const emailmsg = await queryOne(DB, 'select email_content, email_send_status from tbl_emailaction where eid = 5 limit 1');
  Emailstatus = emailmsg.email_send_status;
  const PLDetails = await queryOne(DB, 'select phone, emailid, username from portal_login where plid = @plid limit 1', { plid: Plid });
  if (PLDetails != null) {
    // legacy condition (PHONE != null || PHONE != "") is always true
    const Userid = '';
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 4);
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
    if (Mobilestatus === 1) {
      bg(() => UtilityClass.SendSMSWithAPI(PLDetails.phone, messg, '1'));
    }
    if (Emailstatus === 1) {
      bg(() => UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Member Topup', Emailmsg, null, '', ''));
    }
  }
  if (Mobilestatus === 0 && Emailstatus === 0) {
    returnmessage = 'OTP BYPASS';
  } else {
    returnmessage = 'OTP SENT';
  }
  res.json(returnmessage);
}));

// auth ([SessionExpireCheck])
// PORT-NOTE: OUT parameters @StrResult / @TotalCount of Usp_Fund_Request are read from the "strresult" column of the first result row.
// PORT-NOTE: TempData["TransactionId"] (written by BTC_Manual_Topup) is read from the session store key 'TransactionId'.
router.all(`${P}/TopupRequest{/:id}`, auth, asyncHandler(async (req, res) => {
  const Amount = reqDec(req.p.Amount, 'Amount');
  const { PaymentMode, ModeName, CommentORRemark, ChallanImage, BankName, BranchName, ReferenceDate, ReferenceNumber, IFSCCode, BTCAddress, BtcUserId, BTCLabelName, BitCoinAmount } = req.p;
  let OTPCODE = req.p.OTPCODE;
  const BWAFW = reqInt(req.p.BWAFW, 'BWAFW');
  let TransactionId = '';
  {
    const msg = await queryOne(DB, 'select sms_send_status from tbl_smsaction where id = 5 limit 1');
    const emailmsg = await queryOne(DB, 'select email_send_status from tbl_emailaction where eid = 5 limit 1');
    if (msg.sms_send_status === 0 && emailmsg.email_send_status === 0) {
      if (config.app.MasterCode === OTPCODE) {
        sessionStore.set(req, 'SessionOTP', OTPCODE);
      }
    }
  }
  if (PaymentMode === '14') {
    try {
      const t = sessionStore.get(req, 'TransactionId');
      TransactionId = t === undefined || t === null ? '' : String(t);
      if (TransactionId === '') {
        return res.json('error^Invalid Transaction Id.');
      }
    } catch (ExpObj) {
      return res.json('error^Invalid Transaction Id.' + ExpObj.message);
    }
  }
  if (PaymentMode === '3') {
    TransactionId = ReferenceNumber;
  }
  if (OTPCODE == null) {
    OTPCODE = '0';
  }
  if (OTPCODE !== sessionStore.get(req, 'SessionOTP').toString()) { // session OTP null => TypeError (legacy NullReferenceException)
    return res.json('error^You have entered wrong OTP.');
  }
  const Plid = Number(req.user.plid);
  if (Amount <= 0 || PaymentMode === '' || PaymentMode === '0') {
    return res.json('error^Mandatory fields are required.');
  }
  let ImageName = '';
  let FullUrlWithFolder = '';
  let ReturnOutput = '';
  try {
    const m = await queryOne(DB, 'select regno from member_master where regno = @plid limit 1', { plid: Plid });
    const RegNo = m ? m.regno : 0;
    if (ChallanImage !== '') {
      FullUrlWithFolder = `${req.protocol}://${req.get('host')}/Challen_Image/`;
      ImageName = await UtilityClass.ImageUploadMasterMethod(ChallanImage, '../Challen_Image', '../Challen_Image', UtilityClass.ImageMode.Both, String(RegNo));
      FullUrlWithFolder += ImageName;
    }
    const rows = await proc(DB, 'usp_fund_request', {
      mode: 1, regno: RegNo, type: 'Cr', amount: Amount, remark: CommentORRemark, paymentmode: PaymentMode, paymentmodename: ModeName,
      challanimage: FullUrlWithFolder, bankname: BankName, branchname: BranchName, referencenumber: ReferenceNumber, referencedate: ReferenceDate,
      fromdate: '', todate: '', startrowindex: '1', maxrows: '100', ifsccode: IFSCCode, btcaddress: BTCAddress, btcuserid: BtcUserId,
      btclabelname: BTCLabelName, bitcoinamount: (BitCoinAmount === '' ? '0.00000000' : BitCoinAmount), transactionid: TransactionId, bwafw: BWAFW,
    });
    const o = outv(rows, 'strresult');
    const s = String(o); // null => legacy NullReferenceException (caught below)
    if (o === undefined || o === null) throw new TypeError('Object reference not set to an instance of an object.');
    if (s.toLowerCase() === 'success') {
      ReturnOutput = 'success^Thank you! Topup Request has been sent successfully.';
      sessionStore.set(req, 'SessionOTP', null); // Session.Remove("SessionOTP")
    } else {
      ReturnOutput = s;
    }
  } catch (EX) {
    ReturnOutput = 'error^Some exception occured while making the request.';
  }
  res.json(ReturnOutput);
}));

// public (no session access)
router.all(`${P}/GetDoller{/:id}`, asyncHandler(async (req, res) => {
  const currency = req.p.currency;
  const UrlForHit = 'https://api.fixer.io/latest?base=' + 'USD';
  const r = await axios.get(UrlForHit, { responseType: 'text', transformResponse: (d) => d });
  const ObjATCRateManagement = JSON.parse(r.data);
  const abc = String(ObjATCRateManagement.rates[currency]);
  res.json(abc);
}));

// public (no session access)
router.all(`${P}/GetEtherAmount{/:id}`, asyncHandler(async (req, res) => {
  const amount = reqDec(req.p.amount, 'amount');
  let ETHRate = 0;
  const currencyFrom = 'ethereum';
  const currencyTo = config.app.Currency;
  try {
    const UrlForHit = 'https://api.coinmarketcap.com/v1/ticker/ethereum/?convert=' + currencyTo;
    const r = await axios.get(UrlForHit, { responseType: 'text', transformResponse: (d) => d });
    const ObjBTCRateManagement = JSON.parse(r.data);
    for (const Item of ObjBTCRateManagement) {
      if (String(Item.id) === currencyFrom) {
        ETHRate = Number(Item['price_' + String(currencyTo).toLowerCase()]);
        ETHRate = amount / ETHRate;
      }
    }
  } catch (e) {
    ETHRate = 0;
  }
  res.json(ETHRate);
}));

module.exports = router;
