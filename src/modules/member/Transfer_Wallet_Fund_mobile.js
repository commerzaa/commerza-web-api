'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Transfer_Wallet_Fund_mobile.cs (Transfer_Wallet_Fund_mobileController) */
const express = require('express');
const config = require('../../config');
const { queryOne, scalar, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth, optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');
const Security_Key = require('../../lib/member/Security_Key');
const DAL_RegistrationOrLogin = require('../../lib/member/DAL_RegistrationOrLogin');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Transfer_Wallet_Fund_mobile';
const PERMIT_PROPS = ['FID', 'Status', 'VALIDATIONACTIVE', 'ACTIVE', 'FIELDNAME'];
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const NPE = () => new Error('Object reference not set to an instance of an object.');
const need = (o) => { if (o === null || o === undefined) throw NPE(); return o; };
// replaces `new Thread(delegate { ... }).Start()` (fire and forget)
const fire = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e.message)); };
const truthy = (v) => v === true || Number(v) === 1;
const masterCode = () => (config.app && config.app.MasterCode !== undefined ? config.app.MasterCode : (process.env.MASTER_CODE === undefined ? null : process.env.MASTER_CODE));

// auth ([SessionExpireCheck])
// route-config: "referral/Transfer-Wallet-Fund-mobile" -> Transfer_Wallet_Fund_mobile/Index
router.all([`${P}/Index{/:id}`, P, '/member/referral/Transfer-Wallet-Fund-mobile'], auth, asyncHandler(async (req, res) => {
  const ViewBag = { status: 0 };
  sessionStore.set(req, 'SessionOTP', null);
  const Plid = Math.trunc(Number(req.user.plid));
  const r = await queryOne(DB, 'select isverify from member_login where regno = @plid limit 1', { plid: Plid });
  ViewBag.IsActive = r ? truthy(r.isverify) : false;
  res.json({ ViewBag });
}));

