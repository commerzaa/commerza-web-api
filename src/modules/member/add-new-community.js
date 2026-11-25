'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/AddNewCommunity.cs (AddNewCommunityController, 8 actions)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: AddNewCommunity -> referral/add-new-referral (action referrel_signup)
 * PORT-NOTE: referrel_signup reads Session["plid"].UserName only when rootid is supplied; the page lives in the member panel so it is protected with auth.
 * PORT-NOTE: SignIn success body is {result:'1', token, ...Login values, Member_User_Menu}; the static helpers ValidateCaptcha / EncryptFunction are not actions (internal).
 */
const express = require('express');
const axios = require('axios');
const config = require('../../config');
const { query, queryOne, scalar, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth, signToken } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const GetIP = require('../../lib/member/GetIP');
const Security_Key = require('../../lib/member/Security_Key');
const DAL_RegistrationOrLogin = require('../../lib/member/DAL_RegistrationOrLogin');
const WebsiteDetail = require('../../lib/member/WebsiteDetail');
const CustomEncriptionAndDecription = require('../../lib/member/CustomEncriptionAndDecription');

const router = express.Router();
const DB = 'affiliate';
const C = 'AddNewCommunity';

const s = (v) => (v === null || v === undefined ? '' : String(v));
const reqInt = (v, name) => {
  const n = parseInt(v, 10);
  if (v === undefined || v === null || v === '' || Number.isNaN(n)) {
    throw new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Int32'.`);
  }
  return n;
};
const optInt = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const at = (arr, i) => { if (i >= arr.length) throw new Error('Index was outside the bounds of the array.'); return arr[i]; };
function readCookie(req, name) {
  const h = req.headers && req.headers.cookie;
  if (!h) return null;
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) { try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (_) { return part.slice(i + 1).trim(); } }
  }
  return null;
}
const P_MENU = ['mid', 'mainMenuTitle', 'mainhref', 'aiClass', 'bClass', 'sid', 'subMenuTitle', 'subhref', 'isEdit', 'HeaderClass', 'isDelete', 'Active', 'rid', 'active', 'userRight_isEdit',
  'mainMenuView', 'mainMenuEdit', 'subMenuView', 'subMenuEdit', 'submenuChecked'];
const P_PERMITTED = ['FID', 'Status', 'VALIDATIONACTIVE', 'ACTIVE', 'FIELDNAME'];
const P_STATE = ['SID', 'CID', 'STATENAME', 'SCODE', 'SACTIVE'];
const P_CITY = ['CTID', 'CID', 'SID', 'CITYNAME', 'ACTIVE'];

async function ValidateCaptcha(response) {
  const secret = config.app.secretkey || '';
  const r = await axios.get(`https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${response}`, { transformResponse: (x) => x });
  return Boolean(JSON.parse(r.data).success);
}
// static EncryptFunction(number) (not an action)
// eslint-disable-next-line no-unused-vars
async function EncryptFunction(number) { return new CustomEncriptionAndDecription().encryption(number); }

