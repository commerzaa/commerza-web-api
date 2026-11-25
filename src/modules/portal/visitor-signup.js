'use strict';
// Ported from ClusterofferShopingPortal\Controllers\VisitorSignupController.cs (class visitor_signupController => /portal/visitor_signup/...)
// Database: shopping (Db_Shopping, the portal DataBaseContext).
// No RouteConfig entry targets this controller (all visitor_signup friendly URLs are commented out in RouteConfig.cs).
// Login actions (SignIn, SignIn1, DirectSignIn, AutoLogin, GoogleSignIN, FacebookSignUpAndAutoLogin, FacebookCallback) issue the portal
// customer token via ps.issueCustomerToken (SESSION.md 4): object responses get a top-level `token`, bare-string responses the
// `x-auth-token` header.
// PORT-NOTE: `private static string pass, userid` (written by UpdateStatus, read by DirectSignIn) were process-wide statics shared by ALL
//   visitors; reproduced as module-level variables (same cross-user behaviour, see report).
// PORT-NOTE: System.Threading.Thread background work => fire-and-forget promises; an exception inside such a thread terminated the
//   IIS worker process in .NET, here it is only logged.
// PORT-NOTE: Server.MapPath("~/x.html") => <config.uploadDir>/x.html (lib Save_ImageFile.MapPath). Copy SocialLoginDetails.html and
//   forgot-password.html from the legacy site root there.
const express = require('express');
const fs = require('fs');
const axios = require('axios');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { pageUrl, seoViewBag } = require('./_shared/batch-15-common');
const DAL_RegistrationOrLogin = require('../../lib/portal/DAL_RegistrationOrLogin');
const GetCountry = require('../../lib/portal/GetCountry');
const GetIP = require('../../lib/portal/GetIP');
const Security_Key = require('../../lib/portal/Security_Key');
const UtilityClass = require('../../lib/portal/UtilityClass');
const SendMail = require('../../lib/portal/SendMail');
const CustomEncriptionAndDecription = require('../../lib/portal/CustomEncriptionAndDecription');
const { MapPath } = require('../../lib/portal/Save_ImageFile');
const CS = require('../../lib/portal/CompanySettings');

const CompanySettings = CS.CompanySettings || CS;
const { CompanyMasterSettings } = CS;
const router = express.Router();
const DB = 'shopping';
const P = '/portal/visitor_signup';

// private static string pass = "", userid = "";
let pass = '';
let userid = '';

