'use strict';
// Ported from Shoping Portal Merchant Panel\Controllers\VisitorSignupController.cs (class visitor_signupController => /merchant/visitor_signup/...)
// Database: shopping (Db_Shopping). This is the MERCHANT PANEL LOGIN: SignIn / SignIn1 issue the JWT (userType 'merchant').
// Derived from src/modules/franchise/VisitorSignupController.js and re-aligned line by line with the Merchant C# (merchant C# wins).
// route-config: merchant/logout -> Logoutmerchant ; merchant-login -> visitor_login ; merchant-signup/{Source}/{ReferralId} -> Index
// PORT-NOTE: Session[...] values of anonymous visitors (COUNTRYID/COUNTRYNAME/IPADDRESS/MASTERSESSION/CURRENCYCODE, FavoriteURL, LoginType,
//   LoginOTP, VerificationCodeForMobile, TempData["ml"]) live in utils/sessionStore (anonymous subject = client IP). ASP.NET session keys are
//   case-insensitive, so Session["CountryName"] == Session["COUNTRYNAME"]; the key 'COUNTRYNAME' is used everywhere here.
//   On a successful login those values are copied to the logged-in subject (ASP.NET kept the same session across login).
// PORT-NOTE: SignIn/SignIn1 returned the bare JSON string "1" on success; it is now { result: "1", token, ...Login fields }.
//   All other return strings ("0", "2^loginid^password", "Please enter valid GA key !") are unchanged.
const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const axios = require('axios');
const { signToken, optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const config = require('../../config');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/merchant/UtilityClass');
// C# static class WebsiteDetail lives in Models/WebsiteDescription.cs => lib/merchant/WebsiteDescription (exports GetWebsiteInfo)
const WebsiteDetail = require('../../lib/merchant/WebsiteDescription');
const GetIP = require('../../lib/merchant/GetIP');
const DAL_RegistrationOrLogin = require('../../lib/merchant/DAL_RegistrationOrLogin');
const Security_Key = require('../../lib/merchant/Security_Key');
const CustomEncriptionAndDecription = require('../../lib/merchant/CustomEncriptionAndDecription');
const CS = require('../../lib/merchant/CompanySettings');

const CompanySettings = CS.CompanySettings || CS;
const router = express.Router();
const DB = 'shopping';
const P = '/merchant/visitor_signup';

const s = (v) => (v === undefined || v === null ? '' : String(v));
const rep = (t, k, v) => t.split(k).join(v === undefined || v === null ? '' : String(v));
const isEmpty = (v) => v === undefined || v === null || v === '';
const g = (o, n) => { if (!o) return undefined; const k = Object.keys(o).find((x) => x.toLowerCase() === n.toLowerCase()); return k === undefined ? undefined : o[k]; };
const nre = () => new TypeError('Object reference not set to an instance of an object.');
const trimReq = (v) => { if (v === undefined || v === null) throw nre(); return String(v).trim(); }; // C# string.Trim() on null => NullReferenceException
const fire = (p) => { Promise.resolve(p).catch((e) => console.error('[merchant/visitor_signup] background task failed:', e && e.message)); };

// Convert.ToInt64(string): null => 0, otherwise Int64.Parse (whitespace + sign allowed) or FormatException
function toInt64(v) {
  if (v === undefined || v === null) return 0n;
  const t = String(v).trim();
  if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return BigInt(t);
}
// SQL Server implicit varchar -> int conversion of @RelatedToId ('' => 0)
function sqlInt(v) {
  const t = s(v).trim();
  if (t === '') return 0;
  if (!/^[+-]?\d+$/.test(t)) throw new Error(`Conversion failed when converting the nvarchar value '${t}' to data type int.`);
  return parseInt(t, 10);
}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > 0) { try { out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); } catch (_) { out[c.slice(0, i).trim()] = c.slice(i + 1).trim(); } }
  });
  return out;
}
const monthAhead = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; };
const pageUrl = (req) => req.protocol + '://' + req.get('host') + req.originalUrl;

async function seoInfo(wid) {
  const o = { Title: '', MetaDesc: '', MetaKeyword: '' };
  const w = await WebsiteDetail.GetWebsiteInfo(wid);
  if (w != null) { o.Title = w.SeoTitle; o.MetaDesc = w.SeoDescription; o.MetaKeyword = w.SeoKeyword; }
  return o;
}

