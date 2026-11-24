'use strict';
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { signToken } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const config = require('../../config');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const WebsiteDetail = require('../../lib/franchise/WebsiteDetail');
const GetCountry = require('../../lib/franchise/GetCountry');
const GetIP = require('../../lib/franchise/GetIP');
const DAL_RegistrationOrLogin = require('../../lib/franchise/DAL_RegistrationOrLogin');
const Security_Key = require('../../lib/franchise/Security_Key');
const CS = require('../../lib/franchise/CompanySettings');
const CompanySettings = CS.CompanySettings || CS;
// Port of Franchise\Controllers\VisitorSignupController.cs (controller "visitor_signup"; 13 actions)
// route-config: franchisee/logout -> Logoutmerchant ; reseller-login -> visitor_login ; reseller-signup -> Index
// PORT-NOTE: Session[...] values for anonymous visitors (COUNTRYID/COUNTRYNAME, FavoriteURL, LoginType, VerificationCodeForMobile, TempData["ml"])
//   are kept in utils/sessionStore keyed by client IP (subject "anon:<ip>"). ASP.NET session keys are case-insensitive: "CountryName" == "COUNTRYNAME".
// PORT-NOTE: login responses were bare JSON strings ("1","0","2^..."). On a successful login ("1") the body is now {result:"1", token, ...login values}; other strings unchanged.
// PORT-NOTE: EF entity Portal_Login (table TBL_DISTRIBUTOR) is queried through "portal_login" as the raw SQL of this app does.
const s = (v) => (v === undefined || v === null ? '' : String(v));
const rep = (t, k, v) => t.split(k).join(v === undefined || v === null ? '' : String(v));
const isEmpty = (v) => v === undefined || v === null || v === '';
const g = (o, n) => { if (!o) return undefined; const k = Object.keys(o).find((x) => x.toLowerCase() === n.toLowerCase()); return k === undefined ? undefined : o[k]; };

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
const monthAhead = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; };

async function seoInfo(wid) {
  const o = { Title: '', MetaDesc: '', MetaKeyword: '' };
  const w = await WebsiteDetail.GetWebsiteInfo(wid);
  if (w) { o.Title = w.SeoTitle; o.MetaDesc = w.SeoDescription; o.MetaKeyword = w.SeoKeyword; }
  return o;
}
function pageUrl(req) { return req.protocol + '://' + req.get('host') + req.originalUrl; }

async function ensureCountry(req, ViewBag) {
  if (sessionStore.get(req, 'COUNTRYID') === undefined || sessionStore.get(req, 'COUNTRYID') === null) {
    try {
      const sess = {};
      await GetCountry.InitializeVisitorCountrySession(sess);
      await GetCountry.SettingVisitor('1');
      Object.keys(sess).forEach((k) => sessionStore.set(req, k, sess[k]));
    } catch (ex) {
      ViewBag.Message = ex.message;
    }
  }
}

// public
router.all(['/franchise/visitor_signup/Index{/:id}', '/franchise/reseller-signup'], asyncHandler(async (req, res) => {
  const p = req.p;
  let Source = p.Source;
  let ReferralId = p.ReferralId;
  const ViewBag = {};
  ViewBag.Canonical = pageUrl(req);
  Object.assign(ViewBag, await seoInfo(26));
  await ensureCountry(req, ViewBag);
  ViewBag.Source = Source;
  ViewBag.Referrelid = ReferralId;

  const reqC = parseCookies(req);
  const respC = {};
  const setC = (n, v) => { respC[n] = v; res.cookie(n, v, { expires: monthAhead() }); };
  if (!isEmpty(ReferralId)) {
    ViewBag.PageNotFound = 'Ok';
    setC('ReferralId', ReferralId);
  } else if (reqC.ReferralId === undefined || reqC.ReferralId === '') {
    setC('ReferralId', '');
  }
  if (!isEmpty(Source)) {
    ViewBag.PageNotFound = 'Ok';
    setC('Source', Source);
  } else if (reqC.Source === undefined || reqC.Source === '') {
    setC('Source', '');
  }
  // ASP.NET exposes cookies written to Response in Request.Cookies as well
  const eff = (n) => (respC[n] !== undefined ? respC[n] : reqC[n]);
  if (eff('ReferralId') !== undefined) {
    const mine = respC.ReferralId;
    ViewBag.Referrelid = !isEmpty(mine) ? mine : eff('ReferralId');
    setC('ReferralId', ViewBag.Referrelid);
  }
  if (eff('Source') !== undefined) {
    const mine = respC.Source;
    ViewBag.Source = !isEmpty(mine) ? mine : eff('Source');
    setC('Source', ViewBag.Source);
  }
  if (ViewBag.Source === undefined || ViewBag.Source === null || ViewBag.Source === '') { Source = 'Direct'; ViewBag.Source = 'Direct'; }
  if (ViewBag.Referrelid === undefined || ViewBag.Referrelid === null || ViewBag.Referrelid === '') { ReferralId = 'Root'; ViewBag.Referrelid = 'Root'; }
  res.json(ViewBag);
}));