// ---------------------------------------------------------------- small C# emulation helpers
const nre = () => new TypeError('Object reference not set to an instance of an object.');
const fmtErr = () => new Error('Input string was not in a correct format.');
const isNullOrEmpty = (v) => v === undefined || v === null || v === '';
const nz = (v) => (v === undefined ? null : v);
const str = (v) => (v === undefined || v === null ? '' : String(v)); // Convert.ToString / string concatenation of null
const rep = (t, k, v) => t.split(k).join(str(v));
const fire = (fn) => { Promise.resolve().then(fn).catch((e) => console.error('[portal/visitor_signup] background task failed:', e && e.message)); };
/** new Random().Next(min, max) */
const rnd = (min, max) => min + Math.floor(Math.random() * (max - min));
/** Int32.Parse */
function parseInt32(v) {
  const t = String(v).trim();
  if (!/^[+-]?\d+$/.test(t)) throw fmtErr();
  const n = Number(t);
  if (n > 2147483647 || n < -2147483648) throw new Error('Value was either too large or too small for an Int32.');
  return n;
}
/** Convert.ToInt32(object): null => 0 */
const toInt32 = (v) => (v === undefined || v === null ? 0 : (typeof v === 'number' ? Math.round(v) : parseInt32(v)));
/** Convert.ToInt32(ConfigurationManager.AppSettings["DID"].ToString()): missing key => NullReferenceException */
function appDIDStrict() {
  const v = config.app.DID;
  if (v === undefined || v === null) throw nre();
  return parseInt32(v);
}
/** Convert.ToInt32(ConfigurationManager.AppSettings["DID"]): missing key => 0 */
const appDID = () => toInt32(config.app.DID);
/** Convert.ToInt16(x.ToString()) */
function toInt16(v) {
  const n = parseInt32(str(v));
  if (n > 32767 || n < -32768) throw new Error('Value was either too large or too small for an Int16.');
  return n;
}
/** Output parameter `.Value.ToString()` (DBNull => "") */
function outStr(row, name) {
  if (!row) return '';
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? '' : str(row[k]);
}
/** Drop null/undefined values: a SqlParameter with a null Value is not sent, so the procedure default applies. */
function defined(o) {
  const out = {};
  for (const k of Object.keys(o)) if (o[k] !== undefined && o[k] !== null) out[k] = o[k];
  return out;
}
/** DateTime.Now.ToString() (en-US) */
function netNow() {
  const d = new Date();
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h %= 12; if (h === 0) h = 12;
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${h}:${p2(d.getMinutes())}:${p2(d.getSeconds())} ${ampm}`;
}
const monthAhead = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; };
/** new StreamReader(Server.MapPath(virtualPath)).ReadToEnd() */
const readTemplate = (virtualPath) => fs.readFileSync(MapPath(virtualPath), 'utf8');
/** action parameter with a C# default value (string email = "") */
const pDef = (req, name, def) => { const v = req.p[name]; return v === undefined || v === null ? def : v; };
/** action parameter without default (string x) => null when absent */
const pStr = (req, name) => nz(req.p[name]);
/** Session["Plid"] = ObjLogin, response is a bare JSON value => token in the x-auth-token header */
function loginHeader(req, res, ObjLogin) {
  const token = ps.issueCustomerToken(ObjLogin, req);
  res.setHeader('x-auth-token', token);
  return token;
}

/** public static string EncryptFunction(string number) - static, not an MVC action (unused in this controller) */
async function EncryptFunction(number) {
  const p = new CustomEncriptionAndDecription();
  return p.encryption(number);
}

/** if (Session["COUNTRYID"] == null) { try { GetCountry.InitializeVisitorCountrySession(); GetCountry.SettingVisitor("1"); } catch { ViewBag.Message } } */
async function ensureCountry(req, ViewBag) {
  if (ps.sessionGet(req, 'COUNTRYID') == null) {
    try {
      await GetCountry.InitializeVisitorCountrySession(req);
      await GetCountry.SettingVisitor('1');
    } catch (ex) {
      ViewBag.Message = ex.message;
    }
  }
}

/** db._Portal_Login.Where(a => a.USERNAME.Equals(Referrelcode) && a.IsReferralAccepted.Equals(1)).FirstOrDefault() */
const referralRow = (Referrelcode) => db.queryOne(DB,
  'select plid, tlpmid from portal_login where username = @Referrelcode and isreferralaccepted = 1 limit 1', { Referrelcode });

/**
 * The "Referrelcode" cookie region shared by Index and referrel_signup. ASP.NET makes cookies written to Response visible in
 * Request.Cookies, so "the request cookie" below is the response value once one was written. `inner` runs inside
 * `if (Request.Cookies["Referrelcode"] != null)` after ViewBag.Referrelid was set. Returns TLPMID.
 */
async function referralCookieRegion(req, res, Referrelcode, ViewBag, inner) {
  let TLPMID = 0;
  const reqVal = ps.parseCookies(req).Referrelcode;
  let respVal; // undefined = Response.Cookies["Referrelcode"] not written
  if (!isNullOrEmpty(Referrelcode)) {
    const row = await referralRow(Referrelcode);
    if (row) {
      ViewBag.PageNotFound = 'Ok';
      respVal = Referrelcode;
      TLPMID = toInt32(row.tlpmid);
    }
  } else if (reqVal === undefined || reqVal === '') {
    respVal = '';
  }
  if (respVal !== undefined || reqVal !== undefined) {
    const MyCookieReferrelcode = respVal === undefined ? '' : respVal; // Response.Cookies["Referrelcode"].Value
    if (MyCookieReferrelcode !== '') {
      ViewBag.Referrelid = MyCookieReferrelcode;
    } else {
      ViewBag.Referrelid = respVal !== undefined ? respVal : reqVal;
    }
    respVal = ViewBag.Referrelid;
    if (inner) await inner();
  }
  if (respVal !== undefined) ps.setCookie(res, 'Referrelcode', respVal, { expires: monthAhead(), req });
  return TLPMID;
}

// ================================================================ Index(Referrelcode, Referrelid, Landingpage, favoriteurl, referralprogram)
// public
router.all(`${P}/Index{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const Referrelcode = pStr(req, 'Referrelcode');
  const Landingpage = pStr(req, 'Landingpage');
  const favoriteurl = pStr(req, 'favoriteurl');
  const referralprogram = pStr(req, 'referralprogram');
  const ViewBag = {};
  const TempData = {};
  if (favoriteurl != null) ps.sessionSet(req, 'FavoriteURL', favoriteurl);
  if (referralprogram != null && referralprogram === 'referralprogram') { ps.tempDataSet(req, 'IsReferralLogin', 1); TempData.IsReferralLogin = 1; }
  // (Domain Management block only reads Request.Url into unused locals)
  ViewBag.Canonical = pageUrl(req);
  await seoViewBag(ViewBag, 26);
  await ensureCountry(req, ViewBag);
  ViewBag.Referrelcode = Referrelcode;
  ViewBag.Referrelid = Referrelcode; // legacy assigns Referrelcode (not Referrelid)
  ViewBag.Landingpage = Landingpage;
  const TLPMID = await referralCookieRegion(req, res, Referrelcode, ViewBag, null);
  let View;
  if (Landingpage === 'registration-referral' || TLPMID === 1) View = '~/Views/Template/registration-referral.cshtml';
  else if (Landingpage === 'merchant-signup' || TLPMID === 5) View = '~/Views/visitor_signup/Index.cshtml';
  else View = '~/Views/visitor_signup/Index.cshtml';
  return res.json({ View, ViewBag, TempData });
}));

// ================================================================ visitor_login / referrel_login / customer_login (string favoriteurl)
function loginPage(LoginType, wid, View) {
  return asyncHandler(async (req, res) => {
    const favoriteurl = pStr(req, 'favoriteurl');
    if (favoriteurl != null) ps.sessionSet(req, 'FavoriteURL', favoriteurl);
    ps.sessionSet(req, 'LoginType', LoginType);
    const ViewBag = { Canonical: pageUrl(req) };
    await seoViewBag(ViewBag, wid);
    return res.json({ View, ViewBag });
  });
}
// public
router.all(`${P}/visitor_login{/:id}`, ps.portalSession, loginPage(1, 27, '~/Views/visitor_signup/visitor_login.cshtml'));
// public
router.all(`${P}/referrel_login{/:id}`, ps.portalSession, loginPage(2, 29, '~/Views/visitor_signup/referrel_login.cshtml'));
// public
router.all(`${P}/customer_login{/:id}`, ps.portalSession, loginPage(3, 29, '~/Views/visitor_signup/Customer_Panel_Login.cshtml'));

// ================================================================ referrel_signup(Referrelcode, Referrelid, Landingpage, favoriteurl, referralprogram)
// public
router.all(`${P}/referrel_signup{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const Referrelcode = pStr(req, 'Referrelcode');
  const ViewBag = {};
  await referralCookieRegion(req, res, Referrelcode, ViewBag, async () => {
    ViewBag.Canonical = '' + str(CompanySettings.CompanyDomain) + '/merchant-signup';
    await seoViewBag(ViewBag, 3);
  });
  return res.json({ View: '~/Views/visitor_signup/referrel_signup.cshtml', ViewBag });
}));

// ================================================================ customer_signup(Referrelcode, Referrelid, Landingpage, favoriteurl, referralprogram)
// public
router.all(`${P}/customer_signup{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const Referrelcode = pStr(req, 'Referrelcode');
  const Landingpage = pStr(req, 'Landingpage');
  const favoriteurl = pStr(req, 'favoriteurl');
  const referralprogram = pStr(req, 'referralprogram');
  const ViewBag = {};
  const TempData = {};
  if (favoriteurl != null) ps.sessionSet(req, 'FavoriteURL', favoriteurl);
  if (referralprogram != null && referralprogram === 'referralprogram') { ps.tempDataSet(req, 'IsReferralLogin', 1); TempData.IsReferralLogin = 1; }
  ViewBag.Canonical = pageUrl(req);
  await seoViewBag(ViewBag, 26);
  await ensureCountry(req, ViewBag);
  ViewBag.Referrelcode = Referrelcode;
  ViewBag.Referrelid = Referrelcode;
  ViewBag.Landingpage = Landingpage;
  return res.json({ View: '~/Views/visitor_signup/Customer_SignUp.cshtml', ViewBag, TempData });
}));