// public (no session check in legacy; only resets the OTP)
router.all(`${P}/coinIndex{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  sessionStore.set(req, 'SessionOTP', null);
  res.json({ ViewBag: { status: 0 } });
}));

// (GenerateOTP(long Plid) and ResendOTP are commented out in the legacy controller)

// auth (legacy had no session check but dereferenced Session["plid"])
router.all(`${P}/GenerateOTP{/:id}`, auth, asyncHandler(async (req, res) => {
  let TransPass = req.p.TransPass;
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0;
  let Emailstatus = 0;
  sessionStore.set(req, 'SessionOTP', OTP);
  const Plid = Math.trunc(Number(req.user.plid));
  const msg = await queryOne(DB, 'select * from tbl_smsaction where id = 17 limit 1', {});
  Mobilestatus = Number(need(msg).sms_send_status);

  const emailmsg = await queryOne(DB, 'select * from tbl_emailaction where eid = 14 limit 1', {});
  Emailstatus = Number(need(emailmsg).email_send_status);

  const PLDetails = await queryOne(DB, 'select * from portal_login where plid = @plid limit 1', { plid: Plid });
  if (PLDetails != null) {
    // legacy condition `PHONE != null || PHONE != ""` is always true
    const membersmsactive = Number(await scalar(DB, 'select 1 from tbl_memberauthentication where issms::int = 1 and status::int = 1 and regno = @r limit 1', { r: Plid })) || 0;
    const memberemailactive = Number(await scalar(DB, 'select 1 from tbl_memberauthentication where isemail::int = 1 and status::int = 1 and regno = @r limit 1', { r: Plid })) || 0;
    const Userid = '';
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
    TransPass = await UtilityClass.Encryptword(TransPass);
    if (TransPass === PLDetails.tpassword) {
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
    } else {
      returnmessage = 'Invalid Transaction Password!!';
    }
  }
  if (Mobilestatus === 0 && Emailstatus === 0) returnmessage = 'OTP BYPASS';
  res.json(returnmessage);
}));

// auth ([SessionExpireCheck])
router.all(`${P}/TransferFundtoUser{/:id}`, auth, asyncHandler(async (req, res) => {
  const PaymentMode = toInt(req.p.PaymentMode);
  let { Username, Password, GAKEY, Remark, OTPCODE, hfauthenticated } = req.p;
  const Amount = Number(req.p.Amount);
  const Plid = Math.trunc(Number(req.user.plid));

  if (Password == null || Password === '') {
    const tp = await scalar(DB, 'select tpassword from portal_login where plid = @plid limit 1', { plid: Plid });
    Password = await UtilityClass.Decryptword(tp === undefined ? null : tp);
  }
  if (hfauthenticated == null) hfauthenticated = '0';

  {
    const membersmsactive = Number(await scalar(DB, 'select 1 from tbl_memberauthentication where issms::int = 1 and status::int = 1 and regno = @r limit 1', { r: Plid })) || 0;
    const memberemailactive = Number(await scalar(DB, 'select 1 from tbl_memberauthentication where isemail::int = 1 and status::int = 1 and regno = @r limit 1', { r: Plid })) || 0;
    const msg = await queryOne(DB, 'select * from tbl_smsaction where id = 17 limit 1', {});
    const emailmsg = await queryOne(DB, 'select * from tbl_emailaction where eid = 14 limit 1', {});
    const MasterCode = masterCode();
    if (Number(need(msg).sms_send_status) !== 1 && membersmsactive === 1) {
      if (OTPCODE !== '') {
        if (MasterCode === OTPCODE) sessionStore.set(req, 'SessionOTP', OTPCODE);
      }
    } else if (Number(need(emailmsg).email_send_status) !== 1 && memberemailactive === 1) {
      if (OTPCODE !== '') {
        if (MasterCode === OTPCODE) sessionStore.set(req, 'SessionOTP', OTPCODE);
      }
    } else if (memberemailactive === 0 && membersmsactive === 0) {
      if (OTPCODE !== '') {
        if (MasterCode === OTPCODE) sessionStore.set(req, 'SessionOTP', OTPCODE);
      }
    }
  }
  const sessOtp = () => String(need(sessionStore.get(req, 'SessionOTP'))); // Session["SessionOTP"].ToString()
  if (OTPCODE !== sessOtp()) {
    return res.json('error^You have entered wrong OTP.');
  }
  // ******Generate and validate OTP Code here start********//
  if (OTPCODE !== sessOtp()) {
    return res.json('error^You have entered wrong OTP.');
  } else if (OTPCODE === sessOtp() && hfauthenticated === '1') {
    if (GAKEY === '') return res.json('GAKey');
  }
  let JsonReply = '';
  let mode = 0;
  if (PaymentMode === 12) mode = 2; // Coin Wallet Transfer
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
    Password = await UtilityClass.Encryptword(Password);
    const PL = await queryOne(DB, 'select plid from portal_login where trim(tpassword) = @pw and plid = @plid limit 1', { pw: String(Password).trim(), plid: Plid });
    if (PL == null) {
      JsonReply = 'Invalid^Wrong Transaction Password.Please try again.';
      return res.json(JsonReply);
    }
    let objs = new Security_Key();
    let ActiveKey = 0;
    objs = await objs.Get_Security_Key(Plid);
    if (objs != null) {
      ActiveKey = Number(objs.Status);
      const ValidRandomNo = await DAL_RegistrationOrLogin.CheckRandomNo(Plid);
      if (ActiveKey === 1) {
        if (!(await objs.Check_GaKey(Plid, ValidRandomNo, GAKEY))) {
          JsonReply = 'Error^Please enter the valid GA key !';
          return res.json(JsonReply);
        }
      }
    }
    const ToUserDetails = await queryOne(DB, 'select plid from portal_login where username = @u limit 1', { u: String(need(Username)).trim() });
    if (ToUserDetails == null) {
      JsonReply = 'Failure^Username is incorrect. Please try again.';
      return res.json(JsonReply);
    }
    // @StrResult / @TotalCount are OUTPUT parameters (read from the result row)
    const rows = await proc(DB, 'usp_transferfundtouser', {
      mode, tmfthid: 0, plid: Plid, toplid: ToUserDetails.plid, amount: Amount, remark: Remark,
      fromdate: '', todate: '', startrowindex: 1, maxrows: 100,
    });
    const StrResult = rows.length && rows[0].strresult !== undefined ? rows[0].strresult : null;
    JsonReply = String(need(StrResult));
    if (JsonReply.toLowerCase() !== 'success') {
      JsonReply = 'Error^' + String(StrResult);
      return res.json(JsonReply);
    }
    JsonReply = String(StrResult) + '^Fund transferred successfully.';
    sessionStore.set(req, 'SessionOTP', null);
    return res.json(JsonReply);
  } catch (ExpObj) {
    console.error(ExpObj.message);
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'Usp_TransferFundToUser', 0, req.path); } catch (e) { console.error(e.message); }
    return res.json('Error^Some error occured. Please try again.');
  }
}));

// public (no session check in legacy; registration field configuration)
router.all(`${P}/CheckCheckboxOnTheBehalfOfPermission{/:id}`, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_getdataforregistration', { mode: 1 });
  res.json(mapRows(rows, PERMIT_PROPS));
}));

// auth (legacy had no session check but dereferenced the session)
router.all(`${P}/CheckTranspasswordOnOrOff{/:id}`, auth, asyncHandler(async (req, res) => {
  const r = await queryOne(DB, 'select isverify from member_login where regno = @plid limit 1', { plid: Number(req.user.plid) });
  res.json(r ? truthy(r.isverify) : false);
}));

module.exports = router;
