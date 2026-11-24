'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/Transfer_Commission_Wallet_Fund_mobile.cs  (Transfer_Commission_Wallet_Fund_mobileController, 5 actions)
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
const Security_Key = require('../../lib/member/Security_Key');

const DB = 'affiliate';
const BASE = '/member/Transfer_Commission_Wallet_Fund_mobile';
const s = (v) => (v === undefined || v === null ? '' : String(v));
const NRE = () => new Error('Object reference not set to an instance of an object.');
const outv = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
// fire-and-forget replacement of `new Thread(delegate(){...}).Start()`
const fire = (fn) => { Promise.resolve().then(fn).catch(() => { /* background thread failures are not observable in the legacy app */ }); };
// SqlQuery<int>("SELECT 1 ...").FirstOrDefault()  => 1 or 0
const flag = async (sql, p) => { const r = await queryOne(DB, sql, p); return r ? Number(r[Object.keys(r)[0]]) : 0; };
const AUTH_SMS = 'SELECT 1 FROM tbl_memberauthentication WHERE issms = 1 AND status = 1 AND regno = @plid limit 1';
const AUTH_EMAIL = 'SELECT 1 FROM tbl_memberauthentication WHERE isemail = 1 AND status = 1 AND regno = @plid limit 1';
async function errInsert(req, name, e) {
  try { const DataUtility = require('../../lib/member/DataUtility'); await new DataUtility().ErrorInsert(0, e && e.message, name, 0, req.path); } catch (_) { /* ErrorInsert must never throw */ }
}
const sessionOtp = (req) => { const v = sessionStore.get(req, 'SessionOTP'); if (v === undefined || v === null) throw NRE(); return String(v); };
const masterCode = () => s(config.app.MasterCode);

// Index()  [SessionExpireCheck]
// route-config: referral/Transfer-Commission-Wallet-Fund-mobile
// auth
router.all([`${BASE}/Index{/:id}`, BASE, '/member/referral/Transfer-Commission-Wallet-Fund-mobile'], auth, asyncHandler(async (req, res) => {
  const ViewBag = { status: 0 };
  sessionStore.set(req, 'SessionOTP', null);
  const Plid = parseInt(req.user.plid, 10);
  const v = await scalar(DB, 'select isverify from member_login where regno = @plid limit 1', { plid: Plid });
  ViewBag.IsActive = v === null || v === undefined ? false : v;
  res.json({ view: '~/Views/CustomerPanel/Transfer_Commission_Wallet_Fund_mobile/Index.cshtml', ViewBag });
}));

// coinIndex(): no session check in the C#, but it resets the per-user OTP store => auth
// auth
router.all(`${BASE}/coinIndex{/:id}`, auth, asyncHandler(async (req, res) => {
  sessionStore.set(req, 'SessionOTP', null);
  res.json({ view: '~/Views/CustomerPanel/Transfer_Commission_Wallet_Fund/Index.cshtml', ViewBag: { status: 0 } });
}));

