'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/ETHWithdrawal.cs  (ETHWithdrawalController, 7 actions)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
// Session["Plid"] -> req.user.plid ; Session["SessionOTP"] -> utils/sessionStore key 'SessionOTP'
const express = require('express');
const router = express.Router();
const config = require('../../config');
const { queryOne, scalar, proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const BlockChainAPI = require('../../lib/member/BlockChainAPI');

const DB = 'affiliate';
const BASE = '/member/ETHWithdrawal';
const s = (v) => (v === undefined || v === null ? '' : String(v));
const NRE = () => new Error('Object reference not set to an instance of an object.');
const outv = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
const fire = (fn) => { Promise.resolve().then(fn).catch(() => { /* background thread failures are not observable in the legacy app */ }); };
const flag = async (sql, p) => { const r = await queryOne(DB, sql, p); return r ? Number(r[Object.keys(r)[0]]) : 0; };
const AUTH_SMS = 'SELECT 1 FROM tbl_memberauthentication WHERE issms = 1 AND status = 1 AND regno = @plid limit 1';
const AUTH_EMAIL = 'SELECT 1 FROM tbl_memberauthentication WHERE isemail = 1 AND status = 1 AND regno = @plid limit 1';
const sessionOtp = (req) => { const v = sessionStore.get(req, 'SessionOTP'); if (v === undefined || v === null) throw NRE(); return String(v); };
const masterCode = () => s(config.app.MasterCode);

// sends the OTP (shared by GenerateOTPForWithdrawalRequest and GenerateOTP; identical blocks in the C#)
async function sendOtp(req, smsId, emailId, { checkPaymode3 }) {
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0;
  let Emailstatus = 0;
  sessionStore.set(req, 'SessionOTP', OTP);
  const Plid = Number(req.user.plid);
  const plidInt = parseInt(req.user.plid, 10);
  if (checkPaymode3) {
    // PORT-NOTE: legacy read REGNO from MEMBER_MASTER by a PLID column; member_master has no PLID in the schema (REGNO == PLID), so REGNO is used.
    const rg = await scalar(DB, 'Select coalesce(regno, 0) As regno From member_master Where regno = @plid limit 1', { plid: plidInt });
    const regno = rg === null || rg === undefined ? 0 : rg;
    if (checkPaymode3.paymode === 3) {
      const a = await scalar(DB, 'SELECT coalesce(active, 0) AS active FROM tbl_accountaddress WHERE regno = @regno AND active = 1 limit 1', { regno });
      const btcActive = a === null || a === undefined ? 0 : Number(a);
      if (btcActive === 0) {
        return 'error^Please ETH Address Update !';
      }
    }
  }
  const msg = await queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id = @id limit 1', { id: smsId });
  if (!msg) throw NRE();
  Mobilestatus = msg.sms_send_status;
  const emailmsg = await queryOne(DB, 'select email_content, email_send_status from tbl_emailaction where eid = @id limit 1', { id: emailId });
  if (!emailmsg) throw NRE();
  Emailstatus = emailmsg.email_send_status;
  const PLDetails = await queryOne(DB, 'select plid, phone, username, tpassword, emailid from portal_login where plid = @plid limit 1', { plid: Plid });
  if (PLDetails) {
    // legacy condition (PHONE != null || PHONE != "") is always true
    const Userid = '';
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
    const membersmsactive = await flag(AUTH_SMS, { plid: plidInt });
    const memberemailactive = await flag(AUTH_EMAIL, { plid: plidInt });
    if (Mobilestatus === 1 && membersmsactive === 1) {
      fire(() => UtilityClass.SendSMSWithAPI(PLDetails.phone, messg, '1'));
    } else if (Emailstatus === 1 && memberemailactive === 1) {
      fire(() => UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Member Topup', Emailmsg, null, '', ''));
    } else {
      returnmessage = 'OTP BYPASS';
    }
  }
  if (Mobilestatus === 0 && Emailstatus === 0) {
    returnmessage = 'OTP BYPASS';
  }
  return returnmessage;
}

// Index(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// route-config: referral/zSALPzrsxdh5jOGEbuKDkw==  (id optional)
// auth
router.all([`${BASE}/Index{/:id}`, BASE, '/member/referral/zSALPzrsxdh5jOGEbuKDkw=={/:id}'], auth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  let regno = 0;
  const Plid = Number(req.user.plid);
  const row = await queryOne(DB, 'select regno from member_master where regno = @plid limit 1', { plid: Plid });
  if (row) {
    regno = row.regno;
    ViewBag.btcaddress = '';
  }
  const BitCoinAmount = await BlockChainAPI.dollarToBitcoinConvertor(1);
  ViewBag.bitcoinrate = BitCoinAmount;
  const title = (href) => scalar(DB, "select coalesce(title, '') from tbl_submenu_memberpanel where herf = @href limit 1", { href });
  const referralbonus = await title('~/referral/referral-bonus');
  if (referralbonus !== null && referralbonus !== undefined) ViewBag.referralbonus = referralbonus;
  const binarybonus = await title('~/referral/Binary_Payout');
  if (binarybonus !== null && binarybonus !== undefined) ViewBag.binarybonus = binarybonus;
  const growthbonus = await title('~/referral/growth-bonus');
  if (growthbonus !== null && growthbonus !== undefined) ViewBag.growthbonus = growthbonus;
  const bd = await queryOne(DB, 'SELECT regno, accountholdername, accountno, bankname, branchname, ifsccode, active FROM bank_accounts Where regno = @regno and active = true limit 1', { regno });
  let BankDetails = null;
  if (bd) {
    // BankDetailsFORETH: columns not selected keep their C# defaults
    BankDetails = {
      ACID: 0, Regno: bd.regno, ACCOUNTHOLDERNAME: bd.accountholdername, ACCOUNTNO: bd.accountno, BANKNAME: bd.bankname, BRANCHNAME: bd.branchname,
      IFSCCODE: bd.ifsccode, ACTIVE: bd.active, DTM_DATE: '0001-01-01T00:00:00', DTM_UPDATE_DATE: '0001-01-01T00:00:00', PancardNo: null, SwiftCode: null,
    };
    ViewBag.accountholdername = BankDetails.ACCOUNTHOLDERNAME;
    ViewBag.ACCOUNTNO = BankDetails.ACCOUNTNO;
    ViewBag.BANKNAME = BankDetails.BANKNAME;
    ViewBag.BRANCHNAME = BankDetails.BRANCHNAME;
    ViewBag.IFSCCODE = BankDetails.IFSCCODE;
  }
  res.json({ view: '~/Views/CustomerPanel/ETHWithdrawal/Index.cshtml', Model: BankDetails, ViewBag });
}));