// ================================================================ Logout()
// PORT-NOTE (SESSION.md 5): legacy removed Session["Plid"] first and then read ((Login)Session["Plid"]).EmailId => NullReferenceException
//   swallowed by the catch, so USP_GetToken_logout never ran. Reproduced: remove, skip the proc. The client drops its token.
// public
router.all(`${P}/Logout{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  if (ps.isCustomer(req) || ps.sessionGet(req, 'Plid') != null) {
    ps.sessionRemove(req, 'Plid');
    try {
      throw nre(); // ((Login)Session["Plid"]).EmailId after the Remove
    } catch (_) { /* swallowed: [USP_GetToken_logout] @Email is never executed */ }
  }
  return res.json('Logout');
}));

// ================================================================ ValidateMobile(string UserName, string EmailId, string MobileNo)
// PORT-NOTE (security, legacy behaviour kept): the verification code is returned to the caller in the response ("1^...^<code>").
// public (registration OTP)
router.all(`${P}/ValidateMobile{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const UserName = pStr(req, 'UserName');
  const EmailId = pStr(req, 'EmailId');
  const MobileNo = pStr(req, 'MobileNo');
  if (UserName == null || EmailId == null || MobileNo == null) throw nre(); // .Trim() on null
  const row = await db.procOne(DB, 'usp_verificationcode', {
    username: UserName.trim(), emailid: EmailId.trim(), mobileno: MobileNo.trim(),
  });
  const IntOutPutResult = outStr(row, 'intresult');
  const VerificationCodeForMobile = outStr(row, 'verificationcode');
  ps.sessionSet(req, 'VerificationCodeForMobile', VerificationCodeForMobile);
  if (IntOutPutResult === '1') {
    if (MobileNo.includes('@')) {
      fire(async () => {
        const Mailcontent = 'Dear Customer,\r\nYour Verification code is <b>' + VerificationCodeForMobile + '</b>. Please enter the Verification code to complete your registration with ' + str(CompanySettings.CompanyName) + '. Don’t share this with anyone for security reasons! This code valid for one time only. <br/>The ' + str(CompanySettings.CompanyName) + ' Team';
        await SendMail.Send1('', MobileNo, '', '', 'Verification Code', Mailcontent);
      });
      return res.json('1^Verification code has been sent to your Email ID.please verify your Email ID.^' + VerificationCodeForMobile + '');
    }
    fire(async () => {
      await UtilityClass.SendMsgOnMobile(MobileNo, 'Dear Customer,\r\nYour Verification Code:' + VerificationCodeForMobile + ' Please use this verification code for verify your mobile no.\r\nThank You,\r\nThe ' + str(CompanySettings.CompanyName) + ' Team');
    });
    return res.json('1^Verification link has been sent to your Mobile No.please verify your Mobile No.^' + VerificationCodeForMobile + '');
  } else if (IntOutPutResult === '2') {
    return res.json('2^Email Id Already Exist.^' + VerificationCodeForMobile + '');
  } else if (IntOutPutResult === '5') {
    return res.json('5^User Name Already Exist.^' + VerificationCodeForMobile + '');
  } else if (IntOutPutResult === '6') {
    return res.json('6^This Mobile Number is Already Exist.^' + VerificationCodeForMobile + '');
  }
  return res.json('0^Some Error Occur Here.^' + VerificationCodeForMobile + '');
}));

/** Security_Key present => TempData["ml"] = objs; "2^loginid^password". Returns the string or null when no key is configured. */
async function securityKeyStep(req, ObjLogin, LoginID, Password) {
  let objs = new Security_Key();
  objs = await objs.Get_Security_Key(ObjLogin.Plid);
  if (objs != null) {
    objs.plid = ObjLogin.Plid;
    ps.tempDataSet(req, 'ml', { ...objs });
    const loginid = LoginID;
    const passwordd = Password;
    const gakey = '2';
    return gakey + '^' + str(loginid) + '^' + str(passwordd);
  }
  return null;
}

// ================================================================ DirectSignIn(int DID = 0)
// PORT-NOTE (security, legacy behaviour kept): logs in with the static pass/userid of the LAST UpdateStatus call of ANY visitor.
// public (login)
router.all(`${P}/DirectSignIn{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const pass1 = pass;
  const userid1 = userid;
  let ReturnOutPut = '1';
  const ip = await GetIP.GetLocalIP(req);
  const LoginID = userid1;
  const Password = pass1;
  CompanyMasterSettings.GetResellerData();
  let DID = appDIDStrict();
  if (DID === 0) DID = 1;
  const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(LoginID, Password, ip, DID);
  if (ObjLogin == null) {
    ps.sessionRemove(req, 'Plid');
    ReturnOutPut = '0';
  } else {
    const two = await securityKeyStep(req, ObjLogin, LoginID, Password);
    if (two !== null) return res.json(two);
    ReturnOutPut = '1';
    loginHeader(req, res, ObjLogin);
  }
  return res.json(ReturnOutPut);
}));

// ================================================================ UpdateStatus(string password, string VerificationCode, string Mobile, string Optional)
// public (registration OTP confirmation)
router.all(`${P}/UpdateStatus{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const password = pStr(req, 'password');
  const VerificationCode = pStr(req, 'VerificationCode');
  const Mobile = pStr(req, 'Mobile');
  const Optional = pStr(req, 'Optional');
  CompanyMasterSettings.GetResellerData();
  let DID = appDID();
  if (DID === 0) DID = 1;
  pass = password;
  userid = Mobile;
  ps.tempDataSet(req, 'MER-Loginid', Mobile);
  ps.tempDataSet(req, 'MER-password', password);
  let IsVerified = 0;
  let plid = 0;
  let stringret = '';
  if (VerificationCode !== '') {
    const vcode = ps.tempDataGet(req, 'Vcode');
    if (VerificationCode !== str(vcode)) {
      if (vcode !== null) ps.tempDataSet(req, 'Vcode', vcode); // TempData.Keep()
      IsVerified = 0;
    } else {
      IsVerified = 1;
    }
  }
  try {
    if (IsVerified === 1) {
      plid = toInt32(ps.sessionGet(req, 'TempPLID'));
      const row = await db.procOne(DB, 'usp_updatevisitor_member_reseller', defined({
        plid, password1: password, distributerid: DID, optional: Optional,
      }));
      stringret = outStr(row, 'intresult');
      const maxplid = outStr(row, 'maxplid');
      if (maxplid.trim() === '' || !Number.isFinite(Number(maxplid))) throw fmtErr(); // Convert.ToDouble(MAXPLID.Value.ToString())
    } else {
      stringret = 'OTP Code Does Not Match!';
    }
    return res.json(stringret);
  } catch (ex) {
    return res.json('Error occurred. Please try later ' + ex.message);
  }
}));

