'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Transfer_Coin_Wallet_Fund.cs (Transfer_Coin_Wallet_FundController, 6 actions)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: "Transfer Coin Wallet " -> referral/4CO1fbJYRYnhkO_slash_qiO7lLmDbz_slash_gmdhnEZMGjT0msPmo= (Index)
 * Every action uses Session["Plid"] (directly or inside Centralize_OTP) => auth.
 */
const express = require('express');
const { queryOne, scalar, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');
const Centralize_OTP = require('../../lib/member/Centralize_OTP');
const Security_Key = require('../../lib/member/Security_Key');
const DAL_RegistrationOrLogin = require('../../lib/member/DAL_RegistrationOrLogin');

const router = express.Router();
const DB = 'affiliate';
const C = 'Transfer_Coin_Wallet_Fund';

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
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/4CO1fbJYRYnhkO_slash_qiO7lLmDbz_slash_gmdhnEZMGjT0msPmo='], auth, asyncHandler(async (req, res) => {
  const ViewBag = { status: 0 };
  sessionStore.set(req, 'SessionOTP', null);
  ViewBag.IsActive = await isVerify(parseInt(req.user.plid, 10));
  res.json({ ViewBag });
}));

// ---- coinIndex ----------------------------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/coinIndex{/:id}`, auth, asyncHandler(async (req, res) => {
  sessionStore.set(req, 'SessionOTP', null);
  res.json({ ViewBag: { status: 0 } });
}));

// ---- GetOTPDetails ------------------------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/GetOTPDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const smsId = reqInt(req.p.smsId, 'smsId');
  const emailEId = reqInt(req.p.emailEId, 'emailEId');
  res.json(await Centralize_OTP.GenrateOTP(smsId, emailEId, req.p.TransPass, req));
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
  let mode = 0;
  if (PaymentMode === 12) mode = 7; // Coin Wallet Transfer
  if (PaymentMode === 14) mode = 1; // INR/(I) Wallet Transfer
  if (mode === 0) {
    JsonReply = 'Invalid^Please select payment mode.';
    return res.json(JsonReply);
  }
  try {
    let objs = new Security_Key();
    let ActiveKey = 0;
    objs = await objs.Get_Security_Key(parseInt(Plid, 10));
    if (objs != null) {
      ActiveKey = objs.Status;
      const ValidRandomNo = await DAL_RegistrationOrLogin.CheckRandomNo(parseInt(Plid, 10));
      if (ActiveKey === 1) {
        if (!(await objs.Check_GaKey(parseInt(Plid, 10), ValidRandomNo, GAKEY))) {
          return res.json('Error^Please enter valid GA key !');
        }
      }
    }
    const ToUserDetails = await queryOne(DB, 'select * from portal_login where username=@u limit 1', { u: s(Username).trim() });
    if (ToUserDetails === null) {
      JsonReply = 'Failure^Username is incorrect. Please try again.';
      return res.json(JsonReply);
    }
    // PORT-NOTE: @StrResult / @TotalCount OUT params are same-named columns of the procedure result row
    const out = await proc(DB, 'usp_transferfundtouser', {
      mode, tmfthid: '0', plid: Plid, toplid: ToUserDetails.plid, amount: Amount, remark: Remark, fromdate: '', todate: '', startrowindex: '1', maxrows: '100',
    });
    const StrResult = s(colOf(out, 'strresult'));
    JsonReply = StrResult;
    if (StrResult.toLowerCase() !== 'success') {
      JsonReply = 'Error^' + StrResult;
      return res.json(JsonReply);
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
