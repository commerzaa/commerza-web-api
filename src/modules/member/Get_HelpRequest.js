'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Get_HelpRequest.cs (Get_HelpRequestController)
 * Prefix: /member   DB: affiliate (DataBaseContext => Db_Affiliate)
 */
const express = require('express');
const { proc, query, queryOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const config = require('../../config');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const BlockChainAPI = require('../../lib/member/BlockChainAPI');

const router = express.Router();
const DB = 'affiliate';

const BANK_PROPS = ['ACID', 'Regno', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'BANKNAME', 'BRANCHNAME', 'IFSCCODE', 'ACTIVE', 'DTM_DATE', 'DTM_UPDATE_DATE', 'PancardNo', 'SwiftCode'];
const DEDUCT_PROPS = ['FINALAMOUNT', 'TDS', 'ADMINCH', 'PROCESSINGFEE'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const toInt = (v, d) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };
const num = (v) => { const n = Number(v); if (v === undefined || v === null || v === '' || Number.isNaN(n)) throw new Error('Input string was not in a correct format.'); return n; };
const outOf = (rows, name) => {
  const f = rows && rows[0];
  if (!f) return '';
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined || f[k] === null || f[k] === undefined ? '' : String(f[k]);
};
// SqlQuery<int>(...).FirstOrDefault()
const firstInt = async (sql, p) => { const r = await queryOne(DB, sql, p); return r ? Number(Object.values(r)[0]) : 0; };
const masterCode = () => String(config.app.MasterCode || '');
const sessionOtp = (req) => {
  const v = sessionStore.get(req, 'SessionOTP');
  if (v === undefined || v === null) throw new Error('Object reference not set to an instance of an object.'); // Session["SessionOTP"].ToString()
  return String(v);
};

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: referral/fA29VDOZz8QbcUTzEgAgBg==  (Get_HelpRequest / Index, optional id)
// auth
router.all(['/member/Get_HelpRequest/Index{/:id}', '/member/referral/fA29VDOZz8QbcUTzEgAgBg=={/:id}'], auth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  let regno = 0;
  const Plid = Number(req.user.plid);
  const row = await queryOne(DB, 'SELECT REGNO FROM member_master WHERE REGNO = @Plid LIMIT 1', { Plid });
  if (row) {
    regno = Number(row.regno);
    ViewBag.btcaddress = '';
  }
  const BitCoinAmount = await BlockChainAPI.dollarToBitcoinConvertor(1);
  ViewBag.bitcoinrate = BitCoinAmount;
  const referralbonus = await queryOne(DB, "select coalesce(TITLE,'') AS t from TBL_SUBMENU_MEMBERPANEL where HERF='~/referral/referral-bonus' LIMIT 1");
  if (referralbonus) ViewBag.referralbonus = referralbonus.t;
  const binarybonus = await queryOne(DB, "select coalesce(TITLE,'') AS t from TBL_SUBMENU_MEMBERPANEL where HERF='~/referral/Binary_Payout' LIMIT 1");
  if (binarybonus) ViewBag.binarybonus = binarybonus.t;
  const growthbonus = await queryOne(DB, "select coalesce(TITLE,'') AS t from TBL_SUBMENU_MEMBERPANEL where HERF='~/referral/growth-bonus' LIMIT 1");
  if (growthbonus) ViewBag.growthbonus = growthbonus.t;
  const bd = await queryOne(DB, 'SELECT Regno,ACCOUNTHOLDERNAME,ACCOUNTNO,BANKNAME,BRANCHNAME,IFSCCODE,ACTIVE FROM Bank_Accounts Where Regno=@regno and ACTIVE=true LIMIT 1', { regno });
  const BankDetails = mapRow(bd, BANK_PROPS);
  if (BankDetails) {
    ViewBag.accountholdername = BankDetails.ACCOUNTHOLDERNAME;
    ViewBag.ACCOUNTNO = BankDetails.ACCOUNTNO;
    ViewBag.BANKNAME = BankDetails.BANKNAME;
    ViewBag.BRANCHNAME = BankDetails.BRANCHNAME;
    ViewBag.IFSCCODE = BankDetails.IFSCCODE;
  }
  return res.json({ view: '~/Views/CustomerPanel/Get_HelpRequest/Index.cshtml', Model: BankDetails, ViewBag });
}));