/** Social-login welcome mail (thread body of GoogleSignIN / FacebookSignUpAndAutoLogin). */
function socialLoginMail(email, firstName, lastName, password, withCompanyUrl) {
  fire(async () => {
    if (email !== '') {
      const Name = str(firstName) + ' ' + str(lastName);
      const subject = 'Login Details - ' + str(CompanySettings.CompanyURL) + '';
      let myString = readTemplate('~/SocialLoginDetails.html');
      myString = rep(myString, '$$Name$$', Name);
      myString = rep(myString, '$$lblLoginId$$', email);
      myString = rep(myString, '$$lblPassword$$', password);
      myString = rep(myString, '$$CompanyName$$', CompanySettings.CompanyName);
      myString = rep(myString, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
      if (withCompanyUrl) myString = rep(myString, '$$CompanyURL$$', CompanySettings.CompanyDomain);
      const resultMailSend = await UtilityClass.Send('', email, '', '', subject, myString);
      // legacy: if (resultMailSend == "s") IntOutPutResult = "3"; (after the response was produced => no effect)
      return resultMailSend;
    }
    return null;
  });
}

// ================================================================ GoogleSignIN(string email = "", string firstName = "", string lastName = "", string image = "")
// public (login)
router.all(`${P}/GoogleSignIN{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const email = pDef(req, 'email', '');
  const firstName = pDef(req, 'firstName', '');
  const lastName = pDef(req, 'lastName', '');
  let IntOutPutResult = '';
  const DID = 1;
  try {
    let ObjLogin = null;
    if (email !== '' && firstName !== '' && lastName !== '') {
      const Random = rnd(1000, 9999);
      const ip_address = await GetIP.GetLocalIP(req);
      const password = str(CompanySettings.CompanyName) + '@' + Random;
      const LoginID = String(rnd(10000000, 99999999));
      IntOutPutResult = await DAL_RegistrationOrLogin.SocialRegistration(email, firstName, lastName, password, ip_address, DID, LoginID,
        str(ps.sessionGet(req, 'CountryName')));
      if (IntOutPutResult === '2') {
        ObjLogin = await DAL_RegistrationOrLogin.SocialLoginCheck(email, DID);
        if (ObjLogin == null) ps.sessionRemove(req, 'Plid');
        else loginHeader(req, res, ObjLogin);
        socialLoginMail(email, firstName, lastName, password, false);
      } else if (IntOutPutResult === '1') {
        // string LoginId = SELECT LOGINID ... (result unused)
        await db.scalar(DB, 'SELECT loginid FROM tbl_customerlogin WHERE emailid = @email AND active = 1 LIMIT 1', { email });
        ObjLogin = await DAL_RegistrationOrLogin.SocialLoginCheck(email, DID);
        if (ObjLogin == null) ps.sessionRemove(req, 'Plid');
        else loginHeader(req, res, ObjLogin);
      }
    }
    return res.json(IntOutPutResult);
  } catch (Exp) {
    return res.json(Exp.message);
  }
}));

// ================================================================ MobileCheck(string LoginID)
// public (registration/login helper)
router.all(`${P}/MobileCheck{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const LoginID = pStr(req, 'LoginID');
  CompanyMasterSettings.GetResellerData();
  let DID = appDIDStrict();
  if (DID === 0) DID = 1;
  try {
    let Isexist = 0;
    const row = await db.procOne(DB, 'usp_get_resellersetting', { did: DID });
    Isexist = toInt16(outStr(row, 'output'));
    if (Isexist === 1) {
      Isexist = Number(await db.scalar(DB,
        'select count(1) from tbl_customerlogin where (username = @LoginID or phone = @LoginID or emailid = @LoginID) and did = @DID',
        { LoginID, DID })) || 0;
    } else {
      Isexist = 3;
    }
    return res.json(Isexist);
  } catch (ex) {
    return res.json('Error');
  }
}));

