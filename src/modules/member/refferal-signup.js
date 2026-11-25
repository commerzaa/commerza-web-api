'use strict';
/**
 * Port of Member/Common/Controllers/refferal_signupController.cs (controller "refferal_signup", 9 actions)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: signup -> "PQ_slash_o_plus_j_plus_QNFZ5r4CiihK9Cwx/{Referrelcode}" => referrel_signup
 * PORT-NOTE: Session values of anonymous visitors (transids, VerificationCodeForMobile, R1, CURRENCYCODE, CountryName, TempData["ml"]) live in
 *   utils/sessionStore (anon subject = client IP). SignIn success body is now {result:'1', token, ...Login values} (legacy: bare "1"); other strings unchanged.
 * PORT-NOTE: Session["Member_User_Menu"] is put in the JWT (claim member_user_menu) together with every Login property (lower-cased keys).
 */
const express = require('express');
const axios = require('axios');
const config = require('../../config');
const { query, queryOne, scalar, exec, proc } = require('../../db');
const { mapRows, mapRow } = require('../../utils/shape');
const { signToken } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');
const GetIP = require('../../lib/member/GetIP');
const Security_Key = require('../../lib/member/Security_Key');
const DAL_RegistrationOrLogin = require('../../lib/member/DAL_RegistrationOrLogin');
const WebsiteDetail = require('../../lib/member/WebsiteDetail');

const router = express.Router();
const DB = 'affiliate';
const C = 'refferal_signup';

const s = (v) => (v === null || v === undefined ? '' : String(v));
const colOf = (rows, n) => {
  const r = Array.isArray(rows) ? rows[0] : rows;
  if (!r) return null;
  const k = Object.keys(r).find((x) => x.toLowerCase() === n.toLowerCase());
  return k === undefined ? null : r[k];
};
async function errIns(req, e, proc_) {
  try { await new DataUtility().ErrorInsert(0, e && e.message, proc_, 0, req.path); } catch (_) { /* ignore */ }
}
/** non-nullable action parameter of type int (MVC throws when it is missing / not numeric) */
function reqInt(v, name) {
  const n = parseInt(v, 10);
  if (v === undefined || v === null || v === '' || Number.isNaN(n)) {
    throw new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Int32'.`);
  }
  return n;
}
function readCookie(req, name) {
  const h = req.headers && req.headers.cookie;
  if (!h) return null;
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) { try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (_) { return part.slice(i + 1).trim(); } }
  }
  return null;
}
const MONTH = () => new Date(Date.now() + 30 * 24 * 3600 * 1000);
const setCookie = (res, name, value) => res.cookie(name, value, { expires: MONTH() });
const P_MENU = ['mid', 'mainMenuTitle', 'mainhref', 'aiClass', 'bClass', 'sid', 'subMenuTitle', 'subhref', 'isEdit', 'HeaderClass', 'isDelete', 'Active', 'rid', 'active', 'userRight_isEdit',
  'mainMenuView', 'mainMenuEdit', 'subMenuView', 'subMenuEdit', 'submenuChecked'];
const P_PERMITTED = ['FID', 'Status', 'VALIDATIONACTIVE', 'ACTIVE', 'FIELDNAME'];

async function ValidateCaptcha1(response) {
  const secret = config.app.secretkey || '';
  const r = await axios.get(`https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${response}`, { transformResponse: (x) => x });
  const captchaResponse = JSON.parse(r.data);
  return Boolean(captchaResponse.success);
}

async function loadMemberMenu() {
  return mapRows(await proc(DB, 'usp_pickadminuserrights_memberpanel', { empid: 1 }), P_MENU);
}
function loginPayload(ObjLogin, menu) {
  const payload = {};
  for (const k of Object.keys(ObjLogin)) payload[k.toLowerCase()] = ObjLogin[k];
  return signToken({ ...payload, userType: 'member', plid: payload.plid, member_user_menu: menu });
}
const okLogin = (ObjLogin, menu) => ({ result: '1', token: loginPayload(ObjLogin, menu), ...ObjLogin, Member_User_Menu: menu });

