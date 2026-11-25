'use strict';
// Ported from Member/Controllers/CustomerPanel/separte_ga.cs  (DB: affiliate)
const express = require('express');
const axios = require('axios');
const router = express.Router();
const { proc, procOne, query, queryOne, scalar } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const DAL_RegistrationOrLogin = require('../../lib/member/DAL_RegistrationOrLogin');
const GetIP = require('../../lib/member/GetIP');

const DB = 'affiliate';
const TowFADetails = ['ROWNUMBER', 'TSTID', 'SECURITYTYPE', 'ACTIVE'];
const userNameOf = (u) => (u.userName != null ? u.userName : u.username);

// MemberAuthentication(): fills ViewBag.MEMBERAUTHENTICATION and returns Json("")
async function MemberAuthentication(req, ViewBag) {
  const row = await queryOne(DB, 'SELECT coalesce(ISSMS,0) as issms, coalesce(ISEMAIL,0) as isemail FROM TBL_MEMBERAUTHENTICATION WHERE REGNO = @Plid AND STATUS = 1 limit 1', { Plid: Number(req.user.plid) });
  if (row != null) ViewBag.MEMBERAUTHENTICATION = { ISSMS: Number(row.issms), ISEMAIL: Number(row.isemail) };
}

// private history(...) - never called by any action in the legacy controller; kept for completeness (not routed)
// eslint-disable-next-line no-unused-vars
async function history(req, Plid, OldPassword, NewPassword, ConfirmPassword, Status, Type) {
  Status = Status === '1' ? 'success' : 'Failed';
  const host = String(req.hostname || '');
  let IAddress = '';
  if (host.toLowerCase() === 'localhost') IAddress = '67.225.214.45';
  else IAddress = await GetIP.GetLocalIP(req);
  const url = 'https://extreme-ip-lookup.com/json/' + IAddress;
  const location = (await axios.get(url)).data;
  sessionStore.set(req, 'COUNTRYNAME', location.country);
  sessionStore.set(req, 'STATENAME', location.region);
  sessionStore.set(req, 'CITYNAME', location.city);
  sessionStore.set(req, 'Latitude', location.lat);
  sessionStore.set(req, 'longitude', location.lon);
  await proc(DB, 'usp_changepasswordhistory', {
    plid: Plid, username: userNameOf(req.user), oldpassword: OldPassword, newpassword: NewPassword, confirmpassword: ConfirmPassword,
    ipaddress: IAddress, latitude: sessionStore.get(req, 'Latitude'), longitude: sessionStore.get(req, 'longitude'), type: Type, status: Status,
  });
}

// auth (uses Session["Plid"]). route-config: url "referral/security" (id optional)
router.all(['/member/separte_ga/Index{/:id}', '/member/separte_ga', '/member/referral/security'], auth, asyncHandler(async (req, res) => {
  const { sms, email, loginhistory, chngpassword } = req.p;
  const ViewBag = {};
  if (sms != null) {
    ViewBag.smscls = 'active';
    ViewBag.emailcls = '1';
    ViewBag.loginhistory = '1';
  } else {
    ViewBag.smscls = '';
  }
  if (email != null) {
    ViewBag.emailcls = 'active';
    ViewBag.smscls = '1';
  }
  if (loginhistory != null) {
    ViewBag.loginhistory = 'active';
    ViewBag.emailcls = '1';
    ViewBag.smscls = '1';
    ViewBag.chngpassword = '1';
  }
  if (chngpassword != null) {
    ViewBag.chngpassword = 'active';
    ViewBag.loginhistory = '1';
    ViewBag.emailcls = '1';
    ViewBag.smscls = '1';
  }
  await MemberAuthentication(req, ViewBag);
  const Plid = Number(req.user.plid);
  const row = await queryOne(DB, "select active from settings where caption = 'Password Camplacity' limit 1");
  if (row != null) ViewBag.active = row.active;
  const TowFalist = mapRows(await proc(DB, 'usp_get2fasecurity'), TowFADetails);
  ViewBag.TwoFADetails = TowFalist;
  const v = await scalar(DB, 'select IsVerify from MEMBER_LOGIN where REGNO = @Plid limit 1', { Plid });
  ViewBag.IsActive = v === true || v === 1 || v === '1';
  res.json({ View: '~/Views/CustomerPanel/separte_ga/Index.cshtml', ViewBag });
}));

// auth (uses Session["Plid"]) - legacy returns Json("")
router.all('/member/separte_ga/MemberAuthentication{/:id}', auth, asyncHandler(async (req, res) => {
  await MemberAuthentication(req, {});
  res.json('');
}));

