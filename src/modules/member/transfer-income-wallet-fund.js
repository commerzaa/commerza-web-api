'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Transfer_Income_Wallet_Fund.cs (Transfer_Income_Wallet_FundController)
 *  - 5 actions: Index, coinIndex, GenerateOTP, TransferFundtoUser, CheckCheckboxOnTheBehalfOfPermission */
const express = require('express');
const { queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const config = require('../../config');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');
const Security_Key = require('../../lib/member/Security_Key');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Transfer_Income_Wallet_Fund';
const outv = (rows, name) => { const r = rows && rows[0]; if (!r) return undefined; const k = Object.keys(r).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e)); };
const PERMITTED_PROPS = ['FID', 'Status', 'VALIDATIONACTIVE', 'ACTIVE', 'FIELDNAME'];
const reqInt = (v, name) => {
  const n = Number(v);
  if (v === undefined || v === null || String(v).trim() === '' || !Number.isInteger(n)) throw new Error(`The parameters dictionary contains a null or invalid entry for parameter '${name}' of non-nullable type 'System.Int32'.`);
  return n;
};
const reqDec = (v, name) => {
  const n = Number(String(v === undefined || v === null ? '' : v).trim());
  if (v === undefined || v === null || String(v).trim() === '' || Number.isNaN(n)) throw new Error(`The parameters dictionary contains a null or invalid entry for parameter '${name}' of non-nullable type 'System.Decimal'.`);
  return n;
};

// route-config: referral/GCFE2Ctopd90d6GCcuTYBGm8AmPpz_plus_qwZMGjT0msPmo=
// auth ([SessionExpireCheck])
router.all([`${P}/Index{/:id}`, '/member/referral/GCFE2Ctopd90d6GCcuTYBGm8AmPpz_plus_qwZMGjT0msPmo='], auth, asyncHandler(async (req, res) => {
  sessionStore.set(req, 'SessionOTP', null);
  res.json({ status: 0 }); // ViewBag.status
}));

// public (no session check in legacy)
router.all(`${P}/coinIndex{/:id}`, asyncHandler(async (req, res) => {
  sessionStore.set(req, 'SessionOTP', null);
  res.json({ status: 0 }); // ViewBag.status
}));