// ---- referrel_signup ---------------------------------------------------------------------------------------
// auth
router.all([`/member/${C}/referrel_signup{/:id}`, '/member/referral/add-new-referral'], auth, asyncHandler(async (req, res) => {
  let { rootid } = req.p;
  let side = optInt(req.p.side);
  const ViewBag = {};
  try {
    ViewBag.LoginidPassword = String(await UtilityClass.RandomStringByLength(8));
    const IactiveLoginPass = await scalar(DB, 'select showactive from tbl_detailspagemasterforregistration where tdpmfrid=23 limit 1');
    ViewBag.IsActiveLoginPass = IactiveLoginPass === null ? 0 : IactiveLoginPass;
    const cb = await scalar(DB, "select active from settings where caption='Password Camplacity' limit 1");
    ViewBag.complexcitybarcheck = cb === null ? false : Boolean(cb);

    if (rootid === undefined || rootid === null) rootid = '';
    if (side === null) side = 0;

    const reqCookie = readCookie(req, 'Referrelcode');
    if (reqCookie !== null) {
      // legacy reads Response.Cookies (empty in this request) first, so the request cookie value is used
      ViewBag.Referrelid = reqCookie;
      res.cookie('Referrelcode', ViewBag.Referrelid, { expires: new Date(Date.now() + 30 * 24 * 3600 * 1000) });
      ViewBag.Canonical = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      ViewBag.Title = '';
      ViewBag.MetaDesc = '';
      ViewBag.MetaKeyword = '';
      const ObjWebsiteDescription = await WebsiteDetail.GetWebsiteInfo(3);
      if (ObjWebsiteDescription != null) {
        ViewBag.Title = ObjWebsiteDescription.SeoTitle;
        ViewBag.MetaDesc = ObjWebsiteDescription.SeoDescription;
        ViewBag.MetaKeyword = ObjWebsiteDescription.SeoKeyword;
      }
    }
    if (rootid !== '') {
      const row1 = await queryOne(DB, 'select * from member_master where loginid=@r limit 1', { r: rootid });
      if (row1) {
        ViewBag.Referrelid = req.user.username;
        ViewBag.Side = side;
        ViewBag.rootid = row1.username;
      }
    }
    let Active = 0;
    const detRows = await query(DB, "SELECT coalesce(fieldname,'') as fieldname FROM tbl_detailspagemasterforregistration ORDER BY displayshow ASC");
    ViewBag.Details = detRows.map((r) => r.fieldname);
    const rows = await queryOne(DB, "select * from settings where caption='Transaction Pin' limit 1");
    if (rows) {
      if (rows.active === false || rows.active === 0) Active = 0; else Active = 1;
      ViewBag.Transpin = Active;
      ViewBag.Limit = Math.round(Number(rows.limits));
    }
    return res.json({ Model: ViewBag.Details, ViewBag });
  } catch (ExpObj) {
    ViewBag.Message = ExpObj.message;
    return res.json({ redirect: '/page-not-found' });
  }
}));

// ---- ValidateMobile ----------------------------------------------------------------------------------------------
// public
router.all(`/member/${C}/ValidateMobile{/:id}`, asyncHandler(async (req, res) => {
  const { UserName, EmailId, MobileNo } = req.p;
  const rows = await proc(DB, 'usp_verificationcode', { username: s(UserName).trim(), emailid: s(EmailId).trim(), mobileno: s(MobileNo).trim() });
  const r = rows[0] || {};
  const pick = (n) => { const k = Object.keys(r).find((x) => x.toLowerCase() === n); return k === undefined ? '' : s(r[k]); };
  const IntOutPutResult = pick('intresult');
  const VerificationCodeForMobile = pick('verificationcode');
  sessionStore.set(req, 'VerificationCodeForMobile', VerificationCodeForMobile);
  if (IntOutPutResult === '1') {
    Promise.resolve().then(() => UtilityClass.SendMsgOnMobile(MobileNo, 'Verification Code:' + VerificationCodeForMobile + ' Please Use This Verification Code For Verify Your Mobile No.')).catch(() => {});
    return res.json('1^Verification link has been sent to your Mobile No.please verify your Mobile No.^' + VerificationCodeForMobile);
  } else if (IntOutPutResult === '2') return res.json('2^Email Id Already Exist.^' + VerificationCodeForMobile);
  else if (IntOutPutResult === '5') return res.json('5^User Name Already Exist.^' + VerificationCodeForMobile);
  else if (IntOutPutResult === '6') return res.json('6^This Mobile Number is Already Exist.^' + VerificationCodeForMobile);
  return res.json('0^Some Error Occur Here.^' + VerificationCodeForMobile);
}));

// ---- SignIn --------------------------------------------------------------------------------------------------------
// public
router.all(`/member/${C}/SignIn{/:id}`, asyncHandler(async (req, res) => {
  const { LoginID } = req.p;
  let { Password } = req.p;
  let ReturnOutPut = '1';
  Password = await UtilityClass.Encryptword(Password);
  const ip = await GetIP.GetLocalIP(req);
  const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(LoginID, Password, ip);
  if (ObjLogin == null) {
    ReturnOutPut = '0';
  } else {
    let objs = new Security_Key();
    objs = await objs.Get_Security_Key(ObjLogin.Plid);
    if (objs != null) {
      objs.plid = parseInt(ObjLogin.Plid, 10);
      sessionStore.set(req, 'ml', objs); // TempData["ml"]
      const gakey = '2';
      ReturnOutPut = gakey + '^' + LoginID + '^' + (await UtilityClass.Decryptword(Password));
      return res.json(ReturnOutPut);
    }
    const menu = mapRows(await proc(DB, 'usp_pickadminuserrights_memberpanel', { empid: 1 }), P_MENU);
    const payload = {};
    for (const k of Object.keys(ObjLogin)) payload[k.toLowerCase()] = ObjLogin[k];
    const token = signToken({ ...payload, userType: 'member', plid: payload.plid, member_user_menu: menu });
    return res.json({ result: '1', token, ...ObjLogin, Member_User_Menu: menu });
  }
  return res.json(ReturnOutPut);
}));