// ---------------------------------------------------------------------------------------------------------------
// INLINE LIB: Merchant DAL/Country.cs class GetCountry. lib/merchant/Country re-exports the Franchise Country *model*
// (BindCountry only), which has no InitializeVisitorCountrySession / SettingVisitor; the API-port src/lib/Country.js differs from the
// Merchant C# (IPADDRESS from GetIP, extra CurrencySymbol). So the Merchant logic is implemented here.
const GetCountry = {
  InitializeVisitorCountrySession(req) {
    const set = (k, v) => sessionStore.set(req, k, v);
    try {
      // (ipinfodb lookup is commented out in the C#)
      set('COUNTRYID', '96');
      set('COUNTRYNAME', 'India');
      set('IPADDRESS', '182.73.107.186');
      set('MASTERSESSION', null);
      set('CURRENCYCODE', String(config.app.ProductCurrency || ''));
    } catch (_) {
      set('COUNTRYID', '96');
      set('COUNTRYNAME', 'India');
      set('IPADDRESS', '182.73.107.186');
      set('MASTERSESSION', null);
      set('CURRENCYCODE', String(config.app.ProductCurrency || ''));
    }
  },
  SettingVisitor(sessionid) {
    try { /* whole body is commented out in the C# */ } catch (_) { /* swallowed */ }
  },
  // InsVisitorsWithDomain: only computes `domainvisitfrom` from the UrlReferrer; the DB call is commented out. Never called (callers commented out).
  InsVisitorsWithDomain(req) {
    const ref = req && req.get ? req.get('referer') : null;
    if (!ref) return; // domainvisitfrom = "direct"
    try { if (new URL(ref).host.toLowerCase().includes('qlook.bz')) return; } catch (_) { /* ignore */ }
  },
};