// auth (uses Session["plid"])
router.all(`${P}/GenerateOTP{/:id}`, auth, asyncHandler(async (req, res) => {
  let TransPass = req.p.TransPass;
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0;
  let Emailstatus = 0;
  sessionStore.set(req, 'SessionOTP', OTP);
  const Plid = Number(req.user.plid);
  const msg = await queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id = 17 limit 1');
  Mobilestatus = msg.sms_send_status; // msg null => TypeError (legacy NullReferenceException)
  const emailmsg = await queryOne(DB, 'select email_content, email_send_status from tbl_emailaction where eid = 14 limit 1');
  Emailstatus = emailmsg.email_send_status;
  const PLDetails = await queryOne(DB, 'select phone, emailid, username, tpassword from portal_login where plid = @plid limit 1', { plid: Plid });
  if (PLDetails != null) {
    // legacy condition (PHONE != null || PHONE != "") is always true
    const Userid = '';
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
    TransPass = await UtilityClass.Encryptword(TransPass);
    if (TransPass === PLDetails.tpassword) {
      if (Mobilestatus === 1) {
        bg(() => UtilityClass.SendSMSWithAPI(PLDetails.phone, messg, '1'));
      }
      if (Emailstatus === 1) {
        bg(() => UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Member Topup', Emailmsg, null, '', ''));
      }
      returnmessage = 'OTP SENT';
    } else {
      returnmessage = 'Invalid Transaction Password!!';
    }
  }
  if (Mobilestatus === 0 && Emailstatus === 0) {
    returnmessage = 'OTP BYPASS';
  }
  res.json(returnmessage);
}));

// auth ([SessionExpireCheck])
// PORT-NOTE: OUT parameters @StrResult / @TotalCount of Usp_TransferFundToUser are read from the "strresult" / "totalcount" columns of the first result row.
router.all(`${P}/TransferFundtoUser{/:id}`, auth, asyncHandler(async (req, res) => {
  const PaymentMode = reqInt(req.p.PaymentMode, 'PaymentMode');
  const Username = req.p.Username;
  const Amount = reqDec(req.p.Amount, 'Amount');
  let Password = req.p.Password;
  const GAKEY = req.p.GAKEY;
  const Remark = req.p.Remark;
  const OTPCODE = req.p.OTPCODE;
  let hfauthenticated = req.p.hfauthenticated;
  if (Password == null || Password === '') {
    Password = 'user@123';
  }
  const Plid = Number(req.user.plid);
  if (hfauthenticated == null) {
    hfauthenticated = '0';
  }
  {
    const msg = await queryOne(DB, 'select sms_send_status from tbl_smsaction where id = 17 limit 1');
    const emailmsg = await queryOne(DB, 'select email_send_status from tbl_emailaction where eid = 14 limit 1');
    if (msg.sms_send_status === 0 && emailmsg.email_send_status === 0) {
      if (config.app.MasterCode === OTPCODE) {
        sessionStore.set(req, 'SessionOTP', OTPCODE);
      }
    }
  }
  if (OTPCODE !== sessionStore.get(req, 'SessionOTP').toString()) {
    return res.json('error^You have entered wrong OTP.');
  }
  // ******Generate and validate OTP Code here start********
  if (OTPCODE !== sessionStore.get(req, 'SessionOTP').toString()) {
    return res.json('error^You have entered wrong OTP.');
  } else if ((OTPCODE === sessionStore.get(req, 'SessionOTP').toString()) && hfauthenticated === '1') {
    if (GAKEY === '') {
      return res.json('GAKey');
    }
  }
  let JsonReply = '';
  let mode = 0;
  if (PaymentMode === 12) {
    mode = 6; // This mode is for Coin Wallet Transfer
  }
  if (PaymentMode === 14) {
    mode = 1; // This mode is for INR/(I) Wallet Transfer
  }
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
    {
      const PL = await queryOne(DB, 'select plid from portal_login where trim(tpassword) = trim(@pwd) and plid = @plid limit 1', { pwd: Password, plid: Plid });
      if (PL == null) {
        JsonReply = 'Invalid^Wrong Transaction Password.Please try again.';
        return res.json(JsonReply);
      }
    }
    const objs = await new Security_Key().Get_Security_Key(Plid);
    if (objs != null) {
      if (!(await objs.Check_GaKey(Plid, GAKEY))) {
        JsonReply = 'Error^Please enter the valid GA key !';
        return res.json(JsonReply);
      }
    }
    const ToUserDetails = await queryOne(DB, 'select plid from portal_login where username = @u limit 1', { u: Username.trim() });
    if (ToUserDetails == null) {
      JsonReply = 'Failure^Username is incorrect. Please try again.';
      return res.json(JsonReply);
    }
    const rows = await proc(DB, 'usp_transferfundtouser', {
      mode, tmfthid: '0', plid: Plid, toplid: ToUserDetails.plid, amount: Amount, remark: Remark,
      fromdate: '', todate: '', startrowindex: '1', maxrows: '100',
    });
    const StrResult = outv(rows, 'strresult');
    JsonReply = StrResult === undefined || StrResult === null ? null : String(StrResult);
    if (JsonReply === null) throw new TypeError('Object reference not set to an instance of an object.');
    if (JsonReply.toLowerCase() !== 'success') {
      JsonReply = 'Error^' + JsonReply;
      return res.json(JsonReply);
    }
    JsonReply = JsonReply + '^Fund transferred successfully.';
    sessionStore.set(req, 'SessionOTP', null);
    return res.json(JsonReply);
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'Usp_TransferFundToUser', 0, req.path); } catch (_) { /* ignore */ }
    return res.json('Error^Some error occured. Please try again.');
  }
}));

// public (no session access)
router.all(`${P}/CheckCheckboxOnTheBehalfOfPermission{/:id}`, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_getdataforregistration', { mode: 1 });
  res.json(mapRows(rows, PERMITTED_PROPS));
}));

module.exports = router;
