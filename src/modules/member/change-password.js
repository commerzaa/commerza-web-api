'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Change_Password.cs (Change_PasswordController) */
const express = require('express');
const axios = require('axios');
const { queryOne, scalar, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');
const GetIP = require('../../lib/member/GetIP');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Change_Password';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
async function ErrorInsert(e, name, req) {
  try { await new DataUtility().ErrorInsert(0, e.message, name, 0, req.path); } catch (_) { /* ignore */ }
}
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e && e.message)); };
const P_CHECK = ['FID', 'Status', 'VALIDATIONACTIVE', 'ACTIVE', 'FIELDNAME', 'SHOWACTIVE'];
const userName = (req) => req.user.userName || req.user.username;

// route-config: referral/wFWmFmY5FESkOAq1tRplAQ==
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/wFWmFmY5FESkOAq1tRplAQ=='], auth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const row = await queryOne(DB, "select * from settings where CAPTION = 'Password Camplacity' limit 1");
  if (row) ViewBag.active = row.active;
  const rows = await queryOne(DB, "select * from settings where CAPTION = 'Transaction Pin' limit 1");
  if (rows) {
    ViewBag.Transpin = rows.active;
    ViewBag.Limit = parseInt(rows.limits, 10);
  }
  const Plid = Number(req.user.plid);
  ViewBag.IsActive = !!(await scalar(DB, 'select IsVerify from MEMBER_LOGIN where REGNO=@p limit 1', { p: Plid }));
  res.json({ ViewBag });
}));

// auth
router.all(`${P}/CheckTranspasswordOnOrOff{/:id}`, auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const result = !!(await scalar(DB, 'select IsVerify from MEMBER_LOGIN where REGNO=@p limit 1', { p: Plid }));
  res.json(result);
}));

// auth
router.all(`${P}/GenerateOTP{/:id}`, auth, asyncHandler(async (req, res) => {
  const { OldPassword, NewPassword, ConfirmPassword } = req.p;
  let returnmessage = 'OTP SENT';
  if (OldPassword !== '' && NewPassword !== '' && ConfirmPassword !== '') {
    if (NewPassword !== ConfirmPassword) {
      returnmessage = "error^Passwords don't match.";
      return res.json(returnmessage);
    }
  } else {
    returnmessage = 'error^Enter the mandatory fields.';
    return res.json(returnmessage);
  }
  const OTP = String(UtilityClass.RandomNumberStringByLength(6));
  let Mobilestatus = 0;
  let OtpShowActive = '1';
  sessionStore.set(req, 'SessionOTP', OTP);
  const Regno = Number(req.user.plid);
  const username = userName(req);
  // Session Login object carried MOBILE / EMAILID: JWT fields `mobile` / `emailid` (fallback: member_master)
  let MOBILE = req.user.mobile; let Email = req.user.emailid;
  if (MOBILE === undefined || Email === undefined) {
    const mm = await queryOne(DB, 'select mobile, emailid from member_master where regno = @p limit 1', { p: Regno });
    if (MOBILE === undefined) MOBILE = mm ? mm.mobile : null;
    if (Email === undefined) Email = mm ? mm.emailid : null;
  }

  const prow = await procOne(DB, 'usp_getpassworddetails', { mode: 1, regno: Regno });
  const Password_OLD = prow ? str(prow[Object.keys(prow)[0]]) : null;
  const old_Pass = UtilityClass.Decryptword(Password_OLD);
  if (old_Pass !== OldPassword) {
    returnmessage = 'error^Invalid OLD Password.';
    return res.json(returnmessage);
  }
  const msg = await queryOne(DB, 'select * from TBL_SMSACTION where ID = 1068 limit 1');
  if (!msg) throw NRE();
  Mobilestatus = msg.sms_send_status;
  OtpShowActive = String(msg.sms_send_status);
  const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(username, msg.sms_content, username, OTP, 2);
  const emailidstatus = await queryOne(DB, 'select * from tbl_emailaction where EID = 1062 limit 1');
  if (!emailidstatus) throw NRE();
  if (emailidstatus.email_send_status === 1) {
    const MailContent = emailidstatus.email_content;
    const DynamicMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(username, MailContent, Email, OTP, 51, '', '', Regno);
    bg(() => UtilityClass.SendEmailByApiSetting(username, '', '', '', '', '', Email.toLowerCase(), emailidstatus.email_subject, DynamicMsg, null));
  }
  if (Mobilestatus === 1) {
    bg(() => UtilityClass.SendSMSWithAPI(MOBILE, messg, '1'));
  }
  returnmessage = 'OTP SENT';
  res.json(returnmessage + '^' + OtpShowActive);
}));

