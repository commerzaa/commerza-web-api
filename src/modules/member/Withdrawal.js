'use strict';
// Ported from Member\Controllers\CustomerPanel\Withdrawal.cs (WithdrawalController) - database: affiliate (Db_Affiliate)
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const BlockChainAPI = require('../../lib/member/BlockChainAPI');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/Withdrawal';
const DB = 'affiliate';
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const pick = (r, name) => { const k = Object.keys(r || {}).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const outv = (rows, name) => (rows && rows.length ? pick(rows[0], name) : undefined);
const sget = (req, k) => sessionStore.get(req, k.toLowerCase());
const sset = (req, k, v) => sessionStore.set(req, k.toLowerCase(), v);
const MASTER = () => config.app.MasterCode || ''; // ConfigurationManager.AppSettings["MasterCode"]
const fire = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e.message)); }; // legacy background thread
const BANK_PROPS = ['Regno', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'BANKNAME', 'BRANCHNAME', 'IFSCCODE', 'ACTIVE'];
const DEDUCT_PROPS = ['FINALAMOUNT', 'TDS', 'ADMINCH', 'PROCESSINGFEE'];

// [route-config] referral/Hgg5NUlqddIbPWWevserkQ== => Withdrawal/Index
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/Hgg5NUlqddIbPWWevserkQ=='], ...guard, asyncHandler(async (req, res) => { // route-config
  const p = req.p;
  let ddlcustpage = p.ddlcustpage === undefined || p.ddlcustpage === null || p.ddlcustpage === '' ? null : parseInt(p.ddlcustpage, 10);
  if (ddlcustpage === null) ddlcustpage = 100; // legacy: assigned but unused
  const ViewBag = {};
  let regno = 0;
  const Plid = Number(req.user.plid);
  const row = await db.queryOne(DB, 'select * from member_master where regno = @r limit 1', { r: Plid });
  if (row) {
    regno = row.regno;
    ViewBag.btcaddress = '';
  }
  const BitCoinAmount = await BlockChainAPI.dollarToBitcoinConvertor(1);
  ViewBag.bitcoinrate = BitCoinAmount;
  const referralbonus = await db.scalar(DB, "select coalesce(title,'') from tbl_submenu_memberpanel where herf = '~/referral/referral-bonus' limit 1");
  if (referralbonus !== null && referralbonus !== undefined) ViewBag.referralbonus = referralbonus;
  const binarybonus = await db.scalar(DB, "select coalesce(title,'') from tbl_submenu_memberpanel where herf = '~/referral/Binary_Payout' limit 1");
  if (binarybonus !== null && binarybonus !== undefined) ViewBag.binarybonus = binarybonus;
  const growthbonus = await db.scalar(DB, "select coalesce(title,'') from tbl_submenu_memberpanel where herf = '~/referral/growth-bonus' limit 1");
  if (growthbonus !== null && growthbonus !== undefined) ViewBag.growthbonus = growthbonus;
  const br = await db.queryOne(DB, 'SELECT regno, accountholdername, accountno, bankname, branchname, ifsccode, active FROM bank_accounts Where regno = @r and active = true limit 1', { r: regno });
  const BankDetails = br ? mapRows([br], BANK_PROPS)[0] : null;
  if (BankDetails !== null) {
    ViewBag.accountholdername = BankDetails.ACCOUNTHOLDERNAME;
    ViewBag.ACCOUNTNO = BankDetails.ACCOUNTNO;
    ViewBag.BANKNAME = BankDetails.BANKNAME;
    ViewBag.BRANCHNAME = BankDetails.BRANCHNAME;
    ViewBag.IFSCCODE = BankDetails.IFSCCODE;
  }
  res.json({ Model: BankDetails, ViewBag });
}));