async function ensureCountry(req, ViewBag) {
  const cid = sessionStore.get(req, 'COUNTRYID');
  if (cid === undefined || cid === null) {
    try {
      GetCountry.InitializeVisitorCountrySession(req);
      GetCountry.SettingVisitor('1');
    } catch (ex) {
      ViewBag.Message = ex.message;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// INLINE LIB: Merchant Models/UtilityClass.cs methods whose Merchant semantics differ from / are missing in lib/merchant/UtilityClass
// (which re-exports the ClusterOfferAPI UtilityClass: TrackOTP writes tbl_customers_otp, SendMsgOnMobile(…, SMSAPI) has another meaning,
//  TrackMerchantsMessages / TrackRegistrationEmail / TrackMerchantsEmails do not exist).
// System.Uri escaping of the request URL (spaces and other illegal characters; existing %xx kept)
const uriEscape = (u) => u.replace(/[^A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]/g, (c) => encodeURIComponent(c));

const MerchantUtil = {
  // public static void TrackOTP(string mobileNo, string OTP, string process)
  async TrackOTP(mobileNo, OTP, process) {
    try {
      await db.exec(DB, 'INSERT INTO tbl_merchants_otp (mobileno,otp,process) VALUES (@m, @o, @p)', { m: mobileNo, o: OTP, p: process });
    } catch (_) { /* swallowed */ }
  },
  // public static void TrackMerchantsMessages(string mobileNo, string Message, string process)
  // PORT-NOTE: the C# inserts into column OTP, but TBL_MERCHANTS_MESSAGES has MESSAGE (no OTP) => the legacy insert always failed and was
  //   swallowed. Kept verbatim (it fails the same way and is swallowed).
  async TrackMerchantsMessages(mobileNo, Message, process) {
    try {
      await db.exec(DB, 'INSERT INTO tbl_merchants_messages (mobileno,otp,process) VALUES (@m, @o, @p)', { m: mobileNo, o: Message, p: process });
    } catch (_) { /* swallowed */ }
  },
  // public static void TrackRegistrationEmail(string emailId, string mailBody, string process)  (USP_MERCHANTS_REGISTRATION_EMAIL, @STROUTPUT out unused)
  async TrackRegistrationEmail(emailId, mailBody, process) {
    try {
      await db.procOne(DB, 'usp_merchants_registration_email', { emailid: emailId, mailbody: mailBody, process });
    } catch (_) { /* swallowed */ }
  },
  // public static void TrackMerchantsEmails(string emailId, string mailBody, string process)  (same procedure)
  async TrackMerchantsEmails(emailId, mailBody, process) {
    try {
      await db.procOne(DB, 'usp_merchants_registration_email', { emailid: emailId, mailbody: mailBody, process });
    } catch (_) { /* swallowed */ }
  },
  // public static string CallBackAddress(string ToEmailID, string Subject, string EmailContent) : "s" or the SMTP error message
  async CallBackAddress(ToEmailID, Subject, EmailContent) {
    try {
      const transport = nodemailer.createTransport({
        host: config.app.SMPT_HOST || '',
        port: parseInt(config.app.SMPT_PORT || '587', 10),
        secure: false,
        requireTLS: String(config.app.SMTP_EnableSSL || '').toLowerCase() === 'true',
        auth: { user: config.app.SMPT_Username || '', pass: config.app.SMPT_Password || '' },
      });
      try {
        await transport.sendMail({ from: config.app.SMPT_Username || '', to: ToEmailID, subject: Subject, html: EmailContent });
        return 's';
      } catch (ex) {
        return String(ex.message);
      }
    } catch (ex) {
      return String(ex.message);
    }
  },
  // public static int SendMsgOnMobile(string MobileNo, string Message, string type = "", int did = 0)
  async SendMsgOnMobile(MobileNo, Message, type = '', did = 0) {
    let res = 0;
    try {
      if (type !== '' && did !== 0) {
        const CompanySMSAPI = await db.scalar(DB, "SELECT coalesce(smsapi,'') FROM tbl_companysettings WHERE pmid=1 LIMIT 1", {});
        if (CompanySMSAPI === null || CompanySMSAPI === undefined) throw nre();
        let API = rep(String(CompanySMSAPI), '1111111111', MobileNo);
        API = rep(API, 'DummyText', Message);
        await axios.get(uriEscape(API));
        res = 1;
      } else {
        const baseurl = s(config.app.CompanySMSAPI) + 'username=' + s(config.app.CompanySMSAPIUSERNAME) + '&pass=' + s(config.app.CompanySMSAPIPASSWORD)
          + '&senderid=' + s(config.app.CompanySMSAPISENDERID) + '&dest_mobileno=' + s(MobileNo) + '&message=' + s(Message) + '&response=Y';
        await axios.get(uriEscape(baseurl));
        res = 1;
      }
    } catch (_) {
      res = 0;
    }
    return res;
  },
};

// ---------------------------------------------------------------------------------------------------------------
// Session -> JWT
const LOGIN_FIELDS = ['Plid', 'Pmid', 'Smdid', 'LoginID', 'UserName', 'EmailId', 'Name', 'Cid', 'SecretCode', 'PHONE'];
const SESSION_CARRY = ['FavoriteURL', 'LoginType', 'COUNTRYID', 'COUNTRYNAME', 'IPADDRESS', 'MASTERSESSION', 'CURRENCYCODE', 'VerificationCodeForMobile', 'LoginwithMobile', 'ml'];
const SESSION_ALL = SESSION_CARRY.concat(['LoginOTP', 'IsChecked']);
const int64 = (v) => (v === undefined || v === null || v === '' ? v : Number(v));

function loggedInSubject(req, plid) { return { user: { userType: 'merchant', plid }, ip: req.ip }; }

/** Session["Plid"] = ObjLogin (+ Session["LoginOTP"] = null for SignIn). Returns the legacy "1" response extended with the token. */
function sessionLogin(req, ObjLogin, clearLoginOtp) {
  const plid = int64(g(ObjLogin, 'Plid'));
  const target = loggedInSubject(req, plid);
  // the ASP.NET session survives the login: carry the visitor's session values over to the logged-in subject
  for (const k of SESSION_CARRY) {
    const v = sessionStore.get(req, k);
    if (v !== undefined) sessionStore.set(target, k, v);
  }
  if (clearLoginOtp) { sessionStore.set(req, 'LoginOTP', null); sessionStore.set(target, 'LoginOTP', null); }
  const favoriteurl = sessionStore.get(req, 'FavoriteURL');
  const logintype = sessionStore.get(req, 'LoginType');
  const payload = {
    userType: 'merchant',
    plid,
    pmid: int64(g(ObjLogin, 'Pmid')),
    smdid: int64(g(ObjLogin, 'Smdid')),
    loginid: g(ObjLogin, 'LoginID'),
    username: g(ObjLogin, 'UserName'),
    userName: g(ObjLogin, 'UserName'),
    emailid: g(ObjLogin, 'EmailId'),
    name: g(ObjLogin, 'Name'),
    cid: int64(g(ObjLogin, 'Cid')),
    secretcode: g(ObjLogin, 'SecretCode') === undefined ? null : g(ObjLogin, 'SecretCode'),
    phone: g(ObjLogin, 'PHONE'),
  };
  if (favoriteurl !== undefined && favoriteurl !== null) payload.favoriteurl = favoriteurl;
  if (logintype !== undefined && logintype !== null) payload.logintype = logintype;
  const out = { result: '1', token: signToken(payload) };
  for (const f of LOGIN_FIELDS) out[f] = g(ObjLogin, f) === undefined ? null : g(ObjLogin, f);
  return out;
}

/** Session.Abandon() / Session.Clear(): drop every session value of this browser (visitor and logged-in subject). */
function clearSession(req) {
  const subjects = [req, { ip: req.ip }];
  if (req.user && req.user.plid != null) subjects.push(loggedInSubject(req, req.user.plid));
  for (const sub of subjects) for (const k of SESSION_ALL) sessionStore.set(sub, k, null);
}

// ===============================================================================================================
// Index(string Source, string ReferralId, string AffiliateId)
const indexHandler = asyncHandler(async (req, res) => {
  const p = req.p;
  // route values of merchant-signup/{Source}/{ReferralId} (req.p is built before routing)
  let Source = req.params.Source !== undefined ? req.params.Source : p.Source;
  let ReferralId = req.params.ReferralId !== undefined ? req.params.ReferralId : p.ReferralId;
  let AffiliateId = p.AffiliateId;
  const ViewBag = {};
  if (AffiliateId === undefined || AffiliateId === null) AffiliateId = '';
  ViewBag.AffiliateId = AffiliateId;
  // (Domain management block only reads Request.Url into unused locals)
  ViewBag.Canonical = pageUrl(req);
  ViewBag.Title = ''; ViewBag.MetaDesc = ''; ViewBag.MetaKeyword = '';
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

  // if (Session["Plid"] != null) return RedirectToAction("Index", "CustomerDashBoard");
  if (req.user && req.user.userType === 'merchant' && req.user.plid != null) return res.json({ redirect: 'CustomerDashBoard/Index' });
  ViewBag.View = '~/Views/visitor_signup/Index.cshtml';
  return res.json(ViewBag);
});
// public (optionalAuth only to detect an existing merchant session)
router.all(`${P}/Index{/:id}`, optionalAuth, indexHandler);
// public  route-config: merchant-signup/{Source}/{ReferralId}
router.all('/merchant/merchant-signup{/:Source}{/:ReferralId}', optionalAuth, indexHandler);

// visitor_login / referrel_login / customer_login
function loginPage(wid, loginType, viewName, clearOtp) {
  return asyncHandler(async (req, res) => {
    const favoriteurl = req.p.favoriteurl;
    if (favoriteurl !== undefined && favoriteurl !== null) sessionStore.set(req, 'FavoriteURL', favoriteurl);
    sessionStore.set(req, 'LoginType', loginType);
    if (clearOtp) sessionStore.set(req, 'LoginOTP', null);
    const ViewBag = { Canonical: pageUrl(req), Title: '', MetaDesc: '', MetaKeyword: '' };
    Object.assign(ViewBag, await seoInfo(wid));
    ViewBag.View = viewName;
    res.json(ViewBag);
  });
}
// public  (route-config: merchant-login)
router.all([`${P}/visitor_login{/:id}`, '/merchant/merchant-login'], loginPage(27, 1, '~/Views/visitor_signup/visitor_login.cshtml', true));
// public
router.all(`${P}/referrel_login{/:id}`, loginPage(29, 2, '~/Views/visitor_signup/referrel_login.cshtml', false));
// public
router.all(`${P}/customer_login{/:id}`, loginPage(29, 3, '~/Views/visitor_signup/Customer_Panel_Login.cshtml', false));

// referrel_signup(string Referrelcode, string Referrelid, string Landingpage, string favoriteurl, string referralprogram)
// (the second referrel_signup(string Referrelid) overload is commented out in the C#)
// public
router.all(`${P}/referrel_signup{/:id}`, asyncHandler(async (req, res) => {
  const { Referrelcode } = req.p;
  const ViewBag = {};
  let TLPMID = 0; // eslint-disable-line no-unused-vars
  const reqC = parseCookies(req);
  const respC = {};
  const setC = (n, v) => { respC[n] = v; res.cookie(n, v, { expires: monthAhead() }); };
  if (!isEmpty(Referrelcode)) {
    // db._Portal_Login.Where(a => a.USERNAME.Equals(Referrelcode) && a.IsReferralAccepted.Equals(1)).FirstOrDefault()
    const row = await db.queryOne(DB, 'select tlpmid from portal_login where username=@u and isreferralaccepted=1 limit 1', { u: Referrelcode });
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
    ViewBag.Canonical = 'http://merchant.' + CompanySettings.CompanyURL + '/merchant-signup';
    ViewBag.Title = ''; ViewBag.MetaDesc = ''; ViewBag.MetaKeyword = '';
    Object.assign(ViewBag, await seoInfo(3));
  }
  ViewBag.View = '~/Views/visitor_signup/referrel_signup.cshtml';
  res.json(ViewBag);
}));

// customer_signup(string Referrelcode, string Referrelid, string Landingpage, string favoriteurl, string referralprogram)
// public
router.all(`${P}/customer_signup{/:id}`, asyncHandler(async (req, res) => {
  const { Referrelcode, Landingpage, favoriteurl, referralprogram } = req.p;
  const TempData = {};
  const ViewBag = {};
  if (favoriteurl !== undefined && favoriteurl !== null) sessionStore.set(req, 'FavoriteURL', favoriteurl);
  if (referralprogram !== undefined && referralprogram !== null && referralprogram === 'referralprogram') TempData.IsReferralLogin = 1;
  ViewBag.Canonical = pageUrl(req);
  ViewBag.Title = ''; ViewBag.MetaDesc = ''; ViewBag.MetaKeyword = '';
  Object.assign(ViewBag, await seoInfo(26));
  await ensureCountry(req, ViewBag);
  ViewBag.Referrelcode = Referrelcode;
  ViewBag.Referrelid = Referrelcode;
  ViewBag.Landingpage = Landingpage;
  ViewBag.View = '~/Views/visitor_signup/Customer_SignUp.cshtml';
  res.json(Object.assign({ TempData }, ViewBag));
}));

// Logout(): JsonResult "Logout"
// PORT-NOTE: the C# calls Session.Abandon()+Session.Clear() BEFORE reading ((Login)Session["Plid"]).EmailId, so that read always threw a
//   NullReferenceException that was swallowed => USP_GetToken_logout_MERCHANT never actually ran. Reproduced as-is (call kept, unreachable).
// public (optionalAuth: the session check is "if logged in")
router.all(`${P}/Logout{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  if (req.user && req.user.plid != null) {
    const Session = { Plid: req.user };
    clearSession(req); // Session.Abandon(); Session.Clear();
    delete Session.Plid;
    try {
      if (!Session.Plid) throw nre();
      const Email = Session.Plid.emailid;
      await db.procOne(DB, 'usp_gettoken_logout_merchant', { email: Email });
    } catch (_) { /* swallowed */ }
  }
  res.json('Logout');
}));

// Logoutmerchant(): Session["Plid"]=null; Session["IsChecked"]=null; Abandon; Clear; RedirectToAction("Index","visitor_signup")
// public  (route-config: merchant/logout)
router.all([`${P}/Logoutmerchant{/:id}`, '/merchant/merchant/logout'], optionalAuth, asyncHandler(async (req, res) => {
  clearSession(req);
  res.json({ status: 'true', redirect: 'visitor_signup/Index' });
}));

// public static string EncryptFunction(string number)
async function EncryptFunction(number) {
  const p = new CustomEncriptionAndDecription();
  return p.encryption(number);
}

// ValidateMobile(string UserName, string EmailId, string MobileNo, string MerchantRelatedTo, string AffiliateId)
// public (registration OTP)
router.all(`${P}/ValidateMobile{/:id}`, asyncHandler(async (req, res) => {
  const { UserName, EmailId, MobileNo, MerchantRelatedTo, AffiliateId } = req.p;
  const encryt = await EncryptFunction(String('4118')); // eslint-disable-line no-unused-vars
  const r = await db.procOne(DB, 'usp_verificationcode', {
    username: trimReq(UserName),
    emailid: trimReq(EmailId),
    mobileno: trimReq(MobileNo),
    relatedtoid: sqlInt(trimReq(MerchantRelatedTo)),
    affiliate: trimReq(AffiliateId),
  });
  const IntOutPutResult = s(g(r, 'intresult'));
  const VerificationCodeForMobile = s(g(r, 'verificationcode'));
  await db.exec(DB, 'insert into tbl_smshistory (code) values (@code)', { code: VerificationCodeForMobile });
  sessionStore.set(req, 'VerificationCodeForMobile', VerificationCodeForMobile);
  if (IntOutPutResult === '1') {
    await MerchantUtil.TrackOTP(MobileNo, VerificationCodeForMobile, 'REGISTRATION');
    // background thread in the C#
    fire((async () => {
      await MerchantUtil.SendMsgOnMobile(MobileNo, 'Dear User, Use this One Time Password ' + VerificationCodeForMobile + ' Verify your Mobile. Regards, CLUSTER LEVEL MARKETING', '1', 1);
      const MobileNoNoForSendSms = 'Verification Code:' + VerificationCodeForMobile + ' Please Use This Verification Code For Verify Your Mobile No.';
      const EmailMessage = 'Verification Code:' + VerificationCodeForMobile + ' Please Use This Verification Code For Verify Your Email Id';
      const process = 'Merchant Registration';
      await MerchantUtil.TrackMerchantsMessages(MobileNo, MobileNoNoForSendSms, process);
      await MerchantUtil.CallBackAddress(EmailId, process, EmailMessage);
      await MerchantUtil.TrackRegistrationEmail(EmailId, EmailMessage, process);
    })());
    return res.json('1^Verification Code has been sent to your Mobile No. and Email Id. please verify your Mobile No. and Email Id.^' + VerificationCodeForMobile + '');
  } else if (IntOutPutResult === '2') {
    return res.json('2^Email Id Already Exist.^' + VerificationCodeForMobile + '');
  } else if (IntOutPutResult === '5') {
    return res.json('5^User Name Already Exist.^' + VerificationCodeForMobile + '');
  } else if (IntOutPutResult === '6') {
    return res.json('6^This Mobile Number is Already Exist.^' + VerificationCodeForMobile + '');
  } else if (IntOutPutResult === '7') {
    return res.json('6^Your Type not match with your active package.^' + VerificationCodeForMobile + ''); // "6^" prefix for result 7 is legacy
  }
  return res.json('0^Some Error Occur Here.^' + VerificationCodeForMobile + '');
}));

// public static void SendOTPMail(string email, string Text)  -- not an MVC action (static) and not called anywhere in the Merchant app;
// ported as an internal helper (exported as router.SendOTPMail).
const OTP_MAIL_TEMPLATE = "<div>\n\n<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>\n<tbody><tr><td>\n<table width='585'><tbody><tr><td style='width: 350px'><a href='$CompanyDomain$' target='UlOxf6W290vd9HCE04UigQH'>\n<img src='$CompanyDomainLogo$' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>\n<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'>$datetime$</td>\n</tr></tbody></table></td>\n</tr><tr><td>\n<div>\n<div class='clear'></div>\n\n<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>\n<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px15px; color: #000'>\nHello Merchant,</h1>\n<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>\nGreetings for the day! </strong>\n<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>\n<table cellpadding='0' cellspacing='0' width='98%' style='font-size:14px;  font-family:Arial; color:#454545;  border:1px solid #eaeaea; background:#f0ffff;  '>\n    <tr>\n        <td colspan='3' style='height:10px; line-height:10px;'></td>\n    </tr>\n    <tr>\n    <td colspan='3' style='height:10px; line-height:30px;'>$lblmessage$</td>\n    </tr>\n\n    <tr>\n        <td colspan='3' style='height:15px; line-height:15px;'></td>\n    </tr>\n\n</table>\n</p>\n<div style='clear: both'></div>\n<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>\n\n</p>\n<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>\nIf you have any issues regarding this mail, you can write us on <a style='color:#00008B'>$CompanySupportEmailID$</a></p>\n<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'></strong>\n<div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px'>\n<center>\n</center>\n</div>\n\n<div style='clear: both'></div>\n\n<div style='clear: both'></div>\n</td>\n</tr><tr><td>\n<table width='554'><tbody><tr><td>\n<p style='font-size: 16px; line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>\nBest Regards,\n<br>\n$CompanyName$\n</p>\n</td>\n<td style='width: 240px; text-align: right'>\n<span>Follow us on</span>\n<br>\n<div style = 'margin-right: 7px; text-align:right'>\n<a href = '$FacebookShare$' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = '$CompanyDomain$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n\n<a href = '$TwitterShare$' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = '$CompanyDomain$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n\n<a href = '$GoogleplusShare$' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = '$CompanyDomain$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n\n<a href = '$LinkedinShare$' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = '$CompanyDomain$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n\n<a href = '$PinterestShare$' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = '$CompanyDomain$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>\n</div>\n</td>\n</tr></tbody></table></td>\n</tr></tbody></table><div class='clear'></div>\n</div>\n</td>\n</tr></tbody></table>\n    </div>";
async function SendOTPMail(email, Text) {
  try {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const curdate = pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear(); // "dd-MM-yyyy"
    const process = 'Registration OTP';
    let mailtxt = OTP_MAIL_TEMPLATE;
    mailtxt = rep(mailtxt, '$$lblname$$', '');
    mailtxt = rep(mailtxt, '$$datetime$$', curdate);
    mailtxt = rep(mailtxt, '$$lblmessage$$', Text);
    mailtxt = rep(mailtxt, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
    mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
    mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    mailtxt = rep(mailtxt, '$$CompanyDomainLogo$$', CompanySettings.CompanyDomainLogo);
    mailtxt = rep(mailtxt, '$$FacebookShare$$', CompanySettings.FacebookShare);
    mailtxt = rep(mailtxt, '$$TwitterShare$$', CompanySettings.TwitterShare);
    mailtxt = rep(mailtxt, '$$GoogleplusShare$$', CompanySettings.GoogleplusShare);
    mailtxt = rep(mailtxt, '$$LinkedinShare$$', CompanySettings.LinkedinShare);
    mailtxt = rep(mailtxt, '$$PinterestShare$$', CompanySettings.PinterestShare);
    mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
    const transport = nodemailer.createTransport({
      host: CompanySettings.CompanyMailServer,
      port: 587,
      secure: false,
      auth: { user: CompanySettings.CompanySupportEmailId, pass: CompanySettings.CompanyMailPassword },
    });
    await MerchantUtil.TrackMerchantsEmails(email, mailtxt, process);
    await transport.sendMail({ from: CompanySettings.CompanySendMailEmailId, to: email, subject: 'Verification Code ', html: mailtxt });
  } catch (_) { /* swallowed */ }
}

// SignIn(string LoginID, string Password, string LoginOTP)   -- merchant panel login
// public
router.all(`${P}/SignIn{/:id}`, asyncHandler(async (req, res) => {
  const { LoginID, Password } = req.p;
  let ReturnOutPut = '1';
  const ip = await GetIP.GetLocalIP(req);
  const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(LoginID, Password, ip);
  if (ObjLogin == null) {
    // Session["Plid"] = null => no token
    ReturnOutPut = '0';
  } else {
    // (LoginOTP verification block is commented out in the C#)
    const plid = g(ObjLogin, 'Plid');
    let objs = new Security_Key();
    objs = await objs.Get_Security_Key(plid);
    if (objs != null) {
      objs.plid = plid;
      sessionStore.set(req, 'ml', objs); // TempData["ml"]
      const loginid = LoginID;
      const passwordd = Password;
      const gakey = '2';
      ReturnOutPut = gakey + '^' + loginid + '^' + passwordd;
      return res.json(ReturnOutPut);
    }
    // ReturnOutPut = "1"; Session["Plid"] = ObjLogin; Session["LoginOTP"] = null;
    return res.json(sessionLogin(req, ObjLogin, true));
  }
  return res.json(ReturnOutPut);
}));

// SignIn1(string LoginID, string Password, string gakey)   -- second step when a security key (GA) is configured
// PORT-NOTE: the C# stored Session["Plid"] BEFORE validating the GA key, so a wrong GA key still left the user logged in (2FA bypass).
//   The port issues the token only when the GA check passes; on "Please enter valid GA key !" no token is returned.
// public
router.all(`${P}/SignIn1{/:id}`, asyncHandler(async (req, res) => {
  const { LoginID, Password, gakey } = req.p;
  let ReturnOutPut = '1';
  const ip = await GetIP.GetLocalIP(req);
  const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(LoginID, Password, ip);
  if (ObjLogin == null) {
    ReturnOutPut = '0';
    return res.json(ReturnOutPut);
  }
  ReturnOutPut = '1';
  const plid = g(ObjLogin, 'Plid');
  let objs = new Security_Key();
  let ActiveKey = 0;
  objs = await objs.Get_Security_Key(plid);
  if (objs != null) {
    ActiveKey = objs.ActiveKey;
    if (Number(ActiveKey) === 2) {
      if (!(await objs.Check_GaKey(plid, gakey))) {
        ReturnOutPut = 'Please enter valid GA key !';
        return res.json(ReturnOutPut);
      }
    }
  }
  return res.json(sessionLogin(req, ObjLogin, false));
}));

// ForgetPassword(string Getemailid)
// public
router.all(`${P}/ForgetPassword{/:id}`, asyncHandler(async (req, res) => {
  const Getemailid = req.p.Getemailid;
  const ReturnOutPut = 1;
  const Row = await db.queryOne(DB, 'select * from portal_login where emailid=@e limit 1', { e: Getemailid });
  if (Row == null) return res.json(String(0));
  const ViewBag = {};
  try {
    const date = new Date().toLocaleString('en-US');
    const Emailid = Row.emailid;
    const Name = s(Row.fname) + ' ' + s(Row.lname);
    const subject = 'Forgot Password Link ';
    // PORT-NOTE: Server.MapPath("~/forgot-password.html") => <cwd>/forgot-password.html or <uploadDir>/forgot-password.html
    //   (copy the Merchant Panel's forgot-password.html there). A missing file throws and is swallowed like the C# catch.
    const cand = [path.join(process.cwd(), 'forgot-password.html'), path.join(config.uploadDir, 'forgot-password.html')];
    const file = cand.find((f) => fs.existsSync(f));
    if (!file) throw new Error('Could not find file forgot-password.html');
    const readFile = fs.readFileSync(file, 'utf8');
    let myString = readFile;
    const rndnumber = String(Math.floor(Math.random() * 2147483647)); // new Random().Next()
    let Encryt = await UtilityClass.Encryptword(Row.loginid);
    Encryt = Encryt + '/' + rndnumber;
    myString = rep(myString, '$$link$$', CompanySettings.CompanyMerchantURL + '/Reset-Password/' + Encryt);
    myString = rep(myString, '$$Name$$', Row.emailid);
    myString = rep(myString, '$$date$$', date);
    myString = rep(myString, '[CompanyName]', CompanySettings.CompanyName);
    myString = rep(myString, '[CompanyURL]', CompanySettings.CompanyMerchantURL);
    myString = rep(myString, '[SupportEmail]', CompanySettings.CompanySupportEmailId);
    let resultMailSend = '';
    // Maintaining the Password Change History
    ViewBag.success = 'Reset Password Link has been sent to your E-Mail ID';
    await db.exec(DB, 'Insert Into tbl_password_change_history (plid,oldpassword,resetlink,changedate,islinkexpired) Values (@plid,@old,@link,now(),0)',
      { plid: Row.plid, old: Row.password, link: Encryt });
    // background thread in the C# (resultMailSend is read below before the thread finishes => effectively "")
    fire((async () => { resultMailSend = await MerchantUtil.CallBackAddress(Emailid, subject, myString); })());
    const msgForMobile = 'Dear +' + Name + ', Click on below link to reset your password. http://merchant.' + CompanySettings.CompanyURL + '/Reset-Password/' + Encryt
      + '\r\n For more details visit ' + CompanySettings.CompanyMerchantURL + '.\r\n The ' + CompanySettings.CompanyName + ' Team';
    const resSms = await MerchantUtil.SendMsgOnMobile(Row.phone, msgForMobile);
    if (resSms === 1) ViewBag.success = 'Reset Password Link has been sent to your Mobile';
    // PORT-NOTE: CallBackAddress returns "s" (never "success"), so the next branch can never be true in the C# either.
    if (resultMailSend === 'success' && resSms === 1) {
      ViewBag.success = 'Reset Password Link has been sent to your E-Mail ID & Mobile';
    } else if (resultMailSend !== 'success' && resSms !== 1) {
      ViewBag.Message = 'Reset Password Link has been Not sent to your E-Mail ID & Mobile !! some error occurred';
    }
  } catch (Ex) {
    ViewBag.Message = 'Error occurred. Please try later';
  }
  // ViewBag is not part of a JsonResult; only the string is returned
  return res.json(String(ReturnOutPut));
}));

// CustomerSignUp(string Sponser, string email, string password, string username, string MobileNo, string VerificationCode, string Source,
//                string MerchantRelatedTo, string AffiliateId)
// public (registration)
router.all(`${P}/CustomerSignUp{/:id}`, asyncHandler(async (req, res) => {
  const { Sponser, email, password, username, MobileNo, VerificationCode, Source, MerchantRelatedTo, AffiliateId } = req.p;
  const vc = sessionStore.get(req, 'VerificationCodeForMobile');
  if (vc === undefined || vc === null) return res.json('Verify your mobile no please.');
  if (toInt64(VerificationCode) !== toInt64(vc)) return res.json('You have entered wrong verification code.');

  const ip_address = await GetIP.GetLocalIP(req);
  const MyCookieReferrelcode = parseCookies(req).Referrelcode; // eslint-disable-line no-unused-vars
  const validate_Var = await DAL_RegistrationOrLogin.validate(email, username, password);
  if (validate_Var !== 'ok') return res.json(validate_Var);
  const CountryName = sessionStore.get(req, 'COUNTRYNAME');
  if (CountryName === undefined || CountryName === null) return res.json('expired');
  const IntOutPutResult = await DAL_RegistrationOrLogin.Registration(Sponser, email, password, 'Rs', String(CountryName), username, ip_address, MobileNo,
    Source, MerchantRelatedTo, AffiliateId, req);
  if (IntOutPutResult === '1') {
    // ViewBag.EmailID = email (not part of the JsonResult)
    return res.json('success');
  } else if (IntOutPutResult === '2') return res.json('Email Id Already Exist.');
  else if (IntOutPutResult === '5') return res.json('User Name Already Exist.');
  else if (IntOutPutResult === '6') return res.json('This Mobile Number Already Exist.');
  else if (IntOutPutResult === '50') return res.json('Invalid Affiliate Id.');
  else if (IntOutPutResult === '51') return res.json('Email Id Not Associated With Affiliated Id.');
  else if (IntOutPutResult === '52') return res.json('Mobile No Not Associated With Affiliate Id');
  else if (IntOutPutResult === '53') return res.json('Affiliate Id Required.');
  else if (IntOutPutResult === '54') return res.json('Free Affiliate Can Not Register Either As Seller Or Professionals.');
  return res.json('Failed');
}));

// public int SendOTPLoginTime(string MobileNo) -- a public instance method => MVC action; the int is returned as text content.
async function SendOTPLoginTime(req, MobileNo) {
  let responce = 0;
  try {
    const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
    sessionStore.set(req, 'LoginOTP', OTP);
    responce = await MerchantUtil.SendMsgOnMobile(MobileNo, 'Dear User, Use this One Time Password ' + OTP + ' Verify your Mobile. Regards, CLUSTER LEVEL MARKETING', '1', 1);
  } catch (EX) {
    responce = 0;
    sessionStore.set(req, 'LoginOTP', null);
    throw EX;
  }
  return responce;
}
// public (login OTP)
router.all(`${P}/SendOTPLoginTime{/:id}`, asyncHandler(async (req, res) => {
  const r = await SendOTPLoginTime(req, req.p.MobileNo);
  res.type('text/html').send(String(r));
}));

// GetCustomerDetails(string affiliate, string mobilenumber)
// PORT-NOTE: the C# queried [db_affiliate].[dbo].[Member_master] cross-database from Db_Shopping; PostgreSQL cannot do that, so the query runs
//   on the 'affiliate' database directly (table member_master). Request values are bound parameters (legacy concatenated them).
// public (signup helper; no session check in the C#)
router.all(`${P}/GetCustomerDetails{/:id}`, asyncHandler(async (req, res) => {
  const { affiliate, mobilenumber } = req.p;
  let data;
  if (!isEmpty(affiliate)) {
    data = await db.queryOne('affiliate', 'select username,mobile,emailid from member_master where username=@v limit 1', { v: affiliate });
  } else {
    data = await db.queryOne('affiliate', 'select username,mobile,emailid from member_master where mobile=@v limit 1', { v: s(mobilenumber) });
  }
  if (data != null) {
    return res.json('1^Success^' + s(data.mobile) + '^' + s(data.emailid) + '^' + s(data.username));
  }
  return res.json('2^You Entered Invalid .');
}));

module.exports = router;
module.exports.SendOTPMail = SendOTPMail;
module.exports.EncryptFunction = EncryptFunction;
module.exports.SendOTPLoginTime = SendOTPLoginTime;
module.exports.GetCountry = GetCountry;