// ================================================================ SignIn(string LoginID, string Password, int DID = 0)
// PORT-NOTE (security, legacy behaviour kept): the "2^loginid^password" answer echoes the password back.
// public (login)
router.all(`${P}/SignIn{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const LoginID = pStr(req, 'LoginID');
  const Password = pStr(req, 'Password');
  let ReturnOutPut = '1';
  let username = '';
  let logintype = '';
  let token;
  CompanyMasterSettings.GetResellerData();
  let DID = appDID();
  if (DID === 0) DID = 1;
  const ip = await GetIP.GetLocalIP(req);
  const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(LoginID, Password, ip, DID);
  if (ObjLogin == null) {
    ps.sessionRemove(req, 'Plid');
    ReturnOutPut = '0';
    // (dead local `result` computation of the legacy has no effect)
  } else {
    const two = await securityKeyStep(req, ObjLogin, LoginID, Password);
    if (two !== null) return res.json(two);
    ReturnOutPut = '1';
    token = ps.issueCustomerToken(ObjLogin, req);
    username = ObjLogin.Name;
    logintype = str(ps.sessionGet(req, 'LoginType'));
  }
  const out = { ReturnOutPut, username, logintype };
  if (token) out.token = token;
  return res.json(out);
}));

// ================================================================ GetAffiliateData()
// public (no session check in legacy; master data for the signup page)
router.all(`${P}/GetAffiliateData{/:id}`, asyncHandler(async (req, res) => {
  const rows = await db.query(DB, `select td.did, coalesce(dm.companyname, '') as name
    from tbl_distributor td join distributor_master dm on td.pmid = dm.pmid
    where td.active = 1 and td.status = 1 and td.iskycapproved = 1 and td.isloginstatus = 1`, {});
  return res.json(mapRows(rows, ['DID', 'NAME']));
}));

// ================================================================ SignIn1(string LoginID, string Password, string gakey)
// PORT-NOTE (security): legacy stored Session["Plid"] BEFORE checking the GA key, so a wrong GA key still left the visitor logged in
//   (2FA bypass). The port issues the token only when the GA check passes (same response strings).
// public (login)
router.all(`${P}/SignIn1{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const LoginID = pStr(req, 'LoginID');
  const Password = pStr(req, 'Password');
  const gakey = pStr(req, 'gakey');
  let ReturnOutPut = '1';
  const ip = await GetIP.GetLocalIP(req);
  const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(LoginID, Password, ip);
  if (ObjLogin == null) {
    ps.sessionRemove(req, 'Plid');
    ReturnOutPut = '0';
    return res.json(ReturnOutPut);
  }
  ReturnOutPut = '1';
  let objs = new Security_Key();
  let ActiveKey = 0;
  objs = await objs.Get_Security_Key(ObjLogin.Plid);
  if (objs != null) {
    ActiveKey = Number(objs.ActiveKey);
    if (ActiveKey === 2) {
      if (!(await objs.Check_GaKey(ObjLogin.Plid, gakey))) {
        ReturnOutPut = 'Please enter valid GA key !';
        return res.json(ReturnOutPut);
      }
    }
  }
  loginHeader(req, res, ObjLogin);
  return res.json(ReturnOutPut);
}));

// ================================================================ ForgetPassword(string Getemailid)
// PORT-NOTE (legacy behaviour kept): the current plain password is copied into Tbl_Password_Change_History_Member.OldPassword.
// public (forgot password)
router.all(`${P}/ForgetPassword{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const Getemailid = pStr(req, 'Getemailid');
  let ReturnOutPut = 1;
  const Row = await db.queryOne(DB, 'select plid, loginid, password, fname, lname from portal_login where loginid = @Getemailid limit 1', { Getemailid });
  if (Row == null) {
    ReturnOutPut = 0;
    return res.json(String(ReturnOutPut));
  }
  const ViewBag = {};
  try {
    const date = netNow();
    const Emailid = Row.loginid;
    const Name = str(Row.fname) + ' ' + str(Row.lname);
    const subject = 'Forgot Password - ' + str(CompanySettings.CompanyURL) + '';
    let myString = readTemplate('~/forgot-password.html');
    const rndnumber = String(rnd(0, 2147483647));
    let Encryt = await UtilityClass.Encryptword(Row.loginid);
    Encryt = Encryt + '/' + rndnumber;
    myString = rep(myString, '$$link$$', '' + str(CompanySettings.CompanyDomain) + '/Reset-Password/' + Encryt);
    myString = rep(myString, '$$Name$$', Name);
    myString = rep(myString, '$$date$$', date);
    myString = rep(myString, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    myString = rep(myString, '$$CompanyURL$$', CompanySettings.CompanyURL);
    myString = rep(myString, '$$CompanyName$$', CompanySettings.CompanyName);
    myString = rep(myString, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
    const resultMailSend = await UtilityClass.Send('', Emailid, '', '', subject, myString);
    if (resultMailSend === 's') {
      ViewBag.success = 'Reset Password Link has been sent to your E-Mail ID';
      await db.exec(DB, `insert into tbl_password_change_history_member (plid, oldpassword, resetlink, changedate, islinkexpired)
        values (@plid, @old, @link, now(), 0)`, { plid: Row.plid, old: Row.password, link: Encryt });
    }
    // msgForMobile is built but the SMS call is commented out in legacy
    ViewBag.success = 'Reset Password Link has been sent to your E-Mail ID';
  } catch (Ex) {
    ViewBag.Message = 'Error occurred. Please try later';
  }
  // ViewBag is not part of a JsonResult
  return res.json(String(ReturnOutPut));
}));

// ================================================================ VerifyOTP(string otp)
// public (OTP)
router.all(`${P}/VerifyOTP{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const otp = pStr(req, 'otp');
  let otpmessage = '';
  const v = ps.tempDataGet(req, 'Vcode');
  if (v === null) throw nre(); // TempData["Vcode"].ToString() on null
  const otptemp = String(v);
  if (otp === otptemp) otpmessage = '1';
  else otpmessage = '';
  return res.json(otpmessage);
}));