// auth
router.all(`${P}/GenerateOTPForWithdrawalRequest{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const paymode = parseInt(req.p.paymode, 10);
  const btc = Number(req.p.btc);
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0;
  let Emailstatus = 0;
  sset(req, 'SessionOTP', OTP);
  const Plid = Number(req.user.plid);
  const regnoV = await db.scalar(DB, 'Select coalesce(regno,0) As regno From member_master Where plid = @p limit 1', { p: Plid });
  const regno = regnoV === null || regnoV === undefined ? 0 : Number(regnoV);
  if (paymode === 2) {
    const a = await db.scalar(DB, 'SELECT coalesce(active,0) AS active FROM tbl_accountaddress WHERE regno = @r AND active = 1 limit 1', { r: regno });
    const btcActive = a === null || a === undefined ? 0 : Number(a);
    if (btcActive === 0) return res.json('error^Please BTC Address Update !');
  } else if (paymode === 8) {
    const a = await db.scalar(DB, 'Select coalesce(availablecoinwallet,0) As availablecoinwallet From member_performance Where regno = @r limit 1', { r: regno });
    const AvailableCoinWallet = a === null || a === undefined ? 0 : Number(a);
    if (AvailableCoinWallet < btc) return res.json('error^You can not available Amount ! !');
  }
  const msg = await db.queryOne(DB, 'select * from tbl_smsaction where id = 9 limit 1');
  if (!msg) throw NRE();
  Mobilestatus = msg.sms_send_status;
  const emailmsg = await db.queryOne(DB, 'select * from tbl_emailaction where eid = 9 limit 1');
  if (!emailmsg) throw NRE();
  Emailstatus = emailmsg.email_send_status;
  const membersmsactive = Number(await db.scalar(DB, 'SELECT 1 FROM tbl_memberauthentication WHERE issms = 1 AND status = 1 AND regno = @r limit 1', { r: Plid })) || 0;
  const memberemailactive = Number(await db.scalar(DB, 'SELECT 1 FROM tbl_memberauthentication WHERE isemail = 1 AND status = 1 AND regno = @r limit 1', { r: Plid })) || 0;
  const PLDetails = await db.queryOne(DB, 'select * from portal_login where plid = @plid limit 1', { plid: Plid });
  if (PLDetails) {
    // legacy condition (PHONE != null || PHONE != "") is always true
    const Userid = '';
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
    if (Mobilestatus === 1 && membersmsactive === 1) {
      fire(() => UtilityClass.SendSMSWithAPI(PLDetails.phone, messg, '1'));
    } else if (Emailstatus === 1 && memberemailactive === 1) {
      fire(() => UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Member Topup', Emailmsg, null, '', ''));
    } else {
      returnmessage = 'OTP BYPASS';
    }
  }
  if (Mobilestatus === 0 && Emailstatus === 0) returnmessage = 'OTP BYPASS';
  res.json(returnmessage);
}));

// auth
router.all(`${P}/withdrawal_request{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const p = req.p;
  const paymode = parseInt(p.paymode, 10);
  const amount = Number(p.amount);
  const btc = Number(p.btc);
  const { paymodename, masterOtp, Wallet_Address, wallettype } = p;
  const plid = Number(req.user.plid);
  const msg = await db.queryOne(DB, 'select * from tbl_smsaction where id = 9 limit 1');
  const emailmsg = await db.queryOne(DB, 'select * from tbl_emailaction where eid = 9 limit 1');
  const membersmsactive = Number(await db.scalar(DB, 'SELECT 1 FROM tbl_memberauthentication WHERE issms = 1 AND status = 1 AND regno = @r limit 1', { r: plid })) || 0;
  const memberemailactive = Number(await db.scalar(DB, 'SELECT 1 FROM tbl_memberauthentication WHERE isemail = 1 AND status = 1 AND regno = @r limit 1', { r: plid })) || 0;
  const masterOk = () => MASTER() !== '' && MASTER() === masterOtp;
  if (msg.sms_send_status !== 1 && membersmsactive === 1) {
    if (masterOtp !== '') { if (masterOk()) sset(req, 'SessionOTP', masterOtp); }
  } else if (emailmsg.email_send_status !== 1 && memberemailactive === 1) {
    if (masterOtp !== '') { if (masterOk()) sset(req, 'SessionOTP', masterOtp); }
  } else if (memberemailactive === 0 && membersmsactive === 0) {
    if (masterOtp !== '') { if (masterOk()) sset(req, 'SessionOTP', masterOtp); }
  }
  const so = sget(req, 'SessionOTP');
  if (so === undefined || so === null) throw NRE();
  if (masterOtp !== String(so)) return res.json('error^You have entered wrong OTP.');
  if (amount < 0) return res.json('Withdrawal can not be less than zero.');
  const rows = await db.proc(DB, 'usp_withdrawal_request', {
    PLID: plid, POINTS: amount, ADSPOINT: 0, REMARK: '', PayMode: paymode, PayModeName: paymodename, MemberRemarks: '',
    Wallet_Address, BTCValue: btc, WALLETTYPE: wallettype,
  });
  const o = outv(rows, 'strresult');
  if (o === undefined || o === null) throw NRE();
  const ResultOutput = String(o); // @WDIDOUT (WDID) read but unused in legacy
  sset(req, 'SessionOTP', null); // Session.Remove("SessionOTP")
  res.json(ResultOutput);
}));

