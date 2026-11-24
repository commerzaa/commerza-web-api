'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\WithdrawalMobile.cs (WithdrawalMobileController) */
const express = require('express');
const config = require('../../config');
const { queryOne, scalar, proc } = require('../../db');
const { mapRow } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const BlockChainAPI = require('../../lib/member/BlockChainAPI');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/WithdrawalMobile';
const DEDUCTION_PROPS = ['FINALAMOUNT', 'TDS', 'ADMINCH', 'PROCESSINGFEE'];
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const NPE = () => new Error('Object reference not set to an instance of an object.');
const need = (o) => { if (o === null || o === undefined) throw NPE(); return o; };
// replaces `new Thread(delegate { ... }).Start()` (fire and forget)
const fire = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e.message)); };
const masterCode = () => (config.app && config.app.MasterCode !== undefined ? config.app.MasterCode : (process.env.MASTER_CODE === undefined ? null : process.env.MASTER_CODE));
const authFlag = async (col, plid) => Number(await scalar(DB, `select 1 from tbl_memberauthentication where ${col}::int = 1 and status::int = 1 and regno = @r limit 1`, { r: plid })) || 0;

/**
 * Shared body of GenerateOTPForWithdrawalRequest / GenerateOTP (identical OTP logic, different sms/email action ids and pre-checks).
 * `pre(Plid)` may return a string to short-circuit (legacy returned Json(...) right away; the OTP is already stored in the session by then).
 */
async function generateOtp(req, res, actionId, pre) {
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0;
  let Emailstatus = 0;
  sessionStore.set(req, 'SessionOTP', OTP);
  const Plid = Math.trunc(Number(req.user.plid));
  if (pre) {
    const early = await pre(Plid);
    if (early !== undefined) return res.json(early);
  }
  const msg = await queryOne(DB, 'select * from tbl_smsaction where id = @id limit 1', { id: actionId });
  Mobilestatus = Number(need(msg).sms_send_status);
  const emailmsg = await queryOne(DB, 'select * from tbl_emailaction where eid = @id limit 1', { id: actionId });
  Emailstatus = Number(need(emailmsg).email_send_status);
  const membersmsactive = await authFlag('issms', Plid);
  const memberemailactive = await authFlag('isemail', Plid);
  const PLDetails = await queryOne(DB, 'select * from portal_login where plid = @plid limit 1', { plid: Plid });
  if (PLDetails != null) {
    // legacy condition `PHONE != null || PHONE != ""` is always true
    const Userid = '';
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
    if (Mobilestatus === 1 && membersmsactive === 1) {
      fire(() => UtilityClass.SendSMSWithAPI(PLDetails.phone, messg, '1'));
    } else if (Emailstatus === 1 && memberemailactive === 1) {
      fire(async () => {
        // legacy condition `EMAILID != null || EMAILID != ""` is always true
        await UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Member Topup', Emailmsg, null, '', '');
      });
    } else {
      returnmessage = 'OTP BYPASS';
    }
  }
  if (Mobilestatus === 0 && Emailstatus === 0) returnmessage = 'OTP BYPASS';
  return res.json(returnmessage);
}

