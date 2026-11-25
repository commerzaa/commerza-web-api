'use strict';
// Ported from Member\Controllers\CustomerPanel\Transfer_Wallet_Fund_multipleWallet.cs (7 actions) - database: affiliate (Db_Affiliate)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const Centralize_OTP = require('../../lib/member/Centralize_OTP');
const Security_Key = require('../../lib/member/Security_Key');
const DAL_RegistrationOrLogin = require('../../lib/member/DAL_RegistrationOrLogin');
const DB = 'affiliate';
const P = '/member/Transfer_Wallet_Fund_multipleWallet';
const SecKeyClass = Security_Key.Security_Key || Security_Key;
const col = (row, name) => { const k = row && Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k !== undefined ? row[k] : undefined; };
async function errorInsert(err, procName, req) { // legacy DataUtility.ErrorInsert(code, message, procedure, line, url)
  try {
    const DU = require('../../lib/member/DataUtility');
    const ut = typeof DU === 'function' ? new DU() : (DU.DataUtility ? new DU.DataUtility() : DU);
    await ut.ErrorInsert(0, err.message, procName, 0, req.path);
  } catch (e) { console.error(e.message); }
}
const walletType = async (mode) => { // dbo.usp_TypeofWallet @Mode -> first string
  const r = await db.procOne(DB, 'usp_TypeofWallet', { Mode: mode });
  return r ? r[Object.keys(r)[0]] : null;
};

// auth
// route-config: referral/GCFE2Ctopd_slash_3cDJR_slash_Xgn0y1Ve6jZCUaVV -> Index
router.all([P + '/Index{/:id}', '/member/referral/GCFE2Ctopd_slash_3cDJR_slash_Xgn0y1Ve6jZCUaVV'], auth, asyncHandler(async (req, res) => {
  sessionStore.set(req, 'SessionOTP', null);
  const shopping = await walletType(5); // ShoppingType()
  const ewallet = await walletType(2); // EwalletType()
  const v = await db.scalar(DB, 'select IsVerify from MEMBER_LOGIN where REGNO=@plid limit 1', { plid: parseInt(req.user.plid, 10) });
  res.json({ status: 0, shopping, ewallet, IsActive: v === null || v === undefined ? false : !!v });
}));

// auth
router.all(P + '/coinIndex{/:id}', auth, asyncHandler(async (req, res) => {
  sessionStore.set(req, 'SessionOTP', null);
  res.json({ status: 0 });
}));

// auth (uses the logged-in member session inside Centralize_OTP)
router.all(P + '/GetOTPDetails{/:id}', auth, asyncHandler(async (req, res) => {
  const smsId = parseInt(req.p.smsId, 10); const emailEId = parseInt(req.p.emailEId, 10);
  if (Number.isNaN(smsId) || Number.isNaN(emailEId)) return res.status(400).json({ message: 'The parameters dictionary contains a null entry for a non-nullable parameter.' });
  const returnmessage = await Centralize_OTP.GenrateOTP(smsId, emailEId, req.p.TransPass, req);
  res.json(returnmessage);
}));

// auth
router.all(P + '/TransferFundtoUser{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const PaymentMode = parseInt(req.p.PaymentMode, 10);
  const Username = req.p.Username; const Amount = Number(req.p.Amount);
  const Password = req.p.Password; const GAKEY = req.p.GAKEY; const Remark = req.p.Remark; const OTPCODE = req.p.OTPCODE; const hfauthenticated = req.p.hfauthenticated;
  if (Number.isNaN(PaymentMode) || Number.isNaN(Amount) || req.p.Amount === undefined || req.p.Amount === '') {
    return res.status(400).json({ message: 'The parameters dictionary contains a null or invalid entry for PaymentMode/Amount.' });
  }
  const IsSecuritySuccess = await Centralize_OTP.CheckSecurityForTransctiion(PaymentMode, Username, Password, OTPCODE, hfauthenticated, GAKEY, Amount, req);
  if (IsSecuritySuccess !== 'success') return res.json(IsSecuritySuccess);
  let JsonReply = '';
  let mode = 0;
  if (PaymentMode === 12) mode = 2; // Coin Wallet Transfer
  if (PaymentMode === 5) mode = 10; // Coin Wallet Transfer
  if (PaymentMode === 14) mode = 1; // INR/(I) Wallet Transfer
  if (mode === 0) {
    JsonReply = 'Invalid^Please select payment mode.';
    return res.json(JsonReply);
  }
  try {
    const objs = await new SecKeyClass().Get_Security_Key(Plid);
    let ActiveKey = 0;
    if (objs != null) {
      ActiveKey = objs.Status;
      const ValidRandomNo = await DAL_RegistrationOrLogin.CheckRandomNo(parseInt(req.user.plid, 10));
      if (ActiveKey === 1) {
        if (!(await objs.Check_GaKey(Plid, ValidRandomNo, GAKEY))) {
          JsonReply = 'Error^Please enter the valid GA key !';
          return res.json(JsonReply);
        }
      }
    }
    if (Username === undefined || Username === null) throw new Error('Object reference not set to an instance of an object.');
    const ToUserDetails = await db.queryOne(DB, 'select plid from portal_login where username=@u limit 1', { u: String(Username).trim() });
    if (ToUserDetails == null) {
      JsonReply = 'Failure^Username is incorrect. Please try again.';
      return res.json(JsonReply);
    }
    const r = await db.procOne(DB, 'Usp_TransferFundToUser', {
      Mode: mode, TMFTHID: '0', PLID: Plid, ToPlid: ToUserDetails.plid, Amount, Remark, FromDate: '', ToDate: '', StartRowIndex: '1', MaxRows: '100',
      paymode: PaymentMode,
    });
    const sv = col(r, 'StrResult');
    const StrResult = sv === undefined || sv === null ? '' : String(sv);
    JsonReply = StrResult;
    if (StrResult.toLowerCase() !== 'success') {
      JsonReply = 'Error^' + StrResult;
      return res.json(JsonReply);
    }
    JsonReply = StrResult + '^Fund transferred successfully.';
    sessionStore.set(req, 'SessionOTP', null);
    return res.json(JsonReply);
  } catch (ExpObj) {
    console.error(ExpObj.message);
    await errorInsert(ExpObj, 'Usp_TransferFundToUser', req);
    return res.json('Error^Some error occured. Please try again.');
  }
}));

// public (legacy had no session check; registration master data)
router.all(P + '/CheckCheckboxOnTheBehalfOfPermission{/:id}', asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_GETDATAFORREGISTRATION', { MODE: 1 });
  res.json(mapRows(rows, ['FID', 'Status', 'VALIDATIONACTIVE', 'ACTIVE', 'FIELDNAME']));
}));

// public (legacy public void action; sets ViewBag.ewallet, nothing rendered) - returns the value as JSON
router.all(P + '/EwalletType{/:id}', asyncHandler(async (req, res) => {
  res.json({ ewallet: await walletType(2) });
}));

// public (legacy public void action; sets ViewBag.shopping) - returns the value as JSON
router.all(P + '/ShoppingType{/:id}', asyncHandler(async (req, res) => {
  res.json({ shopping: await walletType(5) });
}));

module.exports = router;