async function history(req, Plid, OldPassword, NewPassword, ConfirmPassword, Status, Type) {
  Status = Status === '1' ? 'success' : 'Failed';
  const host = req.hostname;
  let IAddress = '';
  if (String(host).toLowerCase() === 'localhost') IAddress = '67.225.214.45';
  else IAddress = await GetIP.GetLocalIP(req);
  const url = 'https://extreme-ip-lookup.com/json/' + IAddress;
  const r = await axios.get(url, { transformResponse: [(d) => d], responseType: 'text' });
  const location = JSON.parse(r.data);
  sessionStore.set(req, 'COUNTRYNAME', location.country);
  sessionStore.set(req, 'STATENAME', location.region);
  sessionStore.set(req, 'CITYNAME', location.city);
  sessionStore.set(req, 'Latitude', location.lat);
  sessionStore.set(req, 'longitude', location.lon);
  await procOne(DB, 'usp_changepasswordhistory', {
    plid: Plid, username: userName(req), oldpassword: OldPassword, newpassword: NewPassword, confirmpassword: ConfirmPassword,
    ipaddress: IAddress, latitude: sessionStore.get(req, 'Latitude'), longitude: sessionStore.get(req, 'longitude'),
    type: Type, status: Status,
  });
}

// auth
router.all(`${P}/UpdatePassword{/:id}`, auth, asyncHandler(async (req, res) => {
  let resValue = '';
  const otp = req.p.otp;
  const OldPassword = UtilityClass.Encryptword(req.p.OldPassword);
  const NewPassword = UtilityClass.Encryptword(req.p.NewPassword);
  const ConfirmPassword = UtilityClass.Encryptword(req.p.ConfirmPassword);

  // SECURITY: the legacy code accepted the hard-coded OTP 'abcd' to skip the OTP check. That bypass is removed; the OTP must always match.
  {
    const so = sessionStore.get(req, 'SessionOTP');
    if (so === undefined || so === null) throw NRE();
    const LoginOtp = String(so);
    if (otp !== LoginOtp) return res.json('InValid OTP');
    if (OldPassword !== '' && NewPassword !== '' && ConfirmPassword !== '') {
      if (NewPassword !== ConfirmPassword) {
        resValue = "error^Passwords don't match.";
        return res.json(resValue);
      }
    } else {
      resValue = 'error^Enter the mandatory fields.';
      return res.json(resValue);
    }
  }

  const Plid = Number(req.user.plid);
  try {
    await queryOne(DB, 'select LOGINID from member_login where regno = @p limit 1', { p: Plid }); // user (unused)
    const out = await procOne(DB, 'usp_contactpasswordchange', { plid: Plid, oldpass: OldPassword, newpass: NewPassword, confpass: ConfirmPassword, mode: '1' });
    resValue = str(out && out.intresult);
    await history(req, Plid, OldPassword, NewPassword, ConfirmPassword, resValue, 'LoginPassword');
  } catch (Exp) {
    await ErrorInsert(Exp, 'USP_CONTACTPASSWORDCHANGE', req);
    resValue = 'error^Some Error Occured.Please Try Again';
  }
  res.json(resValue);
}));

// auth
router.all(`${P}/CheckCheckboxOnTheBehalfOfPermission{/:id}`, auth, asyncHandler(async (req, res) => {
  const Details = mapRows(await proc(DB, 'usp_getdataforregistration', { mode: 1 }), P_CHECK);
  res.json(Details);
}));

module.exports = router;
