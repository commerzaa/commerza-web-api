'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/GrowthWalletM-M_Transfer.cs (GrowthWalletM_M_TransferController, 5 actions)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: "Transfer Coin Wallet Fund" -> referral/4CO1fbJYRYnhkO_slash_qiO7lLmDbz_slash_gmdhnEZMGjTCoin0msPmo (Index)
 * Every action uses Session["Plid"] (directly or inside Centralize_OTP) => auth.
 */
const express = require('express');
const { queryOne, scalar, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');
const Centralize_OTP = require('../../lib/member/Centralize_OTP');

const router = express.Router();
const DB = 'affiliate';
const C = 'GrowthWalletM_M_Transfer';

const s = (v) => (v === null || v === undefined ? '' : String(v));
const colOf = (rows, n) => { const r = Array.isArray(rows) ? rows[0] : rows; if (!r) return null; const k = Object.keys(r).find((x) => x.toLowerCase() === n.toLowerCase()); return k === undefined ? null : r[k]; };
async function errIns(req, e, proc_) {
  try { await new DataUtility().ErrorInsert(0, e && e.message, proc_, 0, req.path); } catch (_) { /* ignore */ }
}
const reqInt = (v, name) => {
  const n = parseInt(v, 10);
  if (v === undefined || v === null || v === '' || Number.isNaN(n)) throw new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Int32'.`);
  return n;
};
const reqDec = (v, name) => {
  const n = Number(v);
  if (v === undefined || v === null || v === '' || Number.isNaN(n)) throw new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Decimal'.`);
  return n;
};
const P_PERMITTED = ['FID', 'Status', 'VALIDATIONACTIVE', 'ACTIVE', 'FIELDNAME'];
const isVerify = async (plid) => { const v = await scalar(DB, 'select isverify from member_login where regno=@plid limit 1', { plid }); return v === null || v === undefined ? false : !!v; };

// ---- Index ------------------------------------------------------------------------------------------------------
// auth (SessionExpireCheck)
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/4CO1fbJYRYnhkO_slash_qiO7lLmDbz_slash_gmdhnEZMGjTCoin0msPmo'], auth, asyncHandler(async (req, res) => {
  const ViewBag = { status: 0 };
  sessionStore.set(req, 'SessionOTP', null);
  const Plid = parseInt(req.user.plid, 10);
  ViewBag.IsActive = await isVerify(Plid);
  res.json({ ViewBag });
}));

// ---- GetOTPDetails ------------------------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/GetOTPDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const smsId = reqInt(req.p.smsId, 'smsId');
  const emailEId = reqInt(req.p.emailEId, 'emailEId');
  const returnmessage = await Centralize_OTP.GenrateOTP(smsId, emailEId, req.p.TransPass, req);
  res.json(returnmessage);
}));

