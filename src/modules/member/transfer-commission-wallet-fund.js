'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Transfer_Commission_Wallet_Fund.cs (Transfer_Commission_Wallet_FundController) */
const express = require('express');
const { queryOne, scalar, proc } = require('../../db');
const { auth, optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');
const Centralize_OTP = require('../../lib/member/Centralize_OTP');
const Security_Key = require('../../lib/member/Security_Key');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Transfer_Commission_Wallet_Fund';
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const NPE = () => new Error('Object reference not set to an instance of an object.');
const need = (o) => { if (o === null || o === undefined) throw NPE(); return o; };
// replaces `new Thread(delegate { ... }).Start()` (fire and forget)
const fire = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e.message)); };
const truthy = (v) => v === true || Number(v) === 1;

// dbo.usp_TypeofWallet @Mode -> FirstOrDefault<string>
async function walletType(mode) {
  const rows = await proc(DB, 'usp_typeofwallet', { mode });
  if (!rows.length) return null;
  const r = rows[0];
  const v = r[Object.keys(r)[0]];
  return v === undefined ? null : v;
}

// auth ([SessionExpireCheck])
// route-config: "referral/4CO1fbJYRYkB4FISKMR49hkSHCD0rPb6CRlqU76jumac2FmEZnQtYQ==" -> Transfer_Commission_Wallet_Fund/Index
router.all([`${P}/Index{/:id}`, P, '/member/referral/4CO1fbJYRYkB4FISKMR49hkSHCD0rPb6CRlqU76jumac2FmEZnQtYQ=='], auth, asyncHandler(async (req, res) => {
  const ViewBag = { status: 0 };
  sessionStore.set(req, 'SessionOTP', null);
  const Plid = Math.trunc(Number(req.user.plid));
  const r = await queryOne(DB, 'select isverify from member_login where regno = @plid limit 1', { plid: Plid });
  ViewBag.IsActive = r ? truthy(r.isverify) : false;
  ViewBag.Commission = await walletType(3); // CommissionType()
  ViewBag.ewallet = await walletType(2); // EwalletType()
  res.json({ ViewBag });
}));

// public (no session check in legacy; only resets the OTP)
router.all(`${P}/coinIndex{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  sessionStore.set(req, 'SessionOTP', null);
  res.json({ ViewBag: { status: 0 } });
}));

// auth (legacy had no session check but Centralize_OTP reads Session["plid"])
router.all(`${P}/GetOTPDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const returnmessage = await Centralize_OTP.GenrateOTP(toInt(req.p.smsId), toInt(req.p.emailEId), req.p.TransPass, req);
  res.json(returnmessage);
}));

// (ResendOTP is commented out in the legacy controller)