// GenerateOTPForWithdrawalRequest(int paymode, decimal btc)
// auth
router.all(`${BASE}/GenerateOTPForWithdrawalRequest{/:id}`, auth, asyncHandler(async (req, res) => {
  const paymode = parseInt(req.p.paymode, 10);
  if (Number.isNaN(paymode)) throw new Error('Input string was not in a correct format.');
  res.json(await sendOtp(req, 9, 9, { checkPaymode3: { paymode } }));
}));

// withdrawal_request(int paymode, decimal amount, decimal btc, string paymodename, string masterOtp, string Wallet_Address, string wallettype)
// auth
router.all(`${BASE}/withdrawal_request{/:id}`, auth, asyncHandler(async (req, res) => {
  const paymode = parseInt(req.p.paymode, 10);
  const amount = Number(req.p.amount);
  const btc = Number(req.p.btc);
  const { paymodename, masterOtp, Wallet_Address, wallettype } = req.p;
  const plidInt = parseInt(req.user.plid, 10);
  const msg = await queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id = 9 limit 1');
  const emailmsg = await queryOne(DB, 'select email_content, email_send_status from tbl_emailaction where eid = 9 limit 1');
  const membersmsactive = await flag(AUTH_SMS, { plid: plidInt });
  const memberemailactive = await flag(AUTH_EMAIL, { plid: plidInt });
  const applyMaster = () => {
    if (masterOtp !== '') {
      if (masterCode() === masterOtp) sessionStore.set(req, 'SessionOTP', masterOtp);
    }
  };
  if (!msg) throw NRE();
  if (msg.sms_send_status !== 1 && membersmsactive === 1) {
    applyMaster();
  } else {
    if (!emailmsg) throw NRE();
    if (emailmsg.email_send_status !== 1 && memberemailactive === 1) {
      applyMaster();
    } else if (memberemailactive === 0 && membersmsactive === 0) {
      applyMaster();
    }
  }
  if (masterOtp !== sessionOtp(req)) {
    return res.json('error^You have entered wrong OTP.');
  }
  const Plid = Number(req.user.plid);
  if (amount < 0) {
    return res.json('Withdrawal can not be less than zero.');
  }
  // PORT-NOTE: @STRRESULT / @WDIDOUT OUT are read from the columns of the single result row
  const rows = await proc(DB, 'usp_withdrawal_request', {
    plid: Plid, points: amount, adspoint: 0, remark: '', paymode, paymodename, memberremarks: '', wallet_address: Wallet_Address, btcvalue: btc, wallettype,
  });
  const ResultOutput = s(outv(rows[0], 'strresult'));
  sessionStore.set(req, 'SessionOTP', null);
  res.json(ResultOutput);
}));