// ================================================================ ForgetPasswordMobile(string Mobile)
// public (forgot password)
router.all(`${P}/ForgetPasswordMobile{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const Mobile = pStr(req, 'Mobile');
  let note = '';
  let ReturnOutPut = 1;
  // db._Customer_Login.Where(PHONE.Equals(Mobile)).FirstOrDefault()
  const Row = await db.queryOne(DB, 'select clid, loginid, password, fname, lname, emailid from tbl_customerlogin where phone = @Mobile limit 1', { Mobile });
  if (Row == null) {
    ReturnOutPut = 0;
    return res.json(String(ReturnOutPut));
  }
  const ViewBag = {};
  try {
    const Emailid = nz(Row.emailid);
    const date = netNow();
    const Name = str(Row.fname) + ' ' + str(Row.lname);
    const subject = 'Forgot Password - ' + str(CompanySettings.CompanyURL) + '';
    let myString = readTemplate('~/forgot-password.html');
    const rndnumber = String(rnd(0, 2147483647));
    let Encryt = await UtilityClass.Encryptword(Row.loginid);
    Encryt = Encryt + '/' + rndnumber;
    myString = rep(myString, '$$link$$', 'http://jewriaweb.mlmkabila.com//Reset-Password/' + Encryt);
    myString = rep(myString, '$$Name$$', Name);
    myString = rep(myString, '$$date$$', date);
    let resultMailSend = '';
    if (Emailid !== '') resultMailSend = await UtilityClass.Send('', Emailid, '', '', subject, myString);
    await db.exec(DB, `insert into tbl_password_change_history_member (plid, oldpassword, resetlink, changedate, islinkexpired)
      values (@plid, @old, @link, now(), 0)`, { plid: Row.clid, old: Row.password, link: Encryt });
    if (resultMailSend === 's') ViewBag.success = 'Reset Password Link has been sent to your E-Mail ID';
    // msgForMobile is built but the SMS call is commented out in legacy
    const Vcode = rnd(100000, 555555);
    ps.tempDataSet(req, 'Vcode', Vcode);
    fire(async () => {
      if (Mobile !== '') {
        await UtilityClass.SendMsgOnMobile(Mobile, 'Verification Code:' + Vcode + ' Please Use This Verification Code For Activate Your Account.Thank you.\r\nThe ' + str(CompanySettings.CompanyName) + ' Team');
      }
    });
    const row2 = await db.procOne(DB, 'usp_mobile_registarion_msg', defined({ mobile: Mobile }));
    note = outStr(row2, 'strresult');
    ViewBag.val = note;
  } catch (Ex) {
    ViewBag.Message = 'Error occurred. Please try later';
  }
  return res.json('1');
}));

// ================================================================ SignUpNow(email, password, username, MobileNo, Sponser, VerificationCode, int distributionid = 0)
// PORT-NOTE (legacy behaviour kept): the verification code is the constant 123456 (random generator commented out).
// public (registration)
router.all(`${P}/SignUpNow{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let email = pStr(req, 'email');
  const password = pStr(req, 'password');
  const username = pStr(req, 'username');
  let MobileNo = pStr(req, 'MobileNo');
  const Sponser = pStr(req, 'Sponser');
  let distributionid = 0;
  try { distributionid = isNullOrEmpty(req.p.distributionid) ? 0 : parseInt32(req.p.distributionid); } catch (_) { distributionid = 0; }
  if (MobileNo !== '' && MobileNo != null && MobileNo.includes('@')) {
    email = MobileNo;
    MobileNo = '';
  }
  const ip_address = await GetIP.GetLocalIP(req);
  // HttpCookie MyCookieReferrelcode = Request.Cookies["Referrelcode"]; (unused)
  const validate_Var = await DAL_RegistrationOrLogin.validate(email, username, password);
  if (distributionid === 0) {
    CompanyMasterSettings.GetResellerData();
    distributionid = appDID();
    if (distributionid === 0) distributionid = 1;
  }
  distributionid = appDID();
  if (validate_Var !== 'ok') return res.json(validate_Var);
  if (Sponser != null && Sponser !== '') {
    const row = await db.queryOne(DB, 'select plid from portal_login where username = @Sponser limit 1', { Sponser });
    if (row == null) return res.json('Invalid Sponser Id.');
  }
  if (ps.sessionGet(req, 'CountryName') == null) return res.json('expired');
  const currency = str(ps.sessionGet(req, 'CURRENCYCODE'));
  const IntOutPutResult = await DAL_RegistrationOrLogin.Registration(Sponser, email, password, currency, str(ps.sessionGet(req, 'CountryName')),
    username, ip_address, MobileNo, distributionid, '', 0, '', '', '', '', req);
  if (IntOutPutResult === '1') {
    const Vcode = 123456; // Generator.Next(100000, 555555) commented out
    ps.tempDataSet(req, 'Vcode', Vcode);
    if (email !== '') {
      const Mailcontent = 'Dear Customer,<br />Your Verification code is <b>' + Vcode + '</b>. Please enter the Verification code to complete your registration with ' + str(CompanySettings.CompanyName) + '. Don’t share this with anyone for security reasons! This code valid for one time only. <br/>The ' + str(CompanySettings.CompanyName) + ' Team';
      await SendMail.Send1('', email, '', '', 'Verification Code', Mailcontent);
    }
    if (MobileNo !== '') {
      await UtilityClass.SendMsgOnMobile(MobileNo, 'Dear Customer,\r\nYour mobile verification code is:' + Vcode + '. Please use this verification code to verify your mobile no.\r\nThank you,\r\nThe ' + str(CompanySettings.CompanyName) + ' Team');
    }
    return res.json('success');
  } else if (IntOutPutResult === '2') {
    return res.json('This Mobile No or Email Id Already Exist');
  } else if (IntOutPutResult === '5') {
    return res.json('User Name Already Exist.');
  } else if (IntOutPutResult === '6') {
    return res.json('This Mobile Number is Already Exist.');
  }
  return res.json('Failed');
}));

// ================================================================ Registration(FName, LName, Title, DOB, Country, Email, MobileNo, LoginPassword)
// public (registration). Exceptions are rethrown (catch { throw; }) => 500.
router.all(`${P}/Registration{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const FName = pStr(req, 'FName');
  const LName = pStr(req, 'LName');
  const Title = pStr(req, 'Title');
  const DOB = pStr(req, 'DOB');
  const Country = pStr(req, 'Country');
  const Email = pStr(req, 'Email');
  const MobileNo = pStr(req, 'MobileNo');
  const LoginPassword = pStr(req, 'LoginPassword');
  let TitleId = 0;
  let CID = 0;
  if (Title != null && Title !== '') TitleId = parseInt32(Title); else TitleId = 0;
  if (Country != null && Country !== '') CID = parseInt32(Country); else CID = 96;
  const RowMobile = await db.queryOne(DB, 'select phone from customer_login_temp where phone = @MobileNo limit 1', { MobileNo });
  if (RowMobile != null && RowMobile.phone != null) return res.json('Mobile No. Already Exist!!!');
  const RowEmail = await db.queryOne(DB, 'select emailid from customer_login_temp where emailid = @Email limit 1', { Email });
  if (RowEmail != null && RowEmail.emailid != null) return res.json('Email ID Already Exist!!!');
  const ip_address = await GetIP.GetLocalIP(req);
  const currency = str(ps.sessionGet(req, 'CURRENCYCODE'));
  const IntOutPutResult = await DAL_RegistrationOrLogin.VisitiorRegistration(currency, FName, LName, TitleId, DOB, CID, Email, MobileNo, LoginPassword,
    ip_address, req);
  if (IntOutPutResult === '1') return res.json('success');
  if (IntOutPutResult === '2') return res.json('This Mobile No or Email Id Already Exist');
  if (IntOutPutResult === '5') return res.json('User Name Already Exist.');
  if (IntOutPutResult === '6') return res.json('This Mobile Number is Already Exist.');
  return res.json('Failed');
}));

// ================================================================ Resendotp(string email, string MobileNo, string VerificationCode)
// public (OTP)
router.all(`${P}/Resendotp{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const email = pStr(req, 'email');
  const MobileNo = pStr(req, 'MobileNo');
  // string currency = Session["CURRENCYCODE"] (unused)
  const Vcode = rnd(100000, 555555);
  ps.tempDataSet(req, 'Vcode', Vcode);
  fire(async () => {
    if (email == null) throw nre(); // email.Contains("@") on null (crashed the thread in legacy)
    if (email.includes('@')) {
      if (email !== '') {
        const Mailcontent = 'Dear Customer,\r\nYour Verification code is <b>' + Vcode + '</b>. Please enter the Verification code to complete your registration with ' + str(CompanySettings.CompanyName) + '. Don’t share this with anyone for security reasons! This code valid for one time only. <br/>The ' + str(CompanySettings.CompanyName) + ' Team';
        await SendMail.Send1('', email, '', '', 'Verification Code', Mailcontent);
      }
    }
    try {
      if (MobileNo !== '') {
        await UtilityClass.SendMsgOnMobile(MobileNo, 'Dear Customer,\r\nVerification code is:' + Vcode + '. Please use this verification code for activate your account.\r\nThank you.\r\nThe ' + str(CompanySettings.CompanyName) + ' Team');
      }
    } catch (_) { /* swallowed */ }
  });
  return res.json('success');
}));

