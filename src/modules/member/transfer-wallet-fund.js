'use strict';
/** Port of Member/Controllers/CustomerPanel/Transfer_Wallet_Fund.cs (Transfer_Wallet_FundController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');
const Centralize_OTP = require('../../lib/member/Centralize_OTP');
const Security_Key = require('../../lib/member/Security_Key');
const DAL_RegistrationOrLogin = require('../../lib/member/DAL_RegistrationOrLogin');

const router = express.Router();
const DB = 'affiliate';

const CHECKBOX_PROPS = ['FID', 'Status', 'VALIDATIONACTIVE', 'ACTIVE', 'FIELDNAME'];
const fire = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e.message)); }; // System.Threading.Thread replacement
const outCol = (rows, name) => { const f = Array.isArray(rows) ? rows[0] : rows; if (!f) return ''; const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined || f[k] === null ? '' : String(f[k]); };
const reqNum = (name, v) => {
  const n = Number(v);
  if (v === undefined || v === null || String(v).trim() === '' || Number.isNaN(n)) {
    const e = new Error(`The parameters dictionary contains a null or invalid entry for parameter '${name}'.`);
    e.status = 400;
    throw e;
  }
  return n;
};

/** Legacy public helper EwalletType(): ViewBag.ewallet = usp_TypeofWallet @Mode=2 (first column of first row). */
async function EwalletType() {
  const rows = await proc(DB, 'usp_typeofwallet', { mode: 2 });
  const r = rows && rows[0];
  return r ? (Object.values(r)[0] === undefined ? null : Object.values(r)[0]) : null;
}

async function isVerify(Plid) {
  const r = await queryOne(DB, 'select isverify from member_login where regno=@plid', { plid: Plid });
  return r ? !!r.isverify : false; // SqlQuery<bool>().FirstOrDefault()
}

// route-config: referral/GCFE2Ctopd_slash_3cDJR_slash_Xgn0y1Ve6jZCUaV -> Index
// auth ([SessionExpireCheck])
router.all(['/member/Transfer_Wallet_Fund/Index{/:id}', '/member/referral/GCFE2Ctopd_slash_3cDJR_slash_Xgn0y1Ve6jZCUaV'], auth, asyncHandler(async (req, res) => {
  const ViewBag = { status: 0 };
  sessionStore.set(req, 'SessionOTP', null);
  ViewBag.ewallet = await EwalletType();
  const Plid = Math.trunc(Number(req.user.plid));
  ViewBag.IsActive = await isVerify(Plid);
  res.json({ view: '~/Views/CustomerPanel/Transfer_Wallet_Fund/Index.cshtml', ViewBag });
}));

// auth (legacy had no session check but it writes the per-user session OTP)
router.all('/member/Transfer_Wallet_Fund/coinIndex{/:id}', auth, asyncHandler(async (req, res) => {
  const ViewBag = { status: 0 };
  sessionStore.set(req, 'SessionOTP', null);
  ViewBag.ewallet = await EwalletType();
  res.json({ view: '~/Views/CustomerPanel/Transfer_Coin_Wallet_Fund/Index.cshtml', ViewBag });
}));

// auth
router.all('/member/Transfer_Wallet_Fund/GetOTPDetails{/:id}', auth, asyncHandler(async (req, res) => {
  const smsId = Math.trunc(reqNum('smsId', req.p.smsId));
  const emailEId = Math.trunc(reqNum('emailEId', req.p.emailEId));
  const TransPass = req.p.TransPass;
  // Centralize_OTP (member lib) reads Session["plid"] from req.user and Session["SessionOTP"] from utils/sessionStore itself
  const returnmessage = await Centralize_OTP.GenrateOTP(smsId, emailEId, TransPass, req);
  res.json(returnmessage);
}));