// auth
router.all(`${P}/update_bankdetail{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const p = req.p;
  // legacy first block only read TBL_SMSACTION / tbl_emailaction (id 9) without using the rows - dropped
  const Plid = Number(req.user.plid);
  const rows = await db.proc(DB, 'usp_insertbankdetais', {
    PLID: Plid, HOLDERNAME: p.ACCOUNTHOLDERNAME, ACOUNTNO: p.Accountno, BANKNAME: p.BankName, BRANCHNAME: p.BranchName, IESCCODE: p.IFSCCode, PANCARD: '',
  });
  const o = outv(rows, 'strresult');
  if (o === undefined || o === null) throw NRE();
  sset(req, 'SessionOTP', null); // Session.Remove("SessionOTP")
  res.json(String(o));
}));

// auth
router.all(`${P}/GenerateOTP{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0;
  let Emailstatus = 0;
  sset(req, 'SessionOTP', OTP);
  const Plid = Number(req.user.plid);
  const msg = await db.queryOne(DB, 'select * from tbl_smsaction where id = 4 limit 1');
  if (!msg) throw NRE();
  Mobilestatus = msg.sms_send_status;
  const emailmsg = await db.queryOne(DB, 'select * from tbl_emailaction where eid = 4 limit 1');
  if (!emailmsg) throw NRE();
  Emailstatus = emailmsg.email_send_status;
  const PLDetails = await db.queryOne(DB, 'select * from portal_login where plid = @plid limit 1', { plid: Plid });
  if (PLDetails) {
    const Userid = '';
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
    const membersmsactive = Number(await db.scalar(DB, 'SELECT 1 FROM tbl_memberauthentication WHERE issms = 1 AND status = 1 AND regno = @r limit 1', { r: Plid })) || 0;
    const memberemailactive = Number(await db.scalar(DB, 'SELECT 1 FROM tbl_memberauthentication WHERE isemail = 1 AND status = 1 AND regno = @r limit 1', { r: Plid })) || 0;
    if (Mobilestatus === 1 && membersmsactive === 1) {
      fire(() => UtilityClass.SendSMSWithAPI(PLDetails.phone, messg, '1'));
    } else if (Emailstatus === 1 && memberemailactive === 1) {
      fire(() => UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Member Topup', Emailmsg, null, '', ''));
    } else {
      returnmessage = 'OTP BYPASS';
    }
  }
  if (Mobilestatus === 0 && Emailstatus === 0) returnmessage = 'OTP BYPASS';
  res.json(returnmessage);
}));

// auth
router.all(`${P}/update_btcaddress{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const { btcaddress, OTPCODE } = req.p;
  const msg = await db.queryOne(DB, 'select * from tbl_smsaction where id = 4 limit 1');
  const emailmsg = await db.queryOne(DB, 'select * from tbl_emailaction where eid = 4 limit 1');
  if (msg.sms_send_status === 0 && emailmsg.email_send_status === 0) {
    if (MASTER() !== '' && MASTER() === OTPCODE) sset(req, 'SessionOTP', OTPCODE);
  }
  const so = sget(req, 'SessionOTP');
  if (so === undefined || so === null) throw NRE();
  if (OTPCODE !== String(so)) return res.json('error^You have entered wrong OTP.');
  const Plid = Number(req.user.plid);
  const rows = await db.proc(DB, 'usp_update_btc_profile', { plid: Plid, BTCAddress: btcaddress });
  const o = outv(rows, 'intresult');
  if (o === undefined || o === null) throw NRE();
  res.json(String(o));
}));

// auth
router.all(`${P}/AvailableCoinWallet{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const rows = await db.proc(DB, 'usp_getavailablecoinwallet', { REGNO: Plid });
  if (!rows.length) throw new RangeError('Index was out of range. Must be non-negative and less than the size of the collection.');
  const first = rows[0];
  res.json(Number(first[Object.keys(first)[0]]));
}));

// auth
router.all(`${P}/GetDeductions{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const rows = await db.query(DB, 'select * from fun_getfinalwithdrawalamount(@plid, @amt)', { plid: Plid, amt: Number(req.p.WithdrawalAmount) });
  res.json(rows.length ? mapRows([rows[0]], DEDUCT_PROPS)[0] : null);
}));

module.exports = router;