// ================================================================ OTPforLogin(string Mobile)
// public (login OTP)
router.all(`${P}/OTPforLogin{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const Mobile = pStr(req, 'Mobile');
  let email = '';
  if (Mobile !== '') {
    email = nz(await db.scalar(DB, 'select emailid from tbl_customerlogin where phone = @Mobile or emailid = @Mobile limit 1', { Mobile }));
    const Vcode = rnd(100000, 555555);
    ps.tempDataSet(req, 'Vcode', Vcode);
    if (Mobile == null) throw nre(); // Mobile.Contains("@") on null
    if (Mobile !== '' && !Mobile.includes('@')) {
      await UtilityClass.SendMsgOnMobile(Mobile, 'Dear Customer,\r\nYour Verification Code is:' + Vcode + '. Please use this verification code to activate your account.Thank you.\r\nThe ' + str(CompanySettings.CompanyName) + ' Team');
    }
    if (email !== '' && email != null) {
      const to = email;
      fire(async () => {
        const Mailcontent = 'Dear Customer,<br />Your Verification code is <b>' + Vcode + '</b>. Please enter the Verification code to complete your registration with ' + str(CompanySettings.CompanyName) + '. Don’t share this with anyone for security reasons! This code valid for one time only. <br/>The ' + str(CompanySettings.CompanyName) + ' Team';
        await SendMail.Send1('', to, '', '', 'Verification Code', Mailcontent);
      });
    }
    return res.json('success');
  }
  return res.json('success');
}));

// ================================================================ AutoLogin(string Mobile, string VerificationCode, int Type, string Password)
// PORT-NOTE (security, legacy behaviour kept): TempData["Vcode"] is bound to the browser session, not to the mobile number. Any session
//   holding a Vcode (e.g. after SignUpNow, whose code is always 123456, or OTPforLogin for one's own number) can log in as (Type 1) or
//   overwrite the password of (Type 2) ANY mobile number. Password is stored in plain text by Type 2.
// public (login)
router.all(`${P}/AutoLogin{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const Mobile = pStr(req, 'Mobile');
  const VerificationCode = pStr(req, 'VerificationCode');
  let Password = pStr(req, 'Password');
  // int Type (no default): MVC model binding failed before the action ran when it is missing/invalid
  if (isNullOrEmpty(req.p.Type) || !/^\s*[+-]?\d+\s*$/.test(String(req.p.Type))) {
    throw new Error("The parameters dictionary contains a null entry for parameter 'Type' of non-nullable type 'System.Int32' for method 'System.Web.Mvc.JsonResult AutoLogin(System.String, System.String, Int32, System.String)' in 'visitor_signupController'.");
  }
  const Type = parseInt32(req.p.Type);
  try {
    let ReturnOutPut = '1';
    for (const t of [1, 2]) {
      if (Type !== t) continue;
      const vc = ps.tempDataGet(req, 'Vcode');
      if (vc != null && VerificationCode !== str(vc)) {
        ReturnOutPut = 'OTP not matched';
      } else if (vc == null) {
        ReturnOutPut = 'OTP not matched';
      } else {
        if (Password == null) Password = '';
        const DID = appDIDStrict();
        const ip = await GetIP.GetLocalIP(req);
        if (t === 1) {
          Password = nz(await db.scalar(DB, 'SELECT password FROM tbl_customerlogin WHERE phone = @Mobile AND active = 1 AND did = @DID LIMIT 1', { Mobile, DID }));
        } else {
          await db.exec(DB, 'UPDATE tbl_customerlogin SET password = @Password WHERE phone = @Mobile AND did = @DID', { Password, Mobile, DID });
        }
        const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(Mobile, Password, ip, DID);
        if (ObjLogin == null) {
          ps.sessionRemove(req, 'Plid');
          ReturnOutPut = '0';
        } else {
          ReturnOutPut = 'success';
          loginHeader(req, res, ObjLogin);
        }
      }
    }
    return res.json(ReturnOutPut);
  } catch (Ex) {
    return res.json('Error');
  }
}));