// OTP dispatch shared by GenerateOTPForWithdrawalRequest / GenerateOTP (fire-and-forget sends, as the legacy threads)
function sendInBackground(fn) {
  (async () => { try { await fn(); } catch (e) { console.error(e); } })();
}

// ---- GenerateOTPForWithdrawalRequest -------------------------------------------------------------------
// auth
router.all('/member/Get_HelpRequest/GenerateOTPForWithdrawalRequest{/:id}', auth, asyncHandler(async (req, res) => {
  const paymode = toInt(req.p.paymode, null);
  const btc = num(req.p.btc);
  if (paymode === null) throw new Error('Input string was not in a correct format.');
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0;
  let Emailstatus = 0;
  sessionStore.set(req, 'SessionOTP', OTP);
  const Plid = Number(req.user.plid);
  const r0 = await queryOne(DB, 'Select coalesce(REGNO,0) As REGNO From MEMBER_MASTER Where PLID=@Plid LIMIT 1', { Plid });
  const regno = r0 ? Number(r0.regno) : 0;
  if (paymode === 2) {
    const btcActive = await firstInt('SELECT coalesce(ACTIVE::int,0) AS ACTIVE FROM TBL_ACCOUNTADDRESS WHERE REGNO=@regno AND ACTIVE=true LIMIT 1', { regno });
    if (btcActive === 0) {
      return res.json('error^Please BTC Address Update !');
    }
  } else if (paymode === 8) {
    const a = await queryOne(DB, 'Select coalesce(AvailableCoinWallet,0) As AvailableCoinWallet From MEMBER_PERFORMANCE Where RegNo=@regno LIMIT 1', { regno });
    const AvailableCoinWallet = a ? Number(a.availablecoinwallet) : 0;
    if (AvailableCoinWallet < btc) {
      return res.json('error^You can not available Amount ! !');
    }
  }
  const msg = await queryOne(DB, 'SELECT Sms_Content, Sms_Send_Status FROM TBL_SMSACTION WHERE ID = 9 LIMIT 1');
  if (!msg) throw new Error('Object reference not set to an instance of an object.');
  Mobilestatus = Number(msg.sms_send_status);
  const emailmsg = await queryOne(DB, 'SELECT Email_Content, Email_Send_Status FROM tbl_emailaction WHERE EID = 9 LIMIT 1');
  if (!emailmsg) throw new Error('Object reference not set to an instance of an object.');
  Emailstatus = Number(emailmsg.email_send_status);
  const membersmsactive = await firstInt('SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS=true AND STATUS=true AND REGNO=@Plid LIMIT 1', { Plid });
  const memberemailactive = await firstInt('SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL=true AND STATUS=true AND REGNO=@Plid LIMIT 1', { Plid });
  const PLDetails = await queryOne(DB, 'SELECT PHONE, USERNAME, EMAILID FROM Portal_Login WHERE PLID = @Plid LIMIT 1', { Plid });
  if (PLDetails) {
    // legacy condition (PHONE != null || PHONE != "") is always true
    const Userid = '';
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
    if (Mobilestatus === 1 && membersmsactive === 1) {
      sendInBackground(() => UtilityClass.SendSMSWithAPI(PLDetails.phone, messg, '1'));
    } else if (Emailstatus === 1 && memberemailactive === 1) {
      sendInBackground(async () => {
        // legacy condition (EMAILID != null || EMAILID != "") is always true
        await UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Member Topup', Emailmsg, null, '', '');
      });
    } else {
      returnmessage = 'OTP BYPASS';
    }
  }
  if (Mobilestatus === 0 && Emailstatus === 0) {
    returnmessage = 'OTP BYPASS';
  }
  return res.json(returnmessage);
}));