// auth ([SessionExpireCheck])
router.all('/member/Transfer_Wallet_Fund/TransferFundtoUser{/:id}', auth, asyncHandler(async (req, res) => {
  const PaymentMode = Math.trunc(reqNum('PaymentMode', req.p.PaymentMode));
  const Username = req.p.Username;
  const Amount = reqNum('Amount', req.p.Amount);
  const Password = req.p.Password;
  const GAKEY = req.p.GAKEY;
  const Remark = req.p.Remark;
  const OTPCODE = req.p.OTPCODE;
  const hfauthenticated = req.p.hfauthenticated;

  const IsSecuritySuccess = await Centralize_OTP.CheckSecurityForTransctiion(PaymentMode, Username, Password, OTPCODE, hfauthenticated, GAKEY, Amount, req);
  if (IsSecuritySuccess !== 'success') return res.json(IsSecuritySuccess);

  const Plid = Math.trunc(Number(req.user.plid));
  let JsonReply = '';
  let mode = 0;
  if (PaymentMode === 12) mode = 2; // Coin Wallet Transfer
  if (PaymentMode === 14) mode = 1; // INR/(I) Wallet Transfer
  if (mode === 0) {
    JsonReply = 'Invalid^Please select payment mode.';
    return res.json(JsonReply);
  }
  try {
    const objs = await new Security_Key().Get_Security_Key(Plid);
    if (objs !== null && objs !== undefined) {
      const ActiveKey = objs.Status;
      const ValidRandomNo = await DAL_RegistrationOrLogin.CheckRandomNo(Math.trunc(Number(req.user.plid)));
      if (ActiveKey === 1) {
        if (!(await objs.Check_GaKey(Plid, ValidRandomNo, GAKEY))) {
          JsonReply = 'Error^Please enter the valid GA key !';
          return res.json(JsonReply);
        }
      }
    }
    // PORT-NOTE: SQL Server '=' is case-insensitive; the lookup compares lower-cased values to keep that behaviour.
    const ToUserDetails = await queryOne(DB, 'SELECT regno,username,mobile,emailid FROM member_master WHERE lower(username)=lower(@username) LIMIT 1', { username: Username.trim() });
    if (!ToUserDetails) {
      JsonReply = 'Failure^Username is incorrect. Please try again.';
      return res.json(JsonReply);
    }
    // PORT-NOTE: @StrResult / @TotalCount OUT params are returned as columns of the result row.
    const spRows = await proc(DB, 'usp_transferfundtouser', {
      mode, tmfthid: '0', plid: Plid, toplid: ToUserDetails.regno, amount: Amount, remark: Remark, fromdate: '', todate: '', startrowindex: '1', maxrows: '100',
    });
    const strResult = outCol(spRows, 'strresult');
    JsonReply = strResult;
    if (strResult.toLowerCase() !== 'success') {
      JsonReply = 'Error^' + strResult;
      return res.json(JsonReply);
    }
    const MemberDetails = await queryOne(DB, 'SELECT regno,username,mobile,emailid FROM member_master WHERE regno=@plid LIMIT 1', { plid: Plid });
    const Frommsg = await queryOne(DB, 'SELECT sms_content,smscategory,sms_send_status FROM tbl_smsaction WHERE id=45 LIMIT 1');
    const Tomsg = await queryOne(DB, 'SELECT sms_content,smscategory,sms_send_status FROM tbl_smsaction WHERE id=46 LIMIT 1');
    const Frommessg = await UtilityClass.FindingSmsContentWithUserIdPassword(MemberDetails.username, Frommsg.sms_content, '', '', 32, '', ToUserDetails.username, 0, Amount, Plid);
    const Tomessg = await UtilityClass.FindingSmsContentWithUserIdPassword(MemberDetails.username, Tomsg.sms_content, '', '', 33, '', ToUserDetails.username, Amount, 0, 0, ToUserDetails.regno);

    const emailmsg = await queryOne(DB, 'SELECT email_content,email_subject,email_send_status FROM tbl_emailaction WHERE eid=42 LIMIT 1');
    const DynamicMsgForDebit = await UtilityClass.FindingEmailContentWithUserIdPassword('', emailmsg.email_content, MemberDetails.emailid, '', 35, '', '', Plid, 0, '', '', 0, Amount, 0);
    const Creditemailmsg = await queryOne(DB, 'SELECT email_content,email_subject,email_send_status FROM tbl_emailaction WHERE eid=43 LIMIT 1');
    const DynamicMsgForCredit = await UtilityClass.FindingEmailContentWithUserIdPassword('', Creditemailmsg.email_content, MemberDetails.emailid, '', 36, '', '', 0, 0, '', '', ToUserDetails.regno, 0, Amount);

    // For Debit Sms
    if (Frommsg.smscategory === 'Transfer') {
      if (Frommsg.sms_send_status === 1) fire(() => UtilityClass.SendSMSWithAPI(MemberDetails.mobile, Frommessg, '1'));
    }
    // Credit Sms
    if (Tomsg.smscategory === 'Transfer') {
      if (Tomsg.sms_send_status === 1) fire(() => UtilityClass.SendSMSWithAPI(ToUserDetails.mobile, Tomessg, '1'));
    }
    // For Debit Member
    if (emailmsg.email_send_status === 1) {
      const to = MemberDetails.emailid.toLowerCase();
      fire(() => UtilityClass.SendEmailByApiSetting(MemberDetails.username, '', '', '', '', '', to, emailmsg.email_subject, DynamicMsgForDebit, null));
    }
    // For Credit Member (legacy sends it to the credit member's address)
    if (Creditemailmsg.email_send_status === 1) {
      const to = ToUserDetails.emailid.toLowerCase();
      fire(() => UtilityClass.SendEmailByApiSetting(MemberDetails.username, '', '', '', '', '', to, Creditemailmsg.email_subject, DynamicMsgForCredit, null));
    }
    JsonReply = strResult + '^Fund transferred successfully.';
    sessionStore.set(req, 'SessionOTP', null); // Session["SessionOTP"] = null; Session.Remove("SessionOTP")
    return res.json(JsonReply);
  } catch (ExpObj) {
    await new DataUtility().ErrorInsert(0, ExpObj.message, 'Usp_TransferFundToUser', 0, req.originalUrl.split('?')[0]);
    return res.json('Error^Some error occured. Please try again.');
  }
}));

// public (registration field configuration only; legacy had no session check)
router.all('/member/Transfer_Wallet_Fund/CheckCheckboxOnTheBehalfOfPermission{/:id}', asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_getdataforregistration', { mode: 1 });
  res.json(mapRows(rows, CHECKBOX_PROPS));
}));

// auth
router.all('/member/Transfer_Wallet_Fund/CheckTranspasswordOnOrOff{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const result = await isVerify(Plid);
  res.json(result);
}));

module.exports = router;