// ================================================================ CustomerSignUp(Sponser, email, password, username, MobileNo, VerificationCode)
// public (registration)
router.all(`${P}/CustomerSignUp{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const Sponser = pStr(req, 'Sponser');
  const email = pStr(req, 'email');
  const password = pStr(req, 'password');
  const username = pStr(req, 'username');
  const MobileNo = pStr(req, 'MobileNo');
  const ip_address = await GetIP.GetLocalIP(req);
  const validate_Var = await DAL_RegistrationOrLogin.validate(email, username, password);
  if (validate_Var !== 'ok') return res.json(validate_Var);
  if (Sponser != null && Sponser !== '') {
    const row = await db.queryOne(DB, 'select plid from portal_login where username = @Sponser limit 1', { Sponser });
    if (row == null) return res.json('Invalid Sponser Id.');
  }
  if (ps.sessionGet(req, 'CountryName') == null) return res.json('expired');
  const IntOutPutResult = await DAL_RegistrationOrLogin.Registration(Sponser, email, password, 'Rs', str(ps.sessionGet(req, 'CountryName')), username,
    ip_address, MobileNo, 0, '', 0, '', '', '', '', req);
  if (IntOutPutResult === '1') return res.json('success'); // ViewBag.EmailID = email (not part of the JsonResult)
  if (IntOutPutResult === '2') return res.json('Email Id Already Exist.');
  if (IntOutPutResult === '5') return res.json('User Name Already Exist.');
  if (IntOutPutResult === '6') return res.json('This Mobile Number Already Exist.');
  return res.json('Failed');
}));

// ================================================================ Facebook login
/** private Uri RedirectUri: current request URL without query/fragment, path = Url.Action("FacebookCallback") */
const redirectUri = (req) => `${req.protocol}://${req.get('host')}${P}/FacebookCallback`;

// Facebook()  [AllowAnonymous]
// PORT-NOTE: FacebookClient.GetLoginUrl => https://www.facebook.com/dialog/oauth?... built by hand. The legacy also passed client_secret
//   in the object; it is NOT put into the browser URL here (it would leak the app secret).
// public
router.all(`${P}/Facebook{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let Isexist = 0;
  const DID = appDID();
  const row = await db.procOne(DB, 'usp_get_resellersetting_facebook', { did: DID });
  Isexist = toInt16(outStr(row, 'output'));
  if (Isexist === 1) {
    const qs = new URLSearchParams({
      client_id: str(CompanySettings.FACEBOOKCLIENTID),
      redirect_uri: redirectUri(req),
      response_type: 'code',
      scope: 'email',
    });
    return res.json('https://www.facebook.com/dialog/oauth?' + qs.toString());
  }
  return res.json(Isexist);
}));

/**
 * FacebookSignUpAndAutoLogin body. Returns { redirect } or { json } (catch branch) and issues the token on login.
 * email/firstName/lastName may be null when called from FacebookCallback (C# passes the Graph values).
 */
async function facebookSignUpAndAutoLogin(req, email, firstName, lastName) {
  let IntOutPutResult = '-1';
  let token;
  CompanyMasterSettings.GetResellerData();
  const DID = appDID();
  try {
    let ObjLogin = null;
    if (email !== '' && firstName !== '' && lastName !== '') {
      const Random = rnd(1000, 9999);
      const ip_address = await GetIP.GetLocalIP(req);
      const password = str(CompanySettings.CompanyName) + '@' + Random;
      const LoginID = String(rnd(10000000, 99999999));
      IntOutPutResult = await DAL_RegistrationOrLogin.SocialRegistration(email, firstName, lastName, password, ip_address, DID, LoginID,
        str(ps.sessionGet(req, 'CountryName')));
      if (IntOutPutResult === '2') {
        ObjLogin = await DAL_RegistrationOrLogin.SocialLoginCheck(email, DID);
        if (ObjLogin == null) ps.sessionRemove(req, 'Plid');
        else token = ps.issueCustomerToken(ObjLogin, req);
        socialLoginMail(email, firstName, lastName, password, true);
        return { redirect: '~/Home/Index', token };
      } else if (IntOutPutResult === '1') {
        await db.scalar(DB, 'SELECT loginid FROM tbl_customerlogin WHERE emailid = @email AND active = 1 LIMIT 1', { email }); // unused LoginId
        ObjLogin = await DAL_RegistrationOrLogin.SocialLoginCheck(email, DID);
        if (ObjLogin == null) ps.sessionRemove(req, 'Plid');
        else token = ps.issueCustomerToken(ObjLogin, req);
      }
    }
    return { redirect: '/', token };
  } catch (Exp) {
    return { json: Exp.message };
  }
}

// FacebookSignUpAndAutoLogin(string email = "", string firstName = "", string lastName = "")
// public (login)
router.all(`${P}/FacebookSignUpAndAutoLogin{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const r = await facebookSignUpAndAutoLogin(req, pDef(req, 'email', ''), pDef(req, 'firstName', ''), pDef(req, 'lastName', ''));
  if (r.json !== undefined) return res.json(r.json);
  const out = { redirect: r.redirect };
  if (r.token) out.token = r.token;
  return res.json(out);
}));

// FacebookCallback(string code)
// PORT-NOTE: Facebook C# SDK calls => Graph API over axios (POST oauth/access_token, GET me?fields=...). No try/catch in legacy => 500.
// public (OAuth callback)
router.all(`${P}/FacebookCallback{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const code = pStr(req, 'code');
  const form = new URLSearchParams();
  form.append('client_id', str(CompanySettings.FACEBOOKCLIENTID));
  form.append('client_secret', str(CompanySettings.FACEBOOKCLIENTSECRET));
  form.append('redirect_uri', redirectUri(req));
  form.append('code', str(code));
  const result = (await axios.post('https://graph.facebook.com/oauth/access_token', form.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })).data;
  const accessToken = result ? result.access_token : undefined;
  ps.sessionSet(req, 'AccessToken', accessToken);
  const me = (await axios.get('https://graph.facebook.com/me', {
    params: { fields: 'first_name,middle_name,gender,picture,location,timezone,last_name,id,email,birthday,name', access_token: accessToken },
  })).data || {};
  const email = nz(me.email);
  const firstname = nz(me.first_name);
  const lastname = nz(me.last_name);
  // FacebookSignUpAndAutoLogin(email, firstname, lastname); (its ActionResult is ignored, its Session["Plid"] stays)
  const r = await facebookSignUpAndAutoLogin(req, email, firstname, lastname);
  const out = { redirect: str(CompanySettings.CompanyREDIRECT) };
  if (r.token) out.token = r.token;
  return res.json(out);
}));

module.exports = router;
module.exports.EncryptFunction = EncryptFunction;