// ---- SignUpNow -------------------------------------------------------------------------------------------------------
// public
router.all(`/member/${C}/SignUpNow{/:id}`, asyncHandler(async (req, res) => {
  const p = req.p;
  let { password, TransactionPassword } = p;
  const { email, username, MobileNo, Sponser, GoogleCaptcha, Cityname, FullName, side, placememntid, DOB, Lastname, StateName, Otp, Pincode, CouponCode, Btcaddress, Facebooklink, Address, pancard, MritalStatus } = p;
  try {
    const Country = reqInt(p.Country, 'Country');
    const State = reqInt(p.State, 'State');
    const chkreffval = reqInt(p.chkreffval, 'chkreffval');
    const Gender = reqInt(p.Gender, 'Gender');
    const ctid = reqInt(p.ctid, 'ctid');
    const noofjoin = reqInt(p.noofjoin, 'noofjoin');
    let OtpShowActive = '0';
    let UserDefind = 0;
    let IsMobileVerified = 0;
    const row1 = await queryOne(DB, 'select regno from member_master where mobile=@m limit 1', { m: MobileNo });
    if (row1) return res.json('Mobile No. Already Exist!!!');
    const row2 = await queryOne(DB, 'select regno from member_master where emailid=@e limit 1', { e: email });
    if (row2) return res.json('Email ID Already Exist!!!');
    const osa = await scalar(DB, 'select showactive from tbl_detailspagemasterforregistration where tdpmfrid=22 limit 1');
    OtpShowActive = String(osa === null ? 0 : osa);
    const ud = await scalar(DB, 'SELECT typeid FROM tbl_user_defined WHERE active=1 limit 1');
    UserDefind = ud === null ? 0 : Number(ud);
    if (OtpShowActive !== '0') {
      const so = sessionStore.get(req, 'SessionOTP');
      if (so === undefined || so === null) throw new Error('Object reference not set to an instance of an object.');
      if (Otp !== String(so)) return res.json('You have Enterd wrong OTP .');
      IsMobileVerified = 1;
    }
    if (GoogleCaptcha !== '' && GoogleCaptcha !== null && GoogleCaptcha !== undefined) {
      if (!(await ValidateCaptcha(GoogleCaptcha))) return res.json('Invalid Captcha.');
    }
    if (username.length !== username.replace(/ /g, '').length) return res.json('User name must not contain space.');

    const ip_address = await GetIP.GetLocalIP(req);
    password = await UtilityClass.Encryptword(password);
    TransactionPassword = await UtilityClass.Encryptword(TransactionPassword);
    if (s(password).trim() === '' || s(TransactionPassword).trim() === '') {
      return res.json(`Password must be at least 8 characters long it must contain at least
                a number and alphabet and a special character.`);
    }
    const validate_Var = await DAL_RegistrationOrLogin.validate(email, username, password);
    if (validate_Var !== 'ok') return res.json(validate_Var);
    if (Sponser !== undefined && Sponser !== null && Sponser !== '') {
      const row = (await proc(DB, 'usp_scalerdata', { mode: 3, identity: Sponser }))[0] || null;
      if (row === null) return res.json('Invalid Sponser Id.');
    }
    const currency = s(sessionStore.get(req, 'CURRENCYCODE'));
    const IntOutPutResult = await DAL_RegistrationOrLogin.Registration(Sponser, email, password, currency, s(sessionStore.get(req, 'CountryName')), username, ip_address, MobileNo, 'login',
      Country, State, Cityname, FullName, side, chkreffval, placememntid, Gender, DOB, pancard, ctid, Lastname, StateName, Pincode, CouponCode, Btcaddress, Facebooklink, Address, MritalStatus,
      IsMobileVerified, noofjoin);
    const UserDefinds = s(IntOutPutResult).split('^');

    if (UserDefind === 1) {
      if (UserDefinds[0] === '1' && at(UserDefinds, 1) !== '' && at(UserDefinds, 2) !== '') return res.json('success' + '^' + UserDefinds[1] + '^' + UserDefinds[2]);
      else if (UserDefinds[0] === '5') return res.json('User Name Already Exist.');
      else if (UserDefinds[0] === '6') return res.json('Mobile No. Already Exist.');
      else if (UserDefinds[0] === '7') return res.json('Mobile No. Already Exist.');
      else if (UserDefinds[0] === '10') return res.json('You can not add more member');
      else if (UserDefinds[0] === '15') return res.json('Invalid Coupon No.');
      else if (UserDefinds[0] === '16') return res.json('Allready Used Coupon No.');
      return res.json('Registration Failed Please Try Again.');
    }
    if (UserDefinds[0] === 'success' && at(UserDefinds, 1) !== '' && at(UserDefinds, 2) !== '') return res.json('success' + '^' + UserDefinds[1] + '^' + UserDefinds[2]);
    else if (UserDefinds[0] === '5') return res.json('User Name Already Exist.');
    else if (UserDefinds[0] === '6') return res.json('Mobile No. Already Exist.');
    else if (UserDefinds[0] === '7') return res.json('Mobile No. Already Exist.');
    else if (UserDefinds[0] === '10') return res.json('You can not add more member');
    else if (UserDefinds[0] === '15') return res.json('Invalid Coupon No.');
    else if (UserDefinds[0] === '16') return res.json('Allready Used Coupon No.');
    return res.json('Registration Failed Please Try Again.');
  } catch (Exp) {
    return res.json(Exp.message);
  }
}));