// ---- referrel_signup ---------------------------------------------------------------------------------------
// public
router.all([`/member/${C}/referrel_signup{/:Referrelcode}`, '/member/PQ_slash_o_plus_j_plus_QNFZ5r4CiihK9Cwx{/:Referrelcode}'], asyncHandler(async (req, res) => {
  const { Referrelcode } = req.p;
  const ViewBag = {};
  try {
    let TLPMID = 0;
    let respCookie = null; // Response.Cookies["Referrelcode"].Value of this request
    if (Referrelcode !== undefined && Referrelcode !== null && Referrelcode !== '') {
      const row = await queryOne(DB, 'select * from portal_login where username=@u and isreferralaccepted=1 limit 1', { u: Referrelcode });
      if (row) {
        ViewBag.PageNotFound = 'Ok';
        setCookie(res, 'Referrelcode', Referrelcode);
        respCookie = Referrelcode;
        TLPMID = row.tlpmid;
      }
    } else {
      const rc = readCookie(req, 'Referrelcode');
      if (rc === null || rc === '') {
        setCookie(res, 'Referrelcode', '');
        respCookie = '';
      }
    }
    const reqCookie = readCookie(req, 'Referrelcode');
    // PORT-NOTE: ASP.NET mirrors cookies written to Response into Request.Cookies, so a cookie set above also satisfies this check
    if (reqCookie !== null || respCookie !== null) {
      const MyCookieReferrelcode = respCookie;
      if (s(MyCookieReferrelcode) !== '') {
        ViewBag.Referrelid = MyCookieReferrelcode;
        setCookie(res, 'Referrelcode', ViewBag.Referrelid);
      } else {
        ViewBag.Referrelid = reqCookie !== null ? reqCookie : s(respCookie);
        setCookie(res, 'Referrelcode', ViewBag.Referrelid);
      }
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

    ViewBag.Side = 0;
    const referalid = ViewBag.Referrelid;
    let Active = 0;
    const Side = await queryOne(DB, 'select * from member_master where username=@u limit 1', { u: referalid === undefined ? null : referalid });
    if (Side) ViewBag.Side = Side.defaultsponserside;
    const detRows = await query(DB, "SELECT coalesce(fieldname,'') as fieldname FROM tbl_detailspagemasterforregistration ORDER BY displayshow ASC");
    const Details = detRows.map((r) => r.fieldname);
    ViewBag.Details = Details;

    const rows = await queryOne(DB, "select * from settings where caption='Transaction Pin' limit 1");
    if (rows) {
      if (rows.active === false || rows.active === 0) Active = 0; else Active = 1;
      ViewBag.Transpin = Active;
      ViewBag.Limit = Math.round(Number(rows.limits));
    }
    return res.json({ Model: ViewBag.Details, ViewBag });
  } catch (ExpObj) {
    ViewBag.Message = ExpObj.message;
    await errIns(req, ExpObj, 'referrel_signup');
    return res.json({ redirect: '/page-not-found' });
  }
}));

// ---- Logout ----------------------------------------------------------------------------------------------------
// public
router.all(`/member/${C}/Logout{/:id}`, asyncHandler(async (req, res) => {
  // Session.Abandon(): the JWT is dropped by the client
  res.json('Logout');
}));

// ---- ValidateMobile ----------------------------------------------------------------------------------------------
// public
router.all(`/member/${C}/ValidateMobile{/:id}`, asyncHandler(async (req, res) => {
  const { UserName, EmailId, MobileNo } = req.p;
  // PORT-NOTE: @INTRESULT / @VERIFICATIONCODE OUT params are read from the same-named columns of the result row
  const row = await proc(DB, 'usp_verificationcode', { username: s(UserName).trim(), emailid: s(EmailId).trim(), mobileno: s(MobileNo).trim() });
  const IntOutPutResult = s(colOf(row, 'intresult'));
  const VerificationCodeForMobile = s(colOf(row, 'verificationcode'));
  sessionStore.set(req, 'VerificationCodeForMobile', VerificationCodeForMobile);
  if (IntOutPutResult === '1') {
    Promise.resolve().then(() => UtilityClass.SendMsgOnMobile(MobileNo, 'Verification Code:' + VerificationCodeForMobile + ' Please Use This Verification Code For Verify Your Mobile No.')).catch(() => {});
    return res.json('1^Verification link has been sent to your Mobile No.please verify your Mobile No.^' + VerificationCodeForMobile);
  } else if (IntOutPutResult === '2') {
    return res.json('2^Email Id Already Exist.^' + VerificationCodeForMobile);
  } else if (IntOutPutResult === '5') {
    return res.json('5^User Name Already Exist.^' + VerificationCodeForMobile);
  } else if (IntOutPutResult === '6') {
    return res.json('6^This Mobile Number is Already Exist.^' + VerificationCodeForMobile);
  }
  return res.json('0^Some Error Occur Here.^' + VerificationCodeForMobile);
}));

// ---- SignIn --------------------------------------------------------------------------------------------------------
// public
router.all(`/member/${C}/SignIn{/:id}`, asyncHandler(async (req, res) => {
  const { LoginID, GoogleCaptcha } = req.p;
  let { Password } = req.p;
  if (GoogleCaptcha !== '' && GoogleCaptcha !== null && GoogleCaptcha !== undefined) {
    const isCapthcaValid = await ValidateCaptcha1(GoogleCaptcha);
    if (!isCapthcaValid) return res.json('Invalid Captcha.');
  }
  let ReturnOutPut = '1';
  Password = await UtilityClass.Encryptword(Password);
  const ip = await GetIP.GetLocalIP(req);
  const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(LoginID, Password, ip);
  if (ObjLogin == null) {
    ReturnOutPut = '0';
  } else {
    const transids = sessionStore.get(req, 'transids');
    if (transids === undefined || transids === null) throw new Error('Object reference not set to an instance of an object.');
    if (parseInt(String(transids), 10) === 0) {
      let objs = new Security_Key();
      objs = await objs.Get_Security_Key(ObjLogin.Plid);
      if (objs != null) {
        objs.plid = parseInt(ObjLogin.Plid, 10);
        sessionStore.set(req, 'ml', objs); // TempData["ml"]
        const gakey = '2';
        ReturnOutPut = gakey + '^' + LoginID + '^' + (await UtilityClass.Decryptword(Password));
        return res.json(ReturnOutPut);
      }
    }
    const menu = await loadMemberMenu();
    return res.json(okLogin(ObjLogin, menu));
  }
  return res.json(ReturnOutPut);
}));

// ---- SignIn1 ----------------------------------------------------------------------------------------------------
// public
router.all(`/member/${C}/SignIn1{/:id}`, asyncHandler(async (req, res) => {
  const { LoginID, gakey } = req.p;
  let { Password } = req.p;
  let ReturnOutPut = '1';
  Password = await UtilityClass.Encryptword(Password);
  const ip = await GetIP.GetLocalIP(req);
  const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(LoginID, Password, ip);
  if (ObjLogin == null) {
    ReturnOutPut = '0';
  } else {
    ReturnOutPut = '1';
  }
  if (ObjLogin != null) { // Session["Plid"] != null
    let objs = new Security_Key();
    objs = await objs.Get_Security_Key(ObjLogin.Plid);
    if (objs != null) {
      const ActiveKey = objs.Status;
      const ValidRandomNo = await DAL_RegistrationOrLogin.CheckRandomNo(parseInt(ObjLogin.Plid, 10));
      if (ActiveKey === 1) {
        if (!(await objs.Check_GaKey(ObjLogin.Plid, ValidRandomNo, gakey))) {
          ReturnOutPut = 'Please enter valid GA key !';
          return res.json(ReturnOutPut);
        }
      }
    }
  }
  // legacy: Session["Plid"] = ObjLogin (even when null) and the menu is loaded; with a null login the C# would throw below only in the view layer
  if (ObjLogin == null) return res.json('1');
  const menu = await loadMemberMenu();
  return res.json(okLogin(ObjLogin, menu));
}));

// ---- ForgetPassword ---------------------------------------------------------------------------------------------
// public
router.all(`/member/${C}/ForgetPassword{/:id}`, asyncHandler(async (req, res) => {
  const { Getemailid } = req.p;
  try {
    const ReturnOutPut = 1;
    const Row = await queryOne(DB, 'select * from portal_login where username=@u limit 1', { u: Getemailid });
    if (Row === null) {
      return res.json('0');
    }
    try {
      let ResValue = '';
      const Emailid = Row.emailid;
      const subject = 'Forgot Password';
      const rndnumber = String(Math.floor(Math.random() * 2147483647));
      let Encryt = await UtilityClass.Encryptword(Row.loginid);
      Encryt = Encryt + '/' + rndnumber;

      // Start Mail and Sms Sent Dynamic
      const smscontent = await queryOne(DB, 'select * from tbl_smsaction where id=15 limit 1');
      const emailcontent = await queryOne(DB, 'select * from tbl_emailaction where eid=12 limit 1');
      let Emailcont = await UtilityClass.FindingEmailContentWithUserIdPassword(Row.username, emailcontent.email_content, s(Emailid).toLowerCase(), '', 4, '');
      Emailcont = Emailcont.split('$$Encryt$$').join(Encryt);
      let Smsconte = await UtilityClass.FindingSmsContentWithUserIdPassword(Row.username, smscontent.sms_content, Row.loginid, '', 8);
      Smsconte = Smsconte.split('$$Encryt$$').join(Encryt);
      if (Number(smscontent.sms_send_status) === 1) {
        Promise.resolve().then(() => UtilityClass.SendSMSWithAPI(Row.phone, Smsconte, '1')).catch(() => {});
      }
      if (Number(emailcontent.email_send_status) === 1) {
        Promise.resolve().then(() => UtilityClass.SendEmailByApiSetting(Row.username, '', '', '', '', '', Emailid, subject, Emailcont, null, '', '')).catch(() => {});
      }
      if (Number(emailcontent.email_send_status) === 0 && Number(smscontent.sms_send_status) === 0) {
        ResValue = 'OTP BYPASS';
      }
      void ResValue;

      // Maintaining the Password Change History
      await exec(DB, 'Insert Into tbl_password_change_history (plid,oldpassword,resetlink,changedate,islinkexpired) Values (@plid,@pw,@link,now(),0)',
        { plid: Row.plid, pw: Row.password, link: Encryt });
    } catch (ExpObj) {
      await errIns(req, ExpObj, 'Start Mail and Sms Sent Dynamic');
    }
    return res.json(String(ReturnOutPut));
  } catch (ExpObj) {
    return res.json(ExpObj.message);
  }
}));

// ---- SignUpNow ----------------------------------------------------------------------------------------------------
// public
router.all(`/member/${C}/SignUpNow{/:id}`, asyncHandler(async (req, res) => {
  let { email, password, username, MobileNo, Sponser, VerificationCode, Cityname, FullName, GoogleCaptcha, TransactionPassword, side, DOB, parentid, Lastname, StateName } = req.p;
  try {
    const Country = reqInt(req.p.Country, 'Country');
    const State = reqInt(req.p.State, 'State');
    const chkreffval = reqInt(req.p.chkreffval, 'chkreffval');
    const Gender = reqInt(req.p.Gender, 'Gender');
    const Ctid = reqInt(req.p.Ctid, 'Ctid');
    void VerificationCode;
    if (GoogleCaptcha !== '' && GoogleCaptcha !== null && GoogleCaptcha !== undefined) {
      const isCapthcaValid = await ValidateCaptcha1(GoogleCaptcha);
      if (!isCapthcaValid) return res.json('Invalid Captcha.');
    }
    if (username.length !== username.replace(/ /g, '').length) {
      return res.json('User name must not contain space.');
    }
    const ip_address = await GetIP.GetLocalIP(req);
    password = await UtilityClass.Encryptword(password);

    if (TransactionPassword === undefined || TransactionPassword === null || TransactionPassword === '' || TransactionPassword === 'invalidpassword') {
      TransactionPassword = 'user@123';
      TransactionPassword = await UtilityClass.Encryptword(TransactionPassword);
    } else {
      TransactionPassword = await UtilityClass.Encryptword(TransactionPassword);
    }
    if (s(password).trim() === '' || s(TransactionPassword).trim() === '') {
      return res.json(`Password must be at least 8 characters long it must contain at least
                a number and alphabet and a special character.`);
    }
    const validate_Var = await DAL_RegistrationOrLogin.validate(email, username, password);
    if (validate_Var !== 'ok') {
      return res.json(validate_Var);
    }
    if (Sponser !== undefined && Sponser !== null && Sponser !== '') {
      const row = await queryOne(DB, 'select * from portal_login where username=@u limit 1', { u: Sponser });
      if (row === null) {
        return res.json('Invalid Sponser Id.');
      }
    }

    const currency = s(sessionStore.get(req, 'CURRENCYCODE'));
    const IntOutPutResult = await DAL_RegistrationOrLogin.Registration(Sponser, email, password, currency, s(sessionStore.get(req, 'CountryName')), username, ip_address, MobileNo,
      'referral-login', Country, State, Cityname, FullName, side, chkreffval, parentid, Gender, DOB, '', Ctid, Lastname, StateName);
    if (IntOutPutResult === '1') return res.json('success');
    else if (IntOutPutResult === '5') return res.json('User Name Already Exist.');
    else if (IntOutPutResult === '6') return res.json('Mobile No. Already Exist.');
    else if (IntOutPutResult === '7') return res.json('Mobile No. Already Exist.');
    else if (IntOutPutResult === '10') return res.json('You can not add more member');
    return res.json('Registration Failed Please Try Again.');
  } catch (ExpObj) {
    return res.json(ExpObj.message);
  }
}));

// ---- CheckCheckboxOnTheBehalfOfPermission ---------------------------------------------------------------------------
// public
router.all(`/member/${C}/CheckCheckboxOnTheBehalfOfPermission{/:id}`, asyncHandler(async (req, res) => {
  const Details = await proc(DB, 'usp_getdataforregistration', { mode: 1 });
  res.json(mapRows(Details, P_PERMITTED));
}));

// ---- vcode -----------------------------------------------------------------------------------------------------------
// public
router.all(`/member/${C}/vcode{/:id}`, asyncHandler(async (req, res) => {
  const { vcode, mobilephone } = req.p;
  let Details = '';
  if (vcode === '') {
    sessionStore.set(req, 'R1', null);
    const R11 = Math.floor(Math.random() * (555555 - 100000)) + 100000;
    sessionStore.set(req, 'R1', R11);
    Details = 'otp gernate';
    Promise.resolve().then(async () => {
      if (mobilephone !== '') {
        await UtilityClass.SendMsgOnMobile(mobilephone, 'Verification Code:' + R11 + ' Please Use This Verification Code For Registration Your Contact No.');
      }
    }).catch(() => {});
  } else if (vcode !== '') {
    const r1 = sessionStore.get(req, 'R1');
    if (vcode !== s(r1)) {
      return res.json('invalid otp');
    }
    Details = 'ok';
    sessionStore.set(req, 'R1', null);
  }
  return res.json(Details);
}));

module.exports = router;