// update_bankdetail(string ACCOUNTHOLDERNAME, string BankName, string BranchName, string Accountno, string IFSCCode)
// auth
router.all(`${BASE}/update_bankdetail{/:id}`, auth, asyncHandler(async (req, res) => {
  const { ACCOUNTHOLDERNAME, BankName, BranchName, Accountno, IFSCCode } = req.p;
  const Plid = Number(req.user.plid);
  // (the C# first loaded the sms/email action rows into unused locals - no side effect)
  // PORT-NOTE: @STRRESULT OUT is read from the "strresult" column of the single result row
  const rows = await proc(DB, 'usp_insertbankdetais', {
    plid: Plid, holdername: ACCOUNTHOLDERNAME, acountno: Accountno, bankname: BankName, branchname: BranchName, iesccode: IFSCCode, pancard: '',
  });
  const ResultOutput = s(outv(rows[0], 'strresult'));
  sessionStore.set(req, 'SessionOTP', null);
  res.json(ResultOutput);
}));

// GenerateOTP()
// auth
router.all(`${BASE}/GenerateOTP{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await sendOtp(req, 4, 4, { checkPaymode3: null }));
}));

// update_btcaddress(string btcaddress, string OTPCODE)
// auth
router.all(`${BASE}/update_btcaddress{/:id}`, auth, asyncHandler(async (req, res) => {
  const { btcaddress, OTPCODE } = req.p;
  const msg = await queryOne(DB, 'select sms_send_status from tbl_smsaction where id = 4 limit 1');
  const emailmsg = await queryOne(DB, 'select email_send_status from tbl_emailaction where eid = 4 limit 1');
  if (!msg || !emailmsg) throw NRE();
  if (msg.sms_send_status === 0 && emailmsg.email_send_status === 0) {
    if (masterCode() === OTPCODE) sessionStore.set(req, 'SessionOTP', OTPCODE);
  }
  if (OTPCODE !== sessionOtp(req)) {
    return res.json('error^You have entered wrong OTP.');
  }
  const Plid = Number(req.user.plid);
  // PORT-NOTE: @IntResult OUT is read from the "intresult" column of the single result row
  const rows = await proc(DB, 'usp_update_btc_profile', { plid: Plid, btcaddress });
  res.json(s(outv(rows[0], 'intresult')));
}));

// AvailableCoinWallet(): SqlQuery<decimal>(...)[0] (ArgumentOutOfRangeException when the procedure returns no row)
// auth
router.all(`${BASE}/AvailableCoinWallet{/:id}`, auth, asyncHandler(async (req, res) => {
  const Plid = parseInt(req.user.plid, 10);
  const rows = await proc(DB, 'usp_getavailablecoinwallet', { regno: Plid });
  if (!rows.length) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.');
  res.json(Number(rows[0][Object.keys(rows[0])[0]]));
}));

module.exports = router;