// auth ([SessionExpireCheck])
router.all(`${P}/TransferFundtoUser{/:id}`, auth, asyncHandler(async (req, res) => {
  const PaymentMode = toInt(req.p.PaymentMode);
  const { Username, Password, GAKEY, Remark, OTPCODE, hfauthenticated } = req.p;
  const Amount = Number(req.p.Amount);
  const Plid = Math.trunc(Number(req.user.plid));
  const IsSecuritySuccess = await Centralize_OTP.CheckSecurityForTransctiion(PaymentMode, Username, Password, OTPCODE, hfauthenticated, GAKEY, Amount, req);
  if (IsSecuritySuccess !== 'success') return res.json(IsSecuritySuccess);
  const WalletMode = PaymentMode;

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
    let objs = new Security_Key();
    objs = await objs.Get_Security_Key(Plid);
    if (objs != null) {
      if (!(await objs.Check_GaKey(Plid, GAKEY))) {
        JsonReply = 'Error^Please enter the valid GA key !';
        return res.json(JsonReply);
      }
    }
    // @StrResult / @TotalCount are OUTPUT parameters (read from the result row)
    const rows = await proc(DB, 'usp_transferfundtouser', {
      mode, tmfthid: 0, plid: Plid, toplid: Plid, amount: Amount, remark: Remark,
      fromdate: '', todate: '', startrowindex: 1, maxrows: 100, paymode: PaymentMode,
    });
    const StrResult = rows.length && rows[0].strresult !== undefined ? rows[0].strresult : null;
    JsonReply = String(need(StrResult));
    if (JsonReply.toLowerCase() !== 'success') {
      JsonReply = 'Error^' + String(StrResult);
      return res.json(JsonReply);
    }
    const MemberDetails = await queryOne(DB, 'select * from member_master where regno = @plid limit 1', { plid: Plid });
    const Frommsg = await queryOne(DB, 'select * from tbl_smsaction where id = 1047 limit 1', {});
    const Creditemailmsg = await queryOne(DB, 'select * from tbl_emailaction where eid = 1043 limit 1', {});
    const ForShoppingWalletMsg = await queryOne(DB, 'select * from tbl_smsaction where id = 1064 limit 1', {});
    const ForShoppingWalletEmail = await queryOne(DB, 'select * from tbl_emailaction where eid = 1058 limit 1', {});
    const DynamicMsgForCredit = await UtilityClass.FindingEmailContentWithUserIdPassword('', need(Creditemailmsg).email_content, need(MemberDetails).emailid, '', 37, '', '', 0, 0, '', '', 0, Amount, 0);
    const EmailCreaditedShoppingWallet = await UtilityClass.FindingEmailContentWithUserIdPassword('', Creditemailmsg.email_content, MemberDetails.emailid, '', 54, '', '', 0, 0, '', '', 0, Amount, 0);

    const Frommessg = await UtilityClass.FindingSmsContentWithUserIdPassword(MemberDetails.username, need(Frommsg).sms_content, '', '', 34, '', '', 0, Amount, Plid);
    const ForCreditToShoppingWallet = await UtilityClass.FindingSmsContentWithUserIdPassword(MemberDetails.username, need(ForShoppingWalletMsg).sms_content, '', '', 52, '', '', 0, Amount, Plid);
    if (Frommsg.smscategory === 'Transfer') {
      if (WalletMode === 12) {
        if (Number(Frommsg.sms_send_status) === 1) {
          fire(() => UtilityClass.SendSMSWithAPI(MemberDetails.mobile, Frommessg, '1'));
        }
      } else if (WalletMode === 5) {
        if (Number(ForShoppingWalletMsg.sms_send_status) === 1) {
          fire(() => UtilityClass.SendSMSWithAPI(MemberDetails.mobile, ForCreditToShoppingWallet, '1'));
        }
      }
    }

    if (WalletMode === 12) {
      if (Number(Creditemailmsg.email_send_status) === 1) {
        const fileUploader = null;
        fire(() => UtilityClass.SendEmailByApiSetting(MemberDetails.username, '', '', '', '', '', MemberDetails.emailid.toLowerCase(), Creditemailmsg.email_subject, DynamicMsgForCredit, fileUploader));
      }
    } else if (WalletMode === 5) {
      if (Number(need(ForShoppingWalletEmail).email_send_status) === 1) {
        const fileUploader = null;
        fire(() => UtilityClass.SendEmailByApiSetting(MemberDetails.username, '', '', '', '', '', MemberDetails.emailid.toLowerCase(), Creditemailmsg.email_subject, EmailCreaditedShoppingWallet, fileUploader));
      }
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

// (CheckCheckboxOnTheBehalfOfPermission is commented out in the legacy controller)

// auth (legacy had no session check but dereferenced the session)
router.all(`${P}/CheckTranspasswordOnOrOff{/:id}`, auth, asyncHandler(async (req, res) => {
  const r = await queryOne(DB, 'select isverify from member_login where regno = @plid limit 1', { plid: Number(req.user.plid) });
  res.json(r ? truthy(r.isverify) : false);
}));

// public: `public void EwalletType()` is an (empty-result) MVC action in legacy; only sets ViewBag.ewallet
router.all(`${P}/EwalletType{/:id}`, asyncHandler(async (req, res) => {
  await walletType(2);
  res.status(200).end();
}));

// public: `public void CommissionType()` is an (empty-result) MVC action in legacy; only sets ViewBag.Commission
router.all(`${P}/CommissionType{/:id}`, asyncHandler(async (req, res) => {
  await walletType(3);
  res.status(200).end();
}));

module.exports = router;
