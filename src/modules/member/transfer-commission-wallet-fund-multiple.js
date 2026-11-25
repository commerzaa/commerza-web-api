'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Transfer_Commission_Wallet_Fund_multiple.cs (Transfer_Commission_Wallet_Fund_multipleController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const { auth, optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');
const Security_Key = require('../../lib/member/Security_Key');

const router = express.Router();
const DB = 'affiliate';

const CHECKBOX_PROPS = ['FID', 'Status', 'VALIDATIONACTIVE', 'ACTIVE', 'FIELDNAME'];
const legacyPath = (req) => req.originalUrl.split('?')[0].replace(/^\/member/, '');
const col = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e)); }; // legacy new Thread(...).Start()
// Convert.ToDecimal(string)
const toDecimal = (v) => {
  if (v === undefined || v === null) return 0;
  const n = Number(String(v).trim());
  if (String(v).trim() === '' || Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
};
const npe = () => new Error('Object reference not set to an instance of an object.');

// auth ([SessionExpireCheck])
router.all('/member/Transfer_Commission_Wallet_Fund_multiple/Index{/:id}', auth, (req, res) => {
  sessionStore.set(req, 'SessionOTP', null);
  res.json({ view: '~/Views/CustomerPanel/Transfer_Commission_Wallet_Fund_multiple/Index.cshtml', ViewBag: { status: 0 } });
});

// no session check in legacy (only clears the visitor's SessionOTP) => optional auth
router.all('/member/Transfer_Commission_Wallet_Fund_multiple/coinIndex{/:id}', optionalAuth, (req, res) => {
  sessionStore.set(req, 'SessionOTP', null);
  res.json({ view: '~/Views/CustomerPanel/Transfer_Commission_Wallet_Fund_multiple/Index.cshtml', ViewBag: { status: 0 } });
});

// auth (reads Session["Plid"])
router.all('/member/Transfer_Commission_Wallet_Fund_multiple/GenerateOTP{/:id}', auth, asyncHandler(async (req, res) => {
  let TransPass = req.p.TransPass;
  const Amount = toDecimal(req.p.Amount);
  const Plid = Math.trunc(Number(req.user.plid));
  if (TransPass === undefined || TransPass === null || TransPass === '') {
    const r = await db.queryOne(DB, 'select tpassword from portal_login where plid = @plid limit 1', { plid: Plid });
    TransPass = r ? r.tpassword : null;
  } else {
    TransPass = await UtilityClass.Encryptword(TransPass);
  }

  {
    let checkamount = 0;
    const row1 = await db.queryOne(DB, "select limits from settings where caption = 'MinCommissionwallettrasfer' and active::int = 1 limit 1", {});
    if (row1) checkamount = row1.limits;
    if (Amount < Number(checkamount)) {
      return res.json('Minimum Tranfer Amount ' + checkamount);
    }
  }

  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0;
  let Emailstatus = 0;
  sessionStore.set(req, 'SessionOTP', OTP);
  {
    const msg = await db.queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id = 17 limit 1', {});
    if (!msg) throw npe();
    Mobilestatus = Number(msg.sms_send_status);

    const emailmsg = await db.queryOne(DB, 'select email_content, email_send_status from tbl_emailaction where eid = 14 limit 1', {});
    if (!emailmsg) throw npe();
    Emailstatus = Number(emailmsg.email_send_status);

    const PLDetails = await db.queryOne(DB, 'select * from portal_login where plid = @plid limit 1', { plid: Plid });
    if (PLDetails) {
      // (PLDetails.PHONE != null || PLDetails.PHONE != "") is always true in legacy
      const Userid = '';
      const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);
      const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');

      if (TransPass === PLDetails.tpassword) {
        if (Mobilestatus === 1) {
          bg(() => UtilityClass.SendSMSWithAPI(PLDetails.phone, messg, '1'));
        }
        if (Emailstatus === 1) {
          bg(async () => {
            // (PLDetails.EMAILID != null || PLDetails.EMAILID != "") is always true in legacy
            await UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Member Topup', Emailmsg, null, '', '');
          });
        }
        returnmessage = 'OTP SENT';
      } else {
        returnmessage = 'Invalid Transaction Password!!';
      }
    }
  }
  if (Mobilestatus === 0 && Emailstatus === 0) {
    returnmessage = 'OTP BYPASS';
  }
  return res.json(returnmessage);
}));