function loginPage(wid, loginType, viewName) {
  return asyncHandler(async (req, res) => {
    const favoriteurl = req.p.favoriteurl;
    if (favoriteurl !== undefined && favoriteurl !== null) sessionStore.set(req, 'FavoriteURL', favoriteurl);
    sessionStore.set(req, 'LoginType', loginType);
    const ViewBag = { Canonical: pageUrl(req) };
    Object.assign(ViewBag, await seoInfo(wid));
    ViewBag.View = viewName;
    res.json(ViewBag);
  });
}
// public
router.all(['/franchise/visitor_signup/visitor_login{/:id}', '/franchise/reseller-login'], loginPage(27, 1, '~/Views/visitor_signup/visitor_login.cshtml'));
// public
router.all('/franchise/visitor_signup/referrel_login{/:id}', loginPage(29, 2, '~/Views/visitor_signup/referrel_login.cshtml'));
// public
router.all('/franchise/visitor_signup/customer_login{/:id}', loginPage(29, 3, '~/Views/visitor_signup/Customer_Panel_Login.cshtml'));

// public
router.all('/franchise/visitor_signup/referrel_signup{/:id}', asyncHandler(async (req, res) => {
  const { Referrelcode } = req.p;
  const ViewBag = {};
  let TLPMID = 0;
  const reqC = parseCookies(req);
  const respC = {};
  const setC = (n, v) => { respC[n] = v; res.cookie(n, v, { expires: monthAhead() }); };
  if (!isEmpty(Referrelcode)) {
    const row = await db.queryOne('shopping', 'select tlpmid from portal_login where username=@u and isreferralaccepted=1 limit 1', { u: Referrelcode });
    if (row) {
      ViewBag.PageNotFound = 'Ok';
      setC('Referrelcode', Referrelcode);
      TLPMID = row.tlpmid;
    }
  } else if (reqC.Referrelcode === undefined || reqC.Referrelcode === '') {
    setC('Referrelcode', '');
  }
  const cookie = respC.Referrelcode !== undefined ? respC.Referrelcode : reqC.Referrelcode;
  if (cookie !== undefined) {
    const mine = respC.Referrelcode;
    ViewBag.Referrelid = !isEmpty(mine) ? mine : cookie;
    setC('Referrelcode', ViewBag.Referrelid);
    ViewBag.Canonical = '' + CompanySettings.CompanyMerchantURL + '/merchant-signup';
    Object.assign(ViewBag, await seoInfo(3));
  }
  ViewBag.View = '~/Views/visitor_signup/referrel_signup.cshtml';
  res.json(ViewBag);
}));

// public
router.all('/franchise/visitor_signup/customer_signup{/:id}', asyncHandler(async (req, res) => {
  const { Referrelcode, Landingpage, favoriteurl, referralprogram } = req.p;
  const TempData = {};
  const ViewBag = {};
  if (favoriteurl !== undefined && favoriteurl !== null) sessionStore.set(req, 'FavoriteURL', favoriteurl);
  if (referralprogram !== undefined && referralprogram !== null && referralprogram === 'referralprogram') TempData.IsReferralLogin = 1;
  ViewBag.Canonical = pageUrl(req);
  Object.assign(ViewBag, await seoInfo(26));
  await ensureCountry(req, ViewBag);
  ViewBag.Referrelcode = Referrelcode;
  ViewBag.Referrelid = Referrelcode;
  ViewBag.Landingpage = Landingpage;
  ViewBag.View = '~/Views/visitor_signup/Customer_SignUp.cshtml';
  res.json(Object.assign({ TempData }, ViewBag));
}));

// public
router.all('/franchise/visitor_signup/Logout{/:id}', asyncHandler(async (req, res) => {
  // session is replaced by the JWT: the client drops the token
  res.json('Logout');
}));

// public
router.all(['/franchise/visitor_signup/Logoutmerchant{/:id}', '/franchise/franchisee/logout'], asyncHandler(async (req, res) => {
  res.json({ status: 'true', redirect: 'visitor_signup/visitor_login' });
}));