// ---- withdrawal_request --------------------------------------------------------------------------------
// auth
router.all('/member/Get_HelpRequest/withdrawal_request{/:id}', auth, asyncHandler(async (req, res) => {
  const paymode = toInt(req.p.paymode, null);
  const amount = num(req.p.amount);
  const btc = num(req.p.btc);
  const { paymodename, masterOtp, Wallet_Address, wallettype } = req.p;
  if (paymode === null) throw new Error('Input string was not in a correct format.');
  const Plid = Number(req.user.plid);
  const msg = await queryOne(DB, 'SELECT Sms_Send_Status FROM TBL_SMSACTION WHERE ID = 9 LIMIT 1');
  const emailmsg = await queryOne(DB, 'SELECT Email_Send_Status FROM tbl_emailaction WHERE EID = 9 LIMIT 1');
  const membersmsactive = await firstInt('SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS=true AND STATUS=true AND REGNO=@Plid LIMIT 1', { Plid });
  const memberemailactive = await firstInt('SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL=true AND STATUS=true AND REGNO=@Plid LIMIT 1', { Plid });
  if (!msg || !emailmsg) throw new Error('Object reference not set to an instance of an object.');
  const setMaster = () => {
    if (masterOtp !== '') {
      if (masterCode() === masterOtp) sessionStore.set(req, 'SessionOTP', masterOtp);
    }
  };
  if (Number(msg.sms_send_status) !== 1 && membersmsactive === 1) {
    setMaster();
  } else if (Number(emailmsg.email_send_status) !== 1 && memberemailactive === 1) {
    setMaster();
  } else if (memberemailactive === 0 && membersmsactive === 0) {
    setMaster();
  }
  if (masterOtp !== sessionOtp(req)) {
    return res.json('error^You have entered wrong OTP.');
  }
  if (amount < 0) {
    return res.json('Withdrawal can not be less than zero.');
  }
  // PORT-NOTE: @STRRESULT / @WDIDOUT OUT params are read from the first result row (columns strresult, wdidout).
  const rows = await proc(DB, 'usp_gethelp_request', {
    plid: Plid, points: amount, adspoint: 0, remark: '', paymode, paymodename, memberremarks: '', wallet_address: Wallet_Address, btcvalue: btc, wallettype,
  });
  const ResultOutput = outOf(rows, 'strresult');
  sessionStore.set(req, 'SessionOTP', null); // Session.Remove("SessionOTP")
  return res.json(ResultOutput);
}));

// ---- update_bankdetail ---------------------------------------------------------------------------------
// auth
router.all('/member/Get_HelpRequest/update_bankdetail{/:id}', auth, asyncHandler(async (req, res) => {
  const { ACCOUNTHOLDERNAME, BankName, BranchName, Accountno, IFSCCode } = req.p;
  // legacy loaded the SMS/email action rows (id 9) here without using them
  await queryOne(DB, 'SELECT Sms_Content, Sms_Send_Status FROM TBL_SMSACTION WHERE ID = 9 LIMIT 1');
  await queryOne(DB, 'SELECT Email_Content, Email_Send_Status FROM tbl_emailaction WHERE EID = 9 LIMIT 1');
  const Plid = Number(req.user.plid);
  // PORT-NOTE: @STRRESULT OUT is read from the first result row (column strresult).
  const rows = await proc(DB, 'usp_insertbankdetais', {
    plid: Plid, holdername: ACCOUNTHOLDERNAME, acountno: Accountno, bankname: BankName, branchname: BranchName, iesccode: IFSCCode, pancard: '',
  });
  const ResultOutput = outOf(rows, 'strresult');
  sessionStore.set(req, 'SessionOTP', null);
  return res.json(ResultOutput);
}));