// GenerateOTP(string TransPass, decimal Amount)
// auth
router.all(`${BASE}/GenerateOTP{/:id}`, auth, asyncHandler(async (req, res) => {
  let TransPass = req.p.TransPass;
  const Amount = Number(req.p.Amount);
  if (TransPass === undefined || TransPass === null || TransPass === '') {
    TransPass = await scalar(DB, 'Select tpassword From portal_login Where plid = @plid limit 1', { plid: parseInt(req.user.plid, 10) });
  } else {
    TransPass = UtilityClass.Encryptword(TransPass);
  }
  let checkamount = 0;
  const row1 = await queryOne(DB, "select limits from settings where caption = 'MinCommissionwallettrasfer' and active = true limit 1");
  if (row1) checkamount = row1.limits;
  if (Amount < checkamount) {
    return res.json('Minimum Tranfer Amount ' + checkamount);
  }
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0;
  let Emailstatus = 0;
  sessionStore.set(req, 'SessionOTP', OTP);
  const Plid = Number(req.user.plid);
  const msg = await queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id = 17 limit 1');
  if (!msg) throw NRE();
  Mobilestatus = msg.sms_send_status;
  const emailmsg = await queryOne(DB, 'select email_content, email_send_status from tbl_emailaction where eid = 14 limit 1');
  if (!emailmsg) throw NRE();
  Emailstatus = emailmsg.email_send_status;
  const PLDetails = await queryOne(DB, 'select plid, phone, username, tpassword, emailid from portal_login where plid = @plid limit 1', { plid: Plid });
  if (PLDetails) {
    // legacy condition (PHONE != null || PHONE != "") is always true
    const Userid = '';
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
    const membersmsactive = await flag(AUTH_SMS, { plid: parseInt(req.user.plid, 10) });
    const memberemailactive = await flag(AUTH_EMAIL, { plid: parseInt(req.user.plid, 10) });
    if (TransPass === PLDetails.tpassword) {
      if (Mobilestatus === 1 && membersmsactive === 1) {
        fire(() => UtilityClass.SendSMSWithAPI(PLDetails.phone, messg, '1'));
      } else if (Emailstatus === 1 && memberemailactive === 1) {
        fire(() => UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Member Topup', Emailmsg, null, '', ''));
      } else {
        returnmessage = 'OTP BYPASS';
      }
    } else {
      returnmessage = 'Invalid Transaction Password!!';
    }
  }
  if (Mobilestatus === 0 && Emailstatus === 0) {
    returnmessage = 'OTP BYPASS';
  }
  res.json(returnmessage);
}));

// TransferFundtoUser(int PaymentMode, string Username, decimal Amount, string Password, string GAKEY, string Remark, string OTPCODE, string hfauthenticated)  [SessionExpireCheck]
// auth
router.all(`${BASE}/TransferFundtoUser{/:id}`, auth, asyncHandler(async (req, res) => {
  const PaymentMode = parseInt(req.p.PaymentMode, 10);
  if (Number.isNaN(PaymentMode)) throw new Error('Input string was not in a correct format.'); // int model binding failure
  let Username = req.p.Username;
  const Amount = Number(req.p.Amount);
  let Password = req.p.Password;
  const GAKEY = req.p.GAKEY;
  const Remark = req.p.Remark;
  const OTPCODE = req.p.OTPCODE;
  let hfauthenticated = req.p.hfauthenticated;
  const PlidInt = parseInt(req.user.plid, 10);
  if (Password === undefined || Password === null || Password === '') {
    Password = await scalar(DB, 'Select tpassword From portal_login Where plid = @plid limit 1', { plid: PlidInt });
    Password = UtilityClass.Decryptword(Password);
  }
  const Plid = Number(req.user.plid);
  if (hfauthenticated === undefined || hfauthenticated === null) hfauthenticated = '0';
  {
    const msg = await queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id = 17 limit 1');
    const emailmsg = await queryOne(DB, 'select email_content, email_send_status from tbl_emailaction where eid = 14 limit 1');
    const membersmsactive = await flag(AUTH_SMS, { plid: PlidInt });
    const memberemailactive = await flag(AUTH_EMAIL, { plid: PlidInt });
    const applyMaster = () => {
      if (OTPCODE !== '') {
        if (masterCode() === OTPCODE) sessionStore.set(req, 'SessionOTP', OTPCODE);
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
  }
  if (OTPCODE !== sessionOtp(req)) {
    return res.json('error^You have entered wrong OTP.');
  }
  // (the C# repeats the OTP check, then asks for the GA key when the user is "authenticated")
  if (OTPCODE !== sessionOtp(req)) {
    return res.json('error^You have entered wrong OTP.');
  } else if (OTPCODE === sessionOtp(req) && hfauthenticated === '1') {
    if (GAKEY === '') {
      return res.json('GAKey');
    }
  }
  let JsonReply = '';
  let mode = 0;
  if (PaymentMode === 5) mode = 9; // Shopping Wallet Transfer
  if (PaymentMode === 2) mode = 7; // Coin Wallet Transfer
  if (PaymentMode === 12) mode = 8; // Commission Wallet Transfer
  if (PaymentMode === 14) mode = 1; // INR/(I) Wallet Transfer
  if (mode === 0) {
    JsonReply = 'Invalid^Please select payment mode.';
    return res.json(JsonReply);
  }
  try {
    if (PaymentMode === 0 || Username === '' || Amount <= 0 || Password === '') {
      JsonReply = 'Invalid^Please enter the mandatory fields.';
      return res.json(JsonReply);
    }
    Password = UtilityClass.Encryptword(Password);
    const PL = await queryOne(DB, 'select plid from portal_login where trim(tpassword) = trim(@pw) and plid = @plid limit 1', { pw: Password, plid: Plid });
    if (!PL) {
      JsonReply = 'Invalid^Wrong Transaction Password.Please try again.';
      return res.json(JsonReply);
    }
    let objs = new Security_Key();
    objs = await objs.Get_Security_Key(Plid);
    if (objs) {
      if (!(await objs.Check_GaKey(Plid, GAKEY))) {
        JsonReply = 'Error^Please enter the valid GA key !';
        return res.json(JsonReply);
      }
    }
    if (Username === undefined || Username === null) throw NRE(); // Username.Trim()
    const ToUserDetails = await queryOne(DB, 'select plid from portal_login where username = @username limit 1', { username: String(Username).trim() });
    if (!ToUserDetails) {
      JsonReply = 'Failure^Username is incorrect. Please try again.';
      return res.json(JsonReply);
    }
    // PORT-NOTE: @StrResult / @TotalCount OUT are read from the columns of the single result row
    const rows = await proc(DB, 'usp_transferfundtouser', {
      mode, tmfthid: '0', plid: Plid, toplid: ToUserDetails.plid, amount: Amount, remark: Remark,
      fromdate: '', todate: '', startrowindex: '1', maxrows: '100', paymode: PaymentMode,
    });
    const strResult = s(outv(rows[0], 'strresult'));
    JsonReply = strResult;
    if (strResult.toLowerCase() !== 'success') {
      JsonReply = 'Error^' + strResult;
      return res.json(JsonReply);
    }
    JsonReply = strResult + '^Fund transferred successfully.';
    sessionStore.set(req, 'SessionOTP', null);
    return res.json(JsonReply);
  } catch (ExpObj) {
    await errInsert(req, 'Usp_TransferFundToUser', ExpObj);
    return res.json('Error^Some error occured. Please try again.');
  }
}));

// CheckTranspasswordOnOrOff()
// auth
router.all(`${BASE}/CheckTranspasswordOnOrOff{/:id}`, auth, asyncHandler(async (req, res) => {
  const v = await scalar(DB, 'select isverify from member_login where regno = @plid limit 1', { plid: req.user.plid });
  res.json(v === null || v === undefined ? false : v);
}));

module.exports = router;