// auth
router.all('/member/separte_ga/GenerateOTPForChangePassword{/:id}', auth, asyncHandler(async (req, res) => {
  const Password = req.p.Password;
  let returnmessage = '';
  try {
    const OTP = String(UtilityClass.RandomNumberStringByLength(6));
    const Plid = Number(req.user.plid);
    sessionStore.set(req, 'SessionPasswordUpdateOTP', OTP);
    const validUser = await DAL_RegistrationOrLogin.checkUserDetailsByPLID(Math.trunc(Plid), UtilityClass.Encryptword(Password));
    if (validUser > 0) {
      const Member_Details = await queryOne(DB, 'select * from member_master where regno = @Plid limit 1', { Plid });
      const msg = await queryOne(DB, 'select * from tbl_smsaction where id = 1068 limit 1');
      const mail = await queryOne(DB, 'select * from tbl_emailaction where eid = 1062 limit 1');
      const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(Member_Details.username, msg.sms_content, Member_Details.username, OTP, 2);
      const DynamicMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(Member_Details.username, mail.email_content, Member_Details.emailid, OTP, 51, '', '', Member_Details.regno);
      let membersmsactive = Number(await scalar(DB, 'SELECT COUNT(1) FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS=1 AND STATUS=1 AND REGNO = @Plid', { Plid })) || 0;
      let memberemailactive = Number(await scalar(DB, 'SELECT COUNT(1) FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL=1 AND STATUS=1 AND REGNO = @Plid', { Plid })) || 0;
      // legacy forces both flags to 0 right after reading them (OTP is bypassed)
      membersmsactive = 0;
      memberemailactive = 0;
      if (membersmsactive === 1) {
        returnmessage = 'OTP SENT SMS';
        Promise.resolve(UtilityClass.SendSMSWithAPI(Member_Details.mobile, messg, '1')).catch((e) => console.error(e.message));
      }
      if (memberemailactive === 1) {
        returnmessage = 'OTP SENT EMAIL';
        Promise.resolve(UtilityClass.SendEmailByApiSetting(Member_Details.username, '', '', '', '', '', Member_Details.emailid.toLowerCase(), mail.email_subject, DynamicMsg, null)).catch((e) => console.error(e.message));
      }
      if (membersmsactive === 1 && memberemailactive === 1) {
        returnmessage = 'OTP SENT ON BOTH EMIAL/MOBILE';
      }
      if (membersmsactive === 0 && memberemailactive === 0) {
        returnmessage = 'OTP BY PASS';
      }
    } else {
      returnmessage = 'Your Old Password is Wrong';
      return res.json(returnmessage);
    }
    return res.json(returnmessage);
  } catch (Ex) {
    returnmessage = Ex.message;
    return res.json(returnmessage);
  }
}));

// auth (legacy: Session["Plid"] == null -> "This Page Has Been expired ! Please Again Login")
router.all('/member/separte_ga/UpdatePassword{/:id}', auth, asyncHandler(async (req, res) => {
  const { OldPassword, NewPassword, ConfirmPassword, MobileOTP, EmilaOTP } = req.p;
  let resValue = '';
  try {
    const Plid = Number(req.user.plid);
    const validUser = await DAL_RegistrationOrLogin.checkUserDetailsByPLID(Math.trunc(Plid), UtilityClass.Encryptword(OldPassword));
    if (validUser > 0) {
      let membersmsactive = Number(await scalar(DB, 'SELECT COUNT(1) FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS=1 AND STATUS=1 AND REGNO = @Plid', { Plid })) || 0;
      let memberemailactive = Number(await scalar(DB, 'SELECT COUNT(1) FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL=1 AND STATUS=1 AND REGNO = @Plid', { Plid })) || 0;
      // legacy forces both flags to 0 right after reading them
      membersmsactive = 0;
      memberemailactive = 0;
      if (membersmsactive === 1) {
        if (String(sessionStore.get(req, 'SessionPasswordUpdateOTP')) !== MobileOTP) {
          resValue = 'You have Enterd Wrong Mobile OTP';
          return res.json(resValue);
        }
      }
      if (memberemailactive === 1) {
        if (String(sessionStore.get(req, 'SessionPasswordUpdateOTP')) !== EmilaOTP) {
          resValue = 'You have Enterd Wrong Email OTP';
          return res.json(resValue);
        }
      }
      // legacy also passed an unused @Mode parameter (not referenced by the SQL text)
      const out = await procOne(DB, 'usp_contactpasswordchange', {
        plid: Plid, oldpass: UtilityClass.Encryptword(OldPassword), newpass: UtilityClass.Encryptword(NewPassword), confpass: UtilityClass.Encryptword(ConfirmPassword),
      });
      resValue = out && out.intresult != null ? String(out.intresult) : '';
      if (resValue === '1') {
        resValue = 'success';
        sessionStore.set(req, 'SessionPasswordUpdateOTP', null);
        return res.json(resValue);
      }
      return res.json(resValue);
    }
    resValue = 'Your Old Password is Wrong';
    return res.json(resValue);
  } catch (Exp) {
    resValue = Exp.message;
    return res.json(resValue);
  }
}));

module.exports = router;
