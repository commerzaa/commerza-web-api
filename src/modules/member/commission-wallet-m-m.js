'use strict';
// Ported from Member/Controllers/CustomerPanel/CommissionWallet_M_M.cs  (DB: affiliate)
const express = require('express');
const router = express.Router();
const { proc, procOne, queryOne, scalar } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const Centralize_OTP = require('../../lib/member/Centralize_OTP');
const DataUtility = require('../../lib/member/DataUtility');

const DB = 'affiliate';
const GetPermittedCheckBoxForCheckAddNew = ['FID', 'Status', 'VALIDATIONACTIVE', 'ACTIVE', 'FIELDNAME'];

// Session adapter for Centralize_OTP (session.plid = { Plid }, session.SessionOTP) backed by the JWT + sessionStore
async function withSession(req, fn) {
  const session = { plid: { Plid: Number(req.user.plid) }, SessionOTP: sessionStore.get(req, 'SessionOTP') };
  try { return await fn(session); } finally { sessionStore.set(req, 'SessionOTP', session.SessionOTP); }
}
const bg = (p) => { Promise.resolve(p).catch((e) => console.error('background task failed', e && e.message)); };

// auth ([SessionExpireCheck]). route-config: url "referral/GCFE2Ctopd_slash_3cDJR_slashCommission_NARGXgn0y1Ve6jZCUaV"
router.all(['/member/CommissionWallet_M_M/Index{/:id}', '/member/CommissionWallet_M_M', '/member/referral/GCFE2Ctopd_slash_3cDJR_slashCommission_NARGXgn0y1Ve6jZCUaV'], auth, asyncHandler(async (req, res) => {
  const ViewBag = { status: 0 };
  sessionStore.set(req, 'SessionOTP', null);
  const Plid = Math.trunc(Number(req.user.plid));
  const v = await scalar(DB, 'select IsVerify from MEMBER_LOGIN where REGNO = @Plid limit 1', { Plid });
  ViewBag.IsActive = v === true || v === 1 || v === '1';
  res.json({ View: '~/Views/CustomerPanel/CommissionWallet_M_M/Index.cshtml', ViewBag });
}));

// auth (legacy had no attribute but Centralize_OTP reads Session["plid"])
router.all('/member/CommissionWallet_M_M/GetOTPDetails{/:id}', auth, asyncHandler(async (req, res) => {
  const { smsId, emailEId, TransPass } = req.p;
  const returnmessage = await withSession(req, (session) => Centralize_OTP.GenrateOTP(parseInt(smsId, 10), parseInt(emailEId, 10), TransPass, session));
  res.json(returnmessage);
}));

// auth ([SessionExpireCheck])
router.all('/member/CommissionWallet_M_M/TransferFundtoUser{/:id}', auth, asyncHandler(async (req, res) => {
  const { PaymentMode, Username, Password, GAKEY, Remark, OTPCODE, hfauthenticated } = req.p;
  const Amount = Number(req.p.Amount);
  const Plid = Number(req.user.plid);
  const IsSecuritySuccess = await withSession(req, (session) => Centralize_OTP.CheckSecurityForTransctiion(parseInt(PaymentMode, 10), Username, Password, OTPCODE, hfauthenticated, GAKEY, Amount, session));
  if (IsSecuritySuccess !== 'success') {
    return res.json(IsSecuritySuccess);
  }

  let JsonReply = '';
  const mode = 14;
  try {
    const ToUserDetails = await queryOne(DB, 'select * from portal_login where username = @u limit 1', { u: Username.trim() });
    if (ToUserDetails == null) {
      JsonReply = 'Failure^Username is incorrect. Please try again.';
      return res.json(JsonReply);
    }
    const out = await procOne(DB, 'usp_transferfundtouser', {
      mode, tmfthid: '0', plid: Plid, toplid: ToUserDetails.plid, amount: Amount, remark: Remark,
    });
    const StrResult = out && out.strresult != null ? String(out.strresult) : '';
    JsonReply = StrResult;
    if (StrResult.toLowerCase() !== 'success') {
      JsonReply = 'Error^' + StrResult;
      return res.json(JsonReply);
    }
    const MemberDetails = await queryOne(DB, 'select * from member_master where regno = @Plid limit 1', { Plid });
    const Frommsg = await queryOne(DB, 'select * from tbl_smsaction where id = 45 limit 1');
    const Tomsg = await queryOne(DB, 'select * from tbl_smsaction where id = 46 limit 1');
    const Frommessg = await UtilityClass.FindingSmsContentWithUserIdPassword(MemberDetails.username, Frommsg.sms_content, '', '', 44, '', ToUserDetails.username, 0, Amount, Plid);
    const Tomessg = await UtilityClass.FindingSmsContentWithUserIdPassword(MemberDetails.username, Tomsg.sms_content, '', '', 45, '', ToUserDetails.username, Amount, 0, 0, ToUserDetails.plid);

    const emailmsg = await queryOne(DB, 'select * from tbl_emailaction where eid = 42 limit 1');
    const DynamicMsgForDebit = await UtilityClass.FindingEmailContentWithUserIdPassword('', emailmsg.email_content, MemberDetails.emailid, '', 47, '', '', Plid, 0, '', '', 0, Amount, 0);
    const Creditemailmsg = await queryOne(DB, 'select * from tbl_emailaction where eid = 43 limit 1');
    const DynamicMsgForCredit = await UtilityClass.FindingEmailContentWithUserIdPassword('', Creditemailmsg.email_content, MemberDetails.emailid, '', 48, '', '', 0, 0, '', '', ToUserDetails.plid, 0, Amount);

    // For Debit Sms
    if (Frommsg.smscategory === 'Transfer') {
      if (Frommsg.sms_send_status === 1) bg(UtilityClass.SendSMSWithAPI(MemberDetails.mobile, Frommessg, '1'));
    }
    // Credit Sms
    if (Tomsg.smscategory === 'Transfer') {
      if (Tomsg.sms_send_status === 1) bg(UtilityClass.SendSMSWithAPI(ToUserDetails.phone, Tomessg, '1'));
    }
    // For Debit Member
    if (emailmsg.email_send_status === 1) {
      bg(UtilityClass.SendEmailByApiSetting(MemberDetails.username, '', '', '', '', '', MemberDetails.emailid.toLowerCase(), emailmsg.email_subject, DynamicMsgForDebit, null));
    }
    // For Credit Member
    if (Creditemailmsg.email_send_status === 1) {
      bg(UtilityClass.SendEmailByApiSetting(MemberDetails.username, '', '', '', '', '', ToUserDetails.emailid.toLowerCase(), Creditemailmsg.email_subject, DynamicMsgForCredit, null));
    }

    JsonReply = StrResult + '^Fund transferred successfully.';
    sessionStore.set(req, 'SessionOTP', null);
    return res.json(JsonReply);
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'Usp_TransferFundToUser', 0, req.path); } catch (_) { /* ignore */ }
    return res.json('Error^Some error occured. Please try again.');
  }
}));

// public (legacy had no session check; registration configuration data)
router.all('/member/CommissionWallet_M_M/CheckCheckboxOnTheBehalfOfPermission{/:id}', asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_getdataforregistration', { mode: 1 });
  res.json(mapRows(rows, GetPermittedCheckBoxForCheckAddNew));
}));

// auth
router.all('/member/CommissionWallet_M_M/CheckTranspasswordOnOrOff{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const v = await scalar(DB, 'select IsVerify from MEMBER_LOGIN where REGNO = @Plid limit 1', { Plid });
  res.json(v === true || v === 1 || v === '1');
}));

module.exports = router;