// auth (null session => RedirectToAction("Index","Home"))
// route-config: "referral/Withdrawal-Mobile" -> WithdrawalMobile/Index
router.all([`${P}/Index{/:id}`, P, '/member/referral/Withdrawal-Mobile'], auth, asyncHandler(async (req, res) => {
  // SearchField / SearchValue / fromdate / todate / page / ddlcustpage are accepted by the legacy action but never used afterwards
  const ViewBag = {};
  let regno = 0;
  const Plid = Math.trunc(Number(req.user.plid));
  const row = await queryOne(DB, 'select regno from member_master where regno = @plid limit 1', { plid: Plid });
  if (row) {
    regno = Number(row.regno);
    ViewBag.btcaddress = '';
  }
  const BitCoinAmount = await BlockChainAPI.dollarToBitcoinConvertor(1);
  ViewBag.bitcoinrate = BitCoinAmount;

  const titleOf = async (href) => {
    const r = await queryOne(DB, "select coalesce(title, '') as title from tbl_submenu_memberpanel where herf = @h limit 1", { h: href });
    return r ? r.title : null;
  };
  const referralbonus = await titleOf('~/referral/referral-bonus');
  if (referralbonus != null) ViewBag.referralbonus = referralbonus;
  const binarybonus = await titleOf('~/referral/Binary_Payout');
  if (binarybonus != null) ViewBag.binarybonus = binarybonus;
  const growthbonus = await titleOf('~/referral/growth-bonus');
  if (growthbonus != null) ViewBag.growthbonus = growthbonus;

  const bd = await queryOne(DB,
    'select Regno, ACCOUNTHOLDERNAME, ACCOUNTNO, BANKNAME, BRANCHNAME, IFSCCODE, ACTIVE from Bank_Accounts where Regno = @regno and ACTIVE::int = 1 limit 1', { regno });
  let BankDetails = null;
  if (bd != null) {
    BankDetails = mapRow(bd, ['Regno', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'BANKNAME', 'BRANCHNAME', 'IFSCCODE', 'ACTIVE']);
    // BankDetails_mobile members that are not selected keep their C# defaults
    BankDetails = Object.assign({ ACID: 0 }, BankDetails, { DTM_DATE: '0001-01-01T00:00:00', DTM_UPDATE_DATE: '0001-01-01T00:00:00', PancardNo: null, SwiftCode: null });
    ViewBag.accountholdername = BankDetails.ACCOUNTHOLDERNAME;
    ViewBag.ACCOUNTNO = BankDetails.ACCOUNTNO;
    ViewBag.BANKNAME = BankDetails.BANKNAME;
    ViewBag.BRANCHNAME = BankDetails.BRANCHNAME;
    ViewBag.IFSCCODE = BankDetails.IFSCCODE;
  }
  res.json({ Model: BankDetails, ViewBag });
}));

// auth (legacy had no session check but dereferenced Session["plid"])
router.all(`${P}/GenerateOTPForWithdrawalRequest{/:id}`, auth, asyncHandler(async (req, res) => {
  const paymode = toInt(req.p.paymode);
  const btc = Number(req.p.btc);
  return generateOtp(req, res, 9, async (Plid) => {
    // PORT-NOTE: legacy "Select ISNULL(REGNO,0) From MEMBER_MASTER Where PLID=..." references a column (PLID) that MEMBER_MASTER does not have
    // (it would raise an SQL error); REGNO is the member id, so it is looked up by REGNO here.
    const r = await scalar(DB, 'select coalesce(regno, 0) from member_master where regno = @plid limit 1', { plid: Plid });
    const regno = r === null || r === undefined ? 0 : Number(r);
    if (paymode === 2) {
      const a = await scalar(DB, 'select coalesce(active::int, 0) from tbl_accountaddress where regno = @r and active::int = 1 limit 1', { r: regno });
      const btcActive = a === null || a === undefined ? 0 : Number(a);
      if (btcActive === 0) return 'error^Please BTC Address Update !';
    } else if (paymode === 8) {
      const w = await scalar(DB, 'select coalesce(availablecoinwallet, 0) from member_performance where regno = @r limit 1', { r: regno });
      const AvailableCoinWallet = w === null || w === undefined ? 0 : Number(w);
      if (AvailableCoinWallet < btc) return 'error^You can not available Amount ! !';
    }
    return undefined;
  });
}));

// auth (legacy had no session check but dereferenced Session["Plid"])
router.all(`${P}/withdrawal_request{/:id}`, auth, asyncHandler(async (req, res) => {
  const paymode = toInt(req.p.paymode);
  const amount = Number(req.p.amount);
  const btc = Number(req.p.btc);
  const { paymodename, masterOtp, Wallet_Address, wallettype } = req.p;
  const Plid = Math.trunc(Number(req.user.plid));
  {
    const msg = await queryOne(DB, 'select * from tbl_smsaction where id = 9 limit 1', {});
    const emailmsg = await queryOne(DB, 'select * from tbl_emailaction where eid = 9 limit 1', {});
    const membersmsactive = await authFlag('issms', Plid);
    const memberemailactive = await authFlag('isemail', Plid);
    const MasterCode = masterCode();
    if (Number(need(msg).sms_send_status) !== 1 && membersmsactive === 1) {
      if (masterOtp !== '') { if (MasterCode === masterOtp) sessionStore.set(req, 'SessionOTP', masterOtp); }
    } else if (Number(need(emailmsg).email_send_status) !== 1 && memberemailactive === 1) {
      if (masterOtp !== '') { if (MasterCode === masterOtp) sessionStore.set(req, 'SessionOTP', masterOtp); }
    } else if (memberemailactive === 0 && membersmsactive === 0) {
      if (masterOtp !== '') { if (MasterCode === masterOtp) sessionStore.set(req, 'SessionOTP', masterOtp); }
    }
  }
  if (masterOtp !== String(need(sessionStore.get(req, 'SessionOTP')))) {
    return res.json('error^You have entered wrong OTP.');
  }
  if (amount < 0) return res.json('Withdrawal can not be less than zero.');
  // @STRRESULT / @WDIDOUT are OUTPUT parameters (read from the result row; WDID is not used afterwards)
  const rows = await proc(DB, 'usp_withdrawal_request', {
    plid: Plid, points: amount, adspoint: 0, remark: '', paymode, paymodename, memberremarks: '',
    wallet_address: Wallet_Address, btcvalue: btc, wallettype,
  });
  const ResultOutput = rows.length && rows[0].strresult !== undefined && rows[0].strresult !== null ? String(rows[0].strresult) : null;
  if (ResultOutput === null) throw NPE();
  sessionStore.set(req, 'SessionOTP', null); // Session.Remove("SessionOTP")
  res.json(ResultOutput);
}));

