'use strict';
/** Port of Member/Controllers/CustomerPanel/ShoppingWallet_M_M.cs (ShoppingWallet_M_MController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');
const Centralize_OTP = require('../../lib/member/Centralize_OTP');

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
async function isVerify(Plid) {
  const r = await queryOne(DB, 'select isverify from member_login where regno=@plid', { plid: Plid });
  return r ? !!r.isverify : false; // SqlQuery<bool>().FirstOrDefault()
}

// route-config: referral/9P1ssmoPPRy7o2vMTMG5R3I7g== -> Index
// auth ([SessionExpireCheck])
router.all(['/member/ShoppingWallet_M_M/Index{/:id}', '/member/referral/9P1ssmoPPRy7o2vMTMG5R3I7g=='], auth, asyncHandler(async (req, res) => {
  const ViewBag = { status: 0 };
  sessionStore.set(req, 'SessionOTP', null);
  const Plid = Math.trunc(Number(req.user.plid));
  ViewBag.IsActive = await isVerify(Plid);
  res.json({ view: '~/Views/CustomerPanel/ShoppingWallet_M_M/Index.cshtml', ViewBag });
}));

// auth ([SessionExpireCheck])
router.all('/member/ShoppingWallet_M_M/TransferFundtoUser{/:id}', auth, asyncHandler(async (req, res) => {
  const PaymentMode = Math.trunc(reqNum('PaymentMode', req.p.PaymentMode));
  const Username = req.p.Username;
  const Amount = reqNum('Amount', req.p.Amount);
  const Password = req.p.Password;
  const GAKEY = req.p.GAKEY;
  const Remark = req.p.Remark;
  const OTPCODE = req.p.OTPCODE;
  const hfauthenticated = req.p.hfauthenticated;

  const Plid = Math.trunc(Number(req.user.plid));
  const IsSecuritySuccess = await Centralize_OTP.CheckSecurityForTransctiion(PaymentMode, Username, Password, OTPCODE, hfauthenticated, GAKEY, Amount, req);
  if (IsSecuritySuccess !== 'success') return res.json(IsSecuritySuccess);

  let JsonReply = '';
  const mode = 11;
  try {
    // PORT-NOTE: SQL Server '=' is case-insensitive; the lookup compares lower-cased values to keep that behaviour.
    const ToUserDetails = await queryOne(DB, 'SELECT plid,username,phone,emailid FROM portal_login WHERE lower(username)=lower(@username) LIMIT 1', { username: Username.trim() });
    if (!ToUserDetails) {
      JsonReply = 'Failure^Username is incorrect. Please try again.';
      return res.json(JsonReply);
    }
    // PORT-NOTE: @StrResult / @TotalCount OUT params are returned as columns of the result row.
    const spRows = await proc(DB, 'usp_transferfundtouser', { mode, tmfthid: '0', plid: Plid, toplid: ToUserDetails.plid, amount: Amount, remark: Remark });
    const strResult = outCol(spRows, 'strresult');
    JsonReply = strResult;
    if (strResult.toLowerCase() !== 'success') {
      JsonReply = 'Error^' + strResult;
      return res.json(JsonReply);
    }
    const MemberDetails = await queryOne(DB, 'SELECT regno,username,mobile,emailid FROM member_master WHERE regno=@plid LIMIT 1', { plid: Plid });
    const Frommsg = await queryOne(DB, 'SELECT sms_content,smscategory,sms_send_status FROM tbl_smsaction WHERE id=1060 LIMIT 1');
    const Tomsg = await queryOne(DB, 'SELECT sms_content,smscategory,sms_send_status FROM tbl_smsaction WHERE id=1061 LIMIT 1');
    const Frommessg = await UtilityClass.FindingSmsContentWithUserIdPassword(MemberDetails.username, Frommsg.sms_content, '', '', 51, '', ToUserDetails.username, 0, Amount, Plid);
    const Tomessg = await UtilityClass.FindingSmsContentWithUserIdPassword(MemberDetails.username, Tomsg.sms_content, '', '', 50, '', ToUserDetails.username, Amount, 0, 0, ToUserDetails.plid);

    const Fromemailmsg = await queryOne(DB, 'SELECT email_content,email_subject,email_send_status FROM tbl_emailaction WHERE eid=1055 LIMIT 1');
    const DynamicMsgForDebit = await UtilityClass.FindingEmailContentWithUserIdPassword(ToUserDetails.username, Fromemailmsg.email_content, MemberDetails.emailid, '', 52, '', '', Plid, 0, '', '', 0, Amount, 0);
    const ToCreditemailmsg = await queryOne(DB, 'SELECT email_content,email_subject,email_send_status FROM tbl_emailaction WHERE eid=1054 LIMIT 1');
    const DynamicMsgForCredit = await UtilityClass.FindingEmailContentWithUserIdPassword('', ToCreditemailmsg.email_content, MemberDetails.emailid, '', 53, '', '', 0, 0, '', '', ToUserDetails.plid, 0, Amount);

    // For Debit Sms
    if (Frommsg.smscategory === 'Transfer') {
      if (Frommsg.sms_send_status === 1) fire(() => UtilityClass.SendSMSWithAPI(MemberDetails.mobile, Frommessg, '1'));
    }
    // Credit Sms
    if (Tomsg.smscategory === 'Transfer') {
      if (Tomsg.sms_send_status === 1) fire(() => UtilityClass.SendSMSWithAPI(ToUserDetails.phone, Tomessg, '1'));
    }
    // For Debit Member
    if (Fromemailmsg.email_send_status === 1) {
      const to = MemberDetails.emailid.toLowerCase();
      fire(() => UtilityClass.SendEmailByApiSetting(MemberDetails.username, '', '', '', '', '', to, Fromemailmsg.email_subject, DynamicMsgForDebit, null));
    }
    // For Credit Member
    if (ToCreditemailmsg.email_send_status === 1) {
      const to = ToUserDetails.emailid.toLowerCase();
      fire(() => UtilityClass.SendEmailByApiSetting(MemberDetails.username, '', '', '', '', '', to, ToCreditemailmsg.email_subject, DynamicMsgForCredit, null));
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
router.all('/member/ShoppingWallet_M_M/CheckCheckboxOnTheBehalfOfPermission{/:id}', asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_getdataforregistration', { mode: 1 });
  res.json(mapRows(rows, CHECKBOX_PROPS));
}));

// auth
router.all('/member/ShoppingWallet_M_M/CheckTranspasswordOnOrOff{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const result = await isVerify(Plid);
  res.json(result);
}));

module.exports = router;
