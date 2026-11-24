'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Transfer_BTC_Wallet.cs (Transfer_BTC_WalletController) */
const express = require('express');
const { queryOne, procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const Centralize_OTP = require('../../lib/member/Centralize_OTP');
const Security_Key = require('../../lib/member/Security_Key');
const DAL_RegistrationOrLogin = require('../../lib/member/DAL_RegistrationOrLogin');
const BitCoinCoreDaemon = require('../../lib/member/BitCoinCoreDaemon');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Transfer_BTC_Wallet';

const sessionOf = (req) => ({
  plid: { Plid: Number(req.user.plid) },
  get SessionOTP() { return sessionStore.get(req, 'SessionOTP'); },
  set SessionOTP(v) { sessionStore.set(req, 'SessionOTP', v); },
});

// route-config: referral/transfer-btc-wallet
// auth ([SessionExpireCheck])
router.all([`${P}/Index{/:id}`, '/member/referral/transfer-btc-wallet'], auth, asyncHandler(async (req, res) => {
  // auto approval of BTC node deposits (background thread in legacy)
  Promise.resolve().then(() => BitCoinCoreDaemon.PaymentAutoClearificationBTCNode(Number(req.user.plid))).catch(() => {});
  sessionStore.set(req, 'SessionOTP', null);
  res.json({ ViewBag: { Status: 0 } });
}));

const SQL_WORDS = ['union', 'union all', 'insert', 'update', 'drop', 'delete', 'exec', 'select'];
const hasSqlWord = (v) => { const l = v.toLowerCase(); return SQL_WORDS.some((w) => l.includes(w)); };
const regexItem = /^[a-zA-Z0-9 ]*$/;
// returns true when the value is invalid (legacy "Invalid Attempts.")
function invalid(v, { regex = true } = {}) {
  if (v === null || v === undefined) return false;
  v = String(v);
  if (v.length > 100) return true;
  if (hasSqlWord(v)) return true;
  if (regex && !regexItem.test(v)) return true;
  return false;
}

// auth ([SessionExpireCheck])
router.all(`${P}/TransferFundtoUser{/:id}`, auth, asyncHandler(async (req, res) => {
  let { Username, Password, GAKEY, Remark, OTPCODE, HfAuthenticated } = req.p;
  const Amount = Number(req.p.Amount);
  if (invalid(HfAuthenticated) || invalid(OTPCODE) || invalid(Remark) || invalid(GAKEY) || invalid(Password, { regex: false }) || invalid(Username)) {
    return res.json('Invalid Attempts.');
  }
  const IsSecuritySuccess = await Centralize_OTP.CheckSecurityForTransctiion(0, Username, Password, OTPCODE, HfAuthenticated, GAKEY, Amount, sessionOf(req));
  if (IsSecuritySuccess !== 'success') return res.json(IsSecuritySuccess);
  const Plid = Number(req.user.plid);
  if (HfAuthenticated === null || HfAuthenticated === undefined) HfAuthenticated = '0';
  let JsonReply = '';
  try {
    let objs = new Security_Key();
    let ActiveKey = 0;
    objs = await objs.Get_Security_Key(Plid);
    if (objs) {
      ActiveKey = objs.Status;
      const ValidRandomNo = await DAL_RegistrationOrLogin.CheckRandomNo(parseInt(req.user.plid, 10));
      if (ActiveKey === 1) {
        if (!(await objs.Check_GaKey(Plid, ValidRandomNo, GAKEY))) {
          JsonReply = 'Error^Please enter the valid GA key !';
          return res.json(JsonReply);
        }
      }
    }
    if (Username === '' || Amount <= 0) {
      JsonReply = 'Invalid^Please enter the mandatory fields.';
      return res.json(JsonReply);
    } else if (Password !== '') {
      Password = UtilityClass.Encryptword(Password);
      const PL = await queryOne(DB, 'select plid from portal_login where trim(tpassword) = @tp and plid = @p limit 1', { tp: String(Password).trim(), p: Plid });
      if (!PL) {
        JsonReply = 'Invalid^Wrong Transaction Password.Please try again.';
        return res.json(JsonReply);
      }
    }
    const ToUserDetails = await queryOne(DB, 'select * from portal_login where username = @u limit 1', { u: String(Username).trim() });
    if (!ToUserDetails) {
      JsonReply = 'Failure^Username seems to be incorrect. Please try again.';
      return res.json(JsonReply);
    }
    const out = await procOne(DB, 'usp_btcwallettransferfundtouser', { plid: Plid, toplid: ToUserDetails.plid, amount: Amount, remark: req.p.Remark });
    const sr = out && out.strresult !== null && out.strresult !== undefined ? String(out.strresult) : '';
    JsonReply = sr;
    if (sr.toLowerCase() !== 'success') {
      JsonReply = 'Error^' + sr;
      return res.json(JsonReply);
    }
    JsonReply = sr + '^Fund transferred successfully.';
    sessionStore.set(req, 'SessionOTP', null);
    return res.json(JsonReply);
  } catch (ExpObj) {
    return res.json('Error^Some error occured. Please try again.' + ExpObj.message);
  }
}));

module.exports = router;