// ---- TransferFundtoUser ---------------------------------------------------------------------------------------------
// auth (SessionExpireCheck)
router.all(`/member/${C}/TransferFundtoUser{/:id}`, auth, asyncHandler(async (req, res) => {
  const PaymentMode = reqInt(req.p.PaymentMode, 'PaymentMode');
  const Amount = reqDec(req.p.Amount, 'Amount');
  const { Username, Password, GAKEY, Remark, OTPCODE, hfauthenticated } = req.p;
  const Plid = Number(req.user.plid);

  const IsSecuritySuccess = await Centralize_OTP.CheckSecurityForTransctiion(PaymentMode, Username, Password, OTPCODE, hfauthenticated, GAKEY, Amount, req);
  if (IsSecuritySuccess !== 'success') return res.json(IsSecuritySuccess);
  let JsonReply = '';
  const mode = 12;
  try {
    const ToUserDetails = await queryOne(DB, 'select * from portal_login where username=@u limit 1', { u: s(Username).trim() });
    if (ToUserDetails === null) {
      JsonReply = 'Failure^Username is incorrect. Please try again.';
      return res.json(JsonReply);
    }
    // PORT-NOTE: @StrResult / @TotalCount OUT params are same-named columns of the procedure result row
    const out = await proc(DB, 'usp_transferfundtouser', { mode, tmfthid: '0', plid: Plid, toplid: ToUserDetails.plid, amount: Amount, remark: Remark });
    const StrResult = s(colOf(out, 'strresult'));
    JsonReply = StrResult;
    if (StrResult.toLowerCase() !== 'success') {
      JsonReply = 'Error^' + StrResult;
      return res.json(JsonReply);
    }
    const MemberDetails = await queryOne(DB, 'select * from member_master where regno=@plid limit 1', { plid: Plid });
    const Frommsg = await queryOne(DB, 'select * from tbl_smsaction where id=1062 limit 1');
    const Tomsg = await queryOne(DB, 'select * from tbl_smsaction where id=1063 limit 1');
    const Frommessg = await UtilityClass.FindingSmsContentWithUserIdPassword(MemberDetails.username, Frommsg.sms_content, '', '', 46, '', ToUserDetails.username, 0, Amount, Plid);
    const Tomessg = await UtilityClass.FindingSmsContentWithUserIdPassword(MemberDetails.username, Tomsg.sms_content, '', '', 47, '', ToUserDetails.username, Amount, 0, 0, ToUserDetails.plid);

    const emailmsg = await queryOne(DB, 'select * from tbl_emailaction where eid=1056 limit 1');
    const DynamicMsgForDebit = await UtilityClass.FindingEmailContentWithUserIdPassword(ToUserDetails.username, emailmsg.email_content, MemberDetails.emailid, '', 49, '', '', Plid, 0, '', '', 0, Amount, 0);
    const Creditemailmsg = await queryOne(DB, 'select * from tbl_emailaction where eid=1057 limit 1');
    const DynamicMsgForCredit = await UtilityClass.FindingEmailContentWithUserIdPassword('', Creditemailmsg.email_content, MemberDetails.emailid, '', 50, '', '', 0, 0, '', '', ToUserDetails.plid, 0, Amount);

    // For Debit Sms
    if (Frommsg.smscategory === 'Transfer' && Number(Frommsg.sms_send_status) === 1) {
      Promise.resolve().then(() => UtilityClass.SendSMSWithAPI(MemberDetails.mobile, Frommessg, '1')).catch(() => {});
    }
    // Credit Sms
    if (Tomsg.smscategory === 'Transfer' && Number(Tomsg.sms_send_status) === 1) {
      Promise.resolve().then(() => UtilityClass.SendSMSWithAPI(ToUserDetails.phone, Tomessg, '1')).catch(() => {});
    }
    // For Debit Member
    if (Number(emailmsg.email_send_status) === 1) {
      Promise.resolve().then(() => UtilityClass.SendEmailByApiSetting(MemberDetails.username, '', '', '', '', '', s(MemberDetails.emailid).toLowerCase(), emailmsg.email_subject, DynamicMsgForDebit, null)).catch(() => {});
    }
    // For Credit Member
    if (Number(Creditemailmsg.email_send_status) === 1) {
      Promise.resolve().then(() => UtilityClass.SendEmailByApiSetting(MemberDetails.username, '', '', '', '', '', s(ToUserDetails.emailid).toLowerCase(), Creditemailmsg.email_subject, DynamicMsgForCredit, null)).catch(() => {});
    }
    JsonReply = StrResult + '^Fund transferred successfully.';
    sessionStore.set(req, 'SessionOTP', null);
    return res.json(JsonReply);
  } catch (ExpObj) {
    await errIns(req, ExpObj, 'Usp_TransferFundToUser');
    return res.json('Error^Some error occured. Please try again.');
  }
}));

// ---- CheckCheckboxOnTheBehalfOfPermission ------------------------------------------------------------------------
// public (no session check in legacy)
router.all(`/member/${C}/CheckCheckboxOnTheBehalfOfPermission{/:id}`, asyncHandler(async (req, res) => {
  res.json(mapRows(await proc(DB, 'usp_getdataforregistration', { mode: 1 }), P_PERMITTED));
}));

// ---- CheckTranspasswordOnOrOff -------------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/CheckTranspasswordOnOrOff{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await isVerify(Number(req.user.plid)));
}));

module.exports = router;