// ---- BINDSTATEONCID --------------------------------------------------------------------------------------------------
// public
router.all(`/member/${C}/BINDSTATEONCID{/:id}`, asyncHandler(async (req, res) => {
  const CID = reqInt(req.p.CID, 'CID');
  const rows = await query(DB, 'select * from state where cid=@cid and sactive=true order by statename', { cid: CID });
  res.json(mapRows(rows, P_STATE));
}));

// ---- BindCITy ---------------------------------------------------------------------------------------------------------
// public
router.all(`/member/${C}/BindCITy{/:id}`, asyncHandler(async (req, res) => {
  const SID = reqInt(req.p.SID, 'SID');
  const rows = await query(DB, 'select * from city where sid=@sid and active=true order by cityname', { sid: SID });
  res.json(mapRows(rows, P_CITY));
}));

// ---- CheckCheckboxOnTheBehalfOfPermission ------------------------------------------------------------------------
// public
router.all(`/member/${C}/CheckCheckboxOnTheBehalfOfPermission{/:id}`, asyncHandler(async (req, res) => {
  res.json(mapRows(await proc(DB, 'usp_getdataforregistration', { mode: 1 }), P_PERMITTED));
}));

// ---- GenerateOTP -------------------------------------------------------------------------------------------------------
// public
router.all(`/member/${C}/GenerateOTP{/:id}`, asyncHandler(async (req, res) => {
  const { UserName, MobileNumber } = req.p;
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  sessionStore.set(req, 'SessionOTP', OTP);
  const msg = await queryOne(DB, 'select * from tbl_smsaction where id=20 limit 1');
  const Mobilestatus = Number(msg.sms_send_status);
  const osa = await scalar(DB, 'select showactive from tbl_detailspagemasterforregistration where tdpmfrid=24 limit 1');
  const OtpShowActive = String(osa === null ? 0 : osa);
  const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(UserName, msg.sms_content, UserName, OTP, 2);
  if (Mobilestatus === 1) {
    Promise.resolve().then(() => UtilityClass.SendSMSWithAPI(MobileNumber, messg, '1')).catch(() => {});
  }
  returnmessage = 'OTP SENT';
  res.json(returnmessage + '^' + OtpShowActive);
}));

module.exports = router;