// ---- GenerateOTP ---------------------------------------------------------------------------------------
// auth
router.all('/member/Get_HelpRequest/GenerateOTP{/:id}', auth, asyncHandler(async (req, res) => {
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  sessionStore.set(req, 'SessionOTP', OTP);
  const Plid = Number(req.user.plid);
  const msg = await queryOne(DB, 'SELECT Sms_Content, Sms_Send_Status FROM TBL_SMSACTION WHERE ID = 4 LIMIT 1');
  if (!msg) throw new Error('Object reference not set to an instance of an object.');
  const Mobilestatus = Number(msg.sms_send_status);
  const emailmsg = await queryOne(DB, 'SELECT Email_Content, Email_Send_Status FROM tbl_emailaction WHERE EID = 4 LIMIT 1');
  if (!emailmsg) throw new Error('Object reference not set to an instance of an object.');
  const Emailstatus = Number(emailmsg.email_send_status);
  const PLDetails = await queryOne(DB, 'SELECT PHONE, USERNAME, EMAILID FROM Portal_Login WHERE PLID = @Plid LIMIT 1', { Plid });
  if (PLDetails) {
    const Userid = '';
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
    const membersmsactive = await firstInt('SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS=true AND STATUS=true AND REGNO=@Plid LIMIT 1', { Plid });
    const memberemailactive = await firstInt('SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL=true AND STATUS=true AND REGNO=@Plid LIMIT 1', { Plid });
    if (Mobilestatus === 1 && membersmsactive === 1) {
      sendInBackground(() => UtilityClass.SendSMSWithAPI(PLDetails.phone, messg, '1'));
    } else if (Emailstatus === 1 && memberemailactive === 1) {
      sendInBackground(async () => {
        await UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Member Topup', Emailmsg, null, '', '');
      });
    } else {
      returnmessage = 'OTP BYPASS';
    }
  }
  if (Mobilestatus === 0 && Emailstatus === 0) {
    returnmessage = 'OTP BYPASS';
  }
  return res.json(returnmessage);
}));

// ---- update_btcaddress ---------------------------------------------------------------------------------
// auth
router.all('/member/Get_HelpRequest/update_btcaddress{/:id}', auth, asyncHandler(async (req, res) => {
  const { btcaddress, OTPCODE } = req.p;
  const msg = await queryOne(DB, 'SELECT Sms_Send_Status FROM TBL_SMSACTION WHERE ID = 4 LIMIT 1');
  const emailmsg = await queryOne(DB, 'SELECT Email_Send_Status FROM tbl_emailaction WHERE EID = 4 LIMIT 1');
  if (!msg || !emailmsg) throw new Error('Object reference not set to an instance of an object.');
  if (Number(msg.sms_send_status) === 0 && Number(emailmsg.email_send_status) === 0) {
    if (masterCode() === OTPCODE) sessionStore.set(req, 'SessionOTP', OTPCODE);
  }
  if (OTPCODE !== sessionOtp(req)) {
    return res.json('error^You have entered wrong OTP.');
  }
  const Plid = Number(req.user.plid);
  // PORT-NOTE: @IntResult OUT is read from the first result row (column intresult).
  const rows = await proc(DB, 'usp_update_btc_profile', { plid: Plid, btcaddress });
  return res.json(outOf(rows, 'intresult'));
}));

// ---- AvailableCoinWallet -------------------------------------------------------------------------------
// auth
router.all('/member/Get_HelpRequest/AvailableCoinWallet{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Math.trunc(Number(req.user.plid));
  const rows = await proc(DB, 'usp_getavailablecoinwallet', { regno: Plid });
  if (!rows.length) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.'); // AvailableCoin[0]
  const coinwallet = Number(Object.values(rows[0])[0]);
  return res.json(coinwallet);
}));

// ---- GetDeductions -------------------------------------------------------------------------------------
// auth
router.all('/member/Get_HelpRequest/GetDeductions{/:id}', auth, asyncHandler(async (req, res) => {
  const WithdrawalAmount = num(req.p.WithdrawalAmount);
  const Plid = Number(req.user.plid);
  const r = await queryOne(DB, 'select * from FUN_GETFINALWITHDRAWALAMOUNT(@Plid, @WithdrawalAmount) LIMIT 1', { Plid, WithdrawalAmount });
  return res.json(mapRow(r, DEDUCT_PROPS));
}));

module.exports = router;