async function SendOTPMail(ToEmailID, Subject, EmailContent) {
  try {
    const tr = nodemailer.createTransport({
      host: config.app.SMPT_HOST,
      port: parseInt(config.app.SMPT_PORT, 10),
      secure: false,
      requireTLS: String(config.app.SMTP_EnableSSL).toLowerCase() === 'true',
      auth: { user: config.app.SMPT_Username, pass: config.app.SMPT_Password },
    });
    try {
      await tr.sendMail({ from: config.app.SMPT_Username, to: ToEmailID, subject: Subject, html: EmailContent });
    } catch (ex) { /* legacy kept the SMTP error text in an unused local */ }
  } catch (ExpObj) { /* legacy swallowed after building unused error info */ }
}

// public
router.all('/franchise/visitor_signup/ValidateMobile{/:id}', asyncHandler(async (req, res) => {
  const UserName = s(req.p.UserName).trim();
  const EmailId = s(req.p.EmailId).trim();
  const MobileNo = s(req.p.MobileNo).trim();
  const r = await db.procOne('shopping', 'usp_verificationcode_reseller', { USERNAME: UserName, EMAILID: EmailId, MOBILENO: MobileNo });
  const IntOutPutResult = r && r.intresult !== undefined && r.intresult !== null ? String(r.intresult) : '';
  const VerificationCodeForMobile = r && r.verificationcode !== undefined && r.verificationcode !== null ? String(r.verificationcode) : '';
  if (VerificationCodeForMobile !== '') {
    await db.exec('shopping', "insert into tbl_smshistory (code,Panel) values (@code,'FRANCHISE')", { code: VerificationCodeForMobile });
  }
  sessionStore.set(req, 'VerificationCodeForMobile', VerificationCodeForMobile);
  if (IntOutPutResult === '1') {
    // background thread in legacy: fire and forget
    SendOTPMail(EmailId, 'Verification', 'We make sure you enjoy hassle-free services from ' + CompanySettings.CompanyName + '. In order to secure the process, the verification code for registration is <b>' + VerificationCodeForMobile + '</b> that will <b>expire in 20 minutes</b>.').catch(() => {});
    return res.json('1^Verification Code has been sent to your Email Id.please verify your Email Id.^' + VerificationCodeForMobile);
  } else if (IntOutPutResult === '2') return res.json('2^Email Id Already Exist.^' + VerificationCodeForMobile);
  else if (IntOutPutResult === '5') return res.json('5^User Name Already Exist.^' + VerificationCodeForMobile);
  else if (IntOutPutResult === '6') return res.json('6^This Mobile Number is Already Exist.^' + VerificationCodeForMobile);
  else if (IntOutPutResult === '7') return res.json('7^You are not Registered Member.^' + VerificationCodeForMobile);
  return res.json('0^Some Error Occur Here.^' + VerificationCodeForMobile);
}));

function buildToken(ObjLogin) {
  const did = g(ObjLogin, 'DID');
  return signToken({
    userType: 'franchise',
    plid: did,
    did,
    pmid: g(ObjLogin, 'Pmid'),
    smdid: g(ObjLogin, 'Smdid'),
    loginid: g(ObjLogin, 'LoginID'),
    username: g(ObjLogin, 'UserName'),
    name: g(ObjLogin, 'Name'),
    emailid: g(ObjLogin, 'EmailId'),
    cid: g(ObjLogin, 'Cid'),
  });
}
const okLogin = (ObjLogin) => ({
  result: '1', token: buildToken(ObjLogin), DID: g(ObjLogin, 'DID'), Pmid: g(ObjLogin, 'Pmid'), Smdid: g(ObjLogin, 'Smdid'), LoginID: g(ObjLogin, 'LoginID'),
  UserName: g(ObjLogin, 'UserName'), Name: g(ObjLogin, 'Name'), EmailId: g(ObjLogin, 'EmailId'), Cid: g(ObjLogin, 'Cid'),
});

// public
router.all('/franchise/visitor_signup/SignIn{/:id}', asyncHandler(async (req, res) => {
  const { LoginID, Password } = req.p;
  let ReturnOutPut = '1';
  const ip = await GetIP.GetLocalIP(req);
  const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(LoginID, Password, ip);
  if (!ObjLogin) {
    ReturnOutPut = '0';
  } else {
    const did = g(ObjLogin, 'DID');
    let objs = new Security_Key();
    objs = await objs.Get_Security_Key(did);
    if (objs) {
      objs.plid = did;
      sessionStore.set(req, 'ml', objs); // TempData["ml"]
      ReturnOutPut = '2' + '^' + LoginID + '^' + Password;
      return res.json(ReturnOutPut);
    }
    return res.json(okLogin(ObjLogin));
  }
  return res.json(ReturnOutPut);
}));