// auth (legacy had no session check but dereferenced Session["Plid"])
router.all(`${P}/update_bankdetail{/:id}`, auth, asyncHandler(async (req, res) => {
  const { ACCOUNTHOLDERNAME, BankName, BranchName, Accountno, IFSCCode } = req.p;
  const Plid = Math.trunc(Number(req.user.plid));
  // (legacy first loaded the sms/email action rows 9 here but never used them)
  const rows = await proc(DB, 'usp_insertbankdetais', {
    plid: Plid, holdername: ACCOUNTHOLDERNAME, acountno: Accountno, bankname: BankName, branchname: BranchName, iesccode: IFSCCode, pancard: '',
  });
  const ResultOutput = rows.length && rows[0].strresult !== undefined && rows[0].strresult !== null ? String(rows[0].strresult) : null;
  if (ResultOutput === null) throw NPE();
  sessionStore.set(req, 'SessionOTP', null); // Session.Remove("SessionOTP")
  res.json(ResultOutput);
}));

// auth (legacy had no session check but dereferenced Session["plid"])
router.all(`${P}/GenerateOTP{/:id}`, auth, asyncHandler(async (req, res) => generateOtp(req, res, 4, null)));

// auth (legacy had no session check but dereferenced Session["Plid"])
router.all(`${P}/update_btcaddress{/:id}`, auth, asyncHandler(async (req, res) => {
  const { btcaddress, OTPCODE } = req.p;
  {
    const msg = await queryOne(DB, 'select * from tbl_smsaction where id = 4 limit 1', {});
    const emailmsg = await queryOne(DB, 'select * from tbl_emailaction where eid = 4 limit 1', {});
    if (Number(need(msg).sms_send_status) === 0 && Number(need(emailmsg).email_send_status) === 0) {
      if (masterCode() === OTPCODE) sessionStore.set(req, 'SessionOTP', OTPCODE);
    }
  }
  if (OTPCODE !== String(need(sessionStore.get(req, 'SessionOTP')))) {
    return res.json('error^You have entered wrong OTP.');
  }
  const Plid = Math.trunc(Number(req.user.plid));
  const rows = await proc(DB, 'usp_update_btc_profile', { plid: Plid, btcaddress });
  const ResultOutput = rows.length && rows[0].intresult !== undefined && rows[0].intresult !== null ? String(rows[0].intresult) : null;
  if (ResultOutput === null) throw NPE();
  res.json(ResultOutput);
}));

// auth (legacy had no session check but dereferenced Session["plid"])
router.all(`${P}/AvailableCoinWallet{/:id}`, auth, asyncHandler(async (req, res) => {
  const Plid = Math.trunc(Number(req.user.plid));
  const rows = await proc(DB, 'usp_getavailablecoinwallet', { regno: Plid });
  if (!rows.length) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.');
  const r = rows[0];
  res.json(r[Object.keys(r)[0]]);
}));

// auth (legacy had no session check but dereferenced Session["Plid"])
router.all(`${P}/GetDeductions{/:id}`, auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const WithdrawalAmount = Number(req.p.WithdrawalAmount);
  const row = await queryOne(DB, 'select * from fun_getfinalwithdrawalamount(@plid, @amt) limit 1', { plid: Plid, amt: WithdrawalAmount });
  res.json(mapRow(row, DEDUCTION_PROPS));
}));

module.exports = router;