// auth ([SessionExpireCheck])
router.all('/member/Transfer_Commission_Wallet_Fund_multiple/TransferFundtoUser{/:id}', auth, asyncHandler(async (req, res) => {
  let { Username, Password, GAKEY, Remark, OTPCODE, hfauthenticated } = req.p;
  const PaymentMode = parseInt(req.p.PaymentMode, 10);
  const Amount = toDecimal(req.p.Amount);
  const Plid = Math.trunc(Number(req.user.plid));
  if (Number.isNaN(PaymentMode)) throw new Error('The parameters dictionary contains a null entry for parameter \'PaymentMode\'.');

  if (Password === undefined || Password === null || Password === '') {
    const r = await db.queryOne(DB, 'select tpassword from portal_login where plid = @plid limit 1', { plid: Plid });
    Password = r ? r.tpassword : null;
    Password = await UtilityClass.Decryptword(Password);
  }

  if (hfauthenticated === undefined || hfauthenticated === null) hfauthenticated = '0';

  {
    const msg = await db.queryOne(DB, 'select sms_send_status from tbl_smsaction where id = 17 limit 1', {});
    const emailmsg = await db.queryOne(DB, 'select email_send_status from tbl_emailaction where eid = 14 limit 1', {});
    if (!msg || !emailmsg) throw npe();
    if (Number(msg.sms_send_status) === 0 && Number(emailmsg.email_send_status) === 0) {
      if (config.app.MasterCode === OTPCODE) {
        sessionStore.set(req, 'SessionOTP', OTPCODE);
      }
    }
  }
  const sessionOtp = () => {
    const so = sessionStore.get(req, 'SessionOTP');
    if (so === undefined || so === null) throw npe(); // Session["SessionOTP"].ToString() on null
    return String(so);
  };
  if (OTPCODE !== sessionOtp()) {
    return res.json('error^You have entered wrong OTP.');
  }
  if (OTPCODE !== sessionOtp()) {
    return res.json('error^You have entered wrong OTP.');
  } else if (OTPCODE === sessionOtp() && hfauthenticated === '1') {
    if (GAKEY === '') {
      return res.json('GAKey');
    }
  }
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
    if (PaymentMode === 0 || Username === '' || Amount <= 0 || Password === '') {
      JsonReply = 'Invalid^Please enter the mandatory fields.';
      return res.json(JsonReply);
    }
    Password = await UtilityClass.Encryptword(Password); // (value is not used afterwards in legacy either)

    let objs = new Security_Key();
    objs = await objs.Get_Security_Key(Plid);
    if (objs) {
      // PORT-NOTE: legacy passes GAKEY as the *secret* argument of Check_GaKey(plid, SecretKey, user2FACode = "") - kept as is.
      if (!(await objs.Check_GaKey(Plid, GAKEY))) {
        JsonReply = 'Error^Please enter the valid GA key !';
        return res.json(JsonReply);
      }
    }
    if (Username === undefined || Username === null) throw npe(); // Username.Trim() on null
    const ToUserDetails = await db.queryOne(DB, 'select plid from portal_login where username = @username limit 1', { username: String(Username).trim() });
    if (!ToUserDetails) {
      JsonReply = 'Failure^Username is incorrect. Please try again.';
      return res.json(JsonReply);
    }
    // PORT-NOTE: the legacy SQL text passes its arguments positionally; the 13th one (@paymode) lands on the proc's @SearchUsername parameter
    // (USP_TRANSFERFUNDTOUSER: ..., @StartRowIndex, @MaxRows, @SearchUsername, ..., @paymode). Reproduced as is.
    // @StrResult / @TotalCount OUT are read from the result row.
    const out = await db.procOne(DB, 'usp_transferfundtouser', {
      mode, tmfthid: '0', plid: Plid, toplid: ToUserDetails.plid, amount: Amount, remark: Remark,
      fromdate: '', todate: '', startrowindex: '1', maxrows: '100', searchusername: PaymentMode,
    });
    const sr = col(out, 'strresult');
    const StrResult = sr === null ? '' : String(sr);
    JsonReply = StrResult;
    if (StrResult.toLowerCase() !== 'success') {
      JsonReply = 'Error^' + StrResult;
      return res.json(JsonReply);
    }
    JsonReply = StrResult + '^Fund transferred successfully.';
    sessionStore.set(req, 'SessionOTP', null);
    return res.json(JsonReply);
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'Usp_TransferFundToUser', 0, legacyPath(req)); } catch (e) { console.error(e); }
    return res.json('Error^Some error occured. Please try again.');
  }
}));

// public (no session check; static registration-form permissions)
router.all('/member/Transfer_Commission_Wallet_Fund_multiple/CheckCheckboxOnTheBehalfOfPermission{/:id}', asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_getdataforregistration', { mode: 1 });
  res.json(mapRows(rows, CHECKBOX_PROPS));
}));

module.exports = router;