// public
router.all('/franchise/visitor_signup/SignIn1{/:id}', asyncHandler(async (req, res) => {
  const { LoginID, Password, gakey } = req.p;
  let ReturnOutPut = '1';
  const ip = await GetIP.GetLocalIP(req);
  const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(LoginID, Password, ip);
  if (!ObjLogin) ReturnOutPut = '0';
  else {
    ReturnOutPut = '1';
    const did = g(ObjLogin, 'DID');
    let objs = new Security_Key();
    objs = await objs.Get_Security_Key(did);
    if (objs) {
      const ActiveKey = objs.ActiveKey;
      if (ActiveKey === 2) {
        if (!(await objs.Check_GaKey(did, gakey))) {
          return res.json('Please enter valid GA key !');
        }
      }
    }
    return res.json(okLogin(ObjLogin));
  }
  return res.json(ReturnOutPut);
}));

// public
router.all('/franchise/visitor_signup/ForgetPassword{/:id}', asyncHandler(async (req, res) => {
  const Getemailid = req.p.Getemailid;
  const ReturnOutPut = 1;
  const Row = await db.queryOne('shopping', 'select * from portal_login where emailid=@e limit 1', { e: Getemailid });
  if (!Row) return res.json('0');
  try {
    const date = new Date().toString();
    const Emailid = Row.emailid;
    const Name = Row.fname + ' ' + Row.lname;
    const subject = 'Forgot Password - ' + CompanySettings.CompanyURL + '';
    // PORT-NOTE: ~/forgot-password.html is read from the working directory (copy Franchise\forgot-password.html there) or config.uploadDir.
    const cand = [path.join(process.cwd(), 'forgot-password.html'), path.join(config.uploadDir, 'forgot-password.html')];
    const file = cand.find((f) => fs.existsSync(f));
    if (!file) throw new Error('Could not find file forgot-password.html');
    let myString = fs.readFileSync(file, 'utf8');
    const rndnumber = String(Math.floor(Math.random() * 2147483647));
    let Encryt = UtilityClass.Encryptword(Row.loginid);
    Encryt = Encryt + '/' + rndnumber;
    myString = rep(myString, '$$link$$', '' + CompanySettings.CompanyResellerURL + '/Reset-Password/' + Encryt);
    myString = rep(myString, '$$Name$$', Name);
    myString = rep(myString, '$$date$$', date);
    myString = rep(myString, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    myString = rep(myString, '$$CompanyURL$$', CompanySettings.CompanyURL);
    myString = rep(myString, '$$CompanyName$$', CompanySettings.CompanyName);
    myString = rep(myString, '$$CompanySupportEmailId$$', CompanySettings.CompanySupportEmailId);
    const resultMailSend = await UtilityClass.Send('', Emailid, '', '', subject, myString);
    if (resultMailSend === 's') {
      await db.exec('shopping', "Insert Into Tbl_Password_Change_History_Reseller (Plid,OldPassword,ResetLink,ChangeDate,IsLinkExpired) Values (@plid,@old,@link,now(),0)", { plid: Row.did, old: Row.password, link: Encryt });
    }
    const msgForMobile = 'Dear +' + Name + ', Click on below link to reset your password. ' + CompanySettings.CompanyResellerURL + '/Reset-Password/' + Encryt + '\r\n For more details visit ' + CompanySettings.CompanyResellerURL + '.\r\n The ' + CompanySettings.CompanyName + ' Team';
    await UtilityClass.SendMsgOnMobile(Row.phone, msgForMobile);
  } catch (Ex) {
    // legacy: ViewBag.Message = "Error occurred. Please try later"
  }
  return res.json(String(ReturnOutPut));
}));

// public
router.all('/franchise/visitor_signup/CustomerSignUp{/:id}', asyncHandler(async (req, res) => {
  const { Sponser, email, password, username, MobileNo, VerificationCode, Source } = req.p;
  const vc = sessionStore.get(req, 'VerificationCodeForMobile');
  if (vc === undefined || vc === null) return res.json('Verify your mobile no please.');
  if (Number(VerificationCode) !== Number(vc)) return res.json('You have entered wrong verification code.');
  const ip_address = await GetIP.GetLocalIP(req);
  const validate_Var = await DAL_RegistrationOrLogin.validate(email, username, password);
  if (validate_Var !== 'ok') return res.json(validate_Var);
  const CountryName = sessionStore.get(req, 'COUNTRYNAME');
  if (CountryName === undefined || CountryName === null) return res.json('expired');
  const IntOutPutResult = await DAL_RegistrationOrLogin.Registration(Sponser, email, password, 'Rs', String(CountryName), username, ip_address, MobileNo, Source);
  if (IntOutPutResult === '1') return res.json('success');
  else if (IntOutPutResult === '2') return res.json('Email Id Already Exist.');
  else if (IntOutPutResult === '5') return res.json('User Name Already Exist.');
  else if (IntOutPutResult === '6') return res.json('This Mobile Number Already Exist.');
  return res.json('Failed');
}));

module.exports = router;
