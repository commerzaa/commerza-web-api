// Ported from ClusterofferShopingPortal\Controllers\Login_as_yourchoice.cs (class Login_as_yourchoiceController => /portal/Login_as_yourchoice/...)
'use strict';
// Database: shopping (Db_Shopping). Login actions (SESSION.md 4): DirectSignIn does Session["Plid"] = ObjLogin => ps.issueCustomerToken.
//   Index (RedirectToAction => { redirect }) gets a top-level `token`; the string actions (DistrubutionSignupKyabol, DirectSignIn,
//   CustomerOutersignup) keep their bare body and send the token in the `x-auth-token` header.
// PORT-NOTE: `static string pass, userid` were process-wide statics shared by ALL visitors (written by DistrubutionSignupKyabol /
//   CustomerOutersignup, read by DirectSignIn); reproduced as module-level variables (same cross-user behaviour).
// PORT-NOTE: RedirectToAction("") (Index, result not "1") => { redirect: '/Login_as_yourchoice' } (current controller, default action).
// PORT-NOTE: WebClient.DownloadString => axios GET (non-2xx throws like WebException); JavaScriptSerializer => JSON.parse with
//   case-insensitive property lookup.
// PORT-NOTE: Request.Url.AbsoluteUri (Outersitesourcelog.URL) is the Express URL (includes the /portal prefix).
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const DAL_RegistrationOrLogin = require('../../lib/portal/DAL_RegistrationOrLogin');
const GetIP = require('../../lib/portal/GetIP');
const UtilityClass = require('../../lib/portal/UtilityClass');
const { DB, NRE, ci, mvcStr, mvcOptInt, toInt32, qs, content, redirectJson, loginSession } = require('./_shared/batch-20-common');

const router = express.Router();
const C = '/portal/Login_as_yourchoice';

// static string pass = "", userid = "";
let pass = '';
let userid = '';

const cs = (v) => (v === null || v === undefined ? '' : String(v)); // Convert.ToString / string concatenation of null
const S = (v) => (v === undefined ? null : v);

/**
 * public string DirectSignIn(int DID = 0). `ctx.token` receives the token when Session["Plid"] = ObjLogin, undefined when the
 * session login is cleared.
 */
async function DirectSignIn(req, ctx, DID = 0) {
  const pass1 = pass;
  const userid1 = userid;
  let ReturnOutPut = '1';
  const ip = await GetIP.GetLocalIP(req);
  const LoginID = userid1;
  const Password = pass1;
  const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(LoginID, Password, ip, DID);
  if (ObjLogin == null) {
    ctx.token = loginSession(req, null); // Session["Plid"] = null
    ReturnOutPut = '0';
  } else {
    ReturnOutPut = '1';
    ctx.token = loginSession(req, ObjLogin);
  }
  return ReturnOutPut;
}

/** shared tail of DistrubutionSignupKyabol / CustomerOutersignup: Registration + the two DirectSignIn calls */
async function registerAndSignIn(req, ctx, emailid, password, username, ip_address, Mobile, DID, Ref_Username, Ref_Regno, Address, Statename,
  Cityname, Pincode, currency, result) {
  const IntOutPutResult = await DAL_RegistrationOrLogin.Registration('', emailid, password, currency, cs(ps.sessionGet(req, 'CountryName')),
    username, ip_address, Mobile, toInt32(DID), Ref_Username, Ref_Regno, Address, Statename, Cityname, Pincode, req);
  if (IntOutPutResult === '1') {
    pass = password;
    userid = username;
    await DirectSignIn(req, ctx, toInt32(DID));
    result = 'success';
  }
  if (IntOutPutResult !== '0') {
    pass = password;
    userid = username;
    const ss = await DirectSignIn(req, ctx, toInt32(DID));
    if (ss === '1') result = '1';
    else result = '0';
  }
  return result;
}

/** public string DistrubutionSignupKyabol(string username, string password, string DID = "0") */
async function DistrubutionSignupKyabol(req, ctx, username, password, DID = '0') {
  let result = '';
  password = await UtilityClass.Encryptword(password);
  let outresult = '';
  const params = { username, password };
  if (DID !== null && DID !== undefined) params.distributorid = DID; // SqlParameter with a null value is not sent (proc default applies)
  if (params.username === null || params.username === undefined) delete params.username;
  const DistLogin = await db.proc(DB, 'usp_getlogindetails', params);
  let Mobile = ''; let emailid = ''; let Ref_Username = ''; let Address = ''; let Statename = ''; let Cityname = ''; let Pincode = '';
  let Ref_Regno = 0;
  for (const Item of DistLogin) {
    if (ci(Item, 'Result') === 'SUCCESS') {
      outresult = ci(Item, 'Result');
      Mobile = S(ci(Item, 'MOBILE'));
      emailid = S(ci(Item, 'EMAILID'));
      Ref_Username = S(ci(Item, 'Username'));
      const plid = ci(Item, 'PLID');
      if (plid === null || plid === undefined) throw new Error("The 'PLID' property on 'DistributerLogin' could not be set to a 'null' value.");
      Ref_Regno = Number(plid);
      Address = S(ci(Item, 'ADDRESS'));
      Pincode = S(ci(Item, 'PINCODE'));
      Statename = S(ci(Item, 'STATENAME'));
      Cityname = S(ci(Item, 'CITYNAME'));
      // Countryname = Item.COUNTRYNAME (unused)
    } else {
      result = 'Invalid Username or Password';
      break;
    }
  }
  if (outresult === 'SUCCESS') {
    password = await UtilityClass.Decryptword(password);
    const validate_Var = await DAL_RegistrationOrLogin.validate(emailid, username, password);
    const currency = cs(ps.sessionGet(req, 'CURRENCYCODE'));
    const ip_address = await GetIP.GetLocalIP(req);
    if (validate_Var !== 'ok') return validate_Var;
    result = await registerAndSignIn(req, ctx, emailid, password, username, ip_address, Mobile, DID, Ref_Username, Ref_Regno, Address,
      Statename, Cityname, Pincode, currency, result);
  } else {
    result = 'Invalid Username or Password';
  }
  return result;
}

/** public string CustomerOutersignup(string DID = "0", string Tokenid = "") */
async function CustomerOutersignup(req, ctx, DID = '0', Tokenid = '') {
  let result = '';
  const Url = config.app.Weburl; // WebConfigurationManager.AppSettings["Weburl"]
  let outresult = ''; let previousPageUrl = '';
  const referer = req.headers.referer || req.headers.referrer;
  if (referer) previousPageUrl = referer; // Request.UrlReferrer.AbsoluteUri
  else previousPageUrl = 'direct';
  const _Outersitesourcelog = {};
  const url = `${cs(Url)}/api/distributer-auto-processing?Did=${cs(DID)}&TokenId=${cs(Tokenid)}`;
  const json = (await axios.get(url, { responseType: 'text', transformResponse: (x) => x })).data;
  let Outerlogin = null;
  const t = json === null || json === undefined ? '' : String(json).trim();
  if (t !== '') Outerlogin = JSON.parse(t); // JavaScriptSerializer.Deserialize ("" / "null" => null)
  const Outerlogins = [Outerlogin];
  let Mobile = ''; let emailid = ''; let Ref_Username = ''; let Address = ''; let Statename = ''; let Cityname = ''; let Pincode = '';
  let Countryname = ''; let password = ''; const username = '';
  let Ref_Regno = 0;
  for (const Item of Outerlogins) {
    if (Item === null || typeof Item !== 'object') throw NRE();
    if (ci(Item, 'Flag') === 'success') {
      outresult = ci(Item, 'Flag');
      Mobile = S(ci(Item, 'Mobile'));
      emailid = S(ci(Item, 'EmailId'));
      Ref_Username = S(ci(Item, 'UserName'));
      const rr = S(ci(Item, 'Ref_Regno'));
      Ref_Regno = toInt32(rr === '' ? '0' : (rr === null ? null : String(rr)));
      Address = S(ci(Item, 'Address'));
      Pincode = S(ci(Item, 'Pincode'));
      Statename = S(ci(Item, 'StateName'));
      Cityname = S(ci(Item, 'CityName'));
      Countryname = S(ci(Item, 'CountryName'));
    } else {
      result = 'Invalid Username or Password';
      break;
    }
  }
  if (outresult === 'success') {
    password = 'User@123'; // legacy hard-coded password
    const validate_Var = await DAL_RegistrationOrLogin.validate(emailid, username, password);
    const currency = cs(ps.sessionGet(req, 'CURRENCYCODE'));
    const ip_address = await GetIP.GetLocalIP(req);
    if (validate_Var !== 'ok') return validate_Var;
    result = await registerAndSignIn(req, ctx, emailid, password, username, ip_address, Mobile, DID, Ref_Username, Ref_Regno, Address,
      Statename, Cityname, Pincode, currency, result);
    _Outersitesourcelog.DID = toInt32(DID);
    _Outersitesourcelog.URL = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    _Outersitesourcelog.TokenId = toInt32(Tokenid);
    _Outersitesourcelog.Previousurl = previousPageUrl;
    _Outersitesourcelog.Ipaddress = ip_address;
    _Outersitesourcelog.Country = Countryname;
    _Outersitesourcelog.state = Statename;
    _Outersitesourcelog.city = Cityname;
    _Outersitesourcelog.status = 1;
    // Db._Outersitesourcelog.Add(...); Db.SaveChanges();  (Create_date = DateTime.Now)
    await db.exec(DB, `insert into tbl_othersitesoure_log (did, url, tokenid, previousurl, ipaddress, country, state, city, status, create_date)
      values (@DID, @URL, @TokenId, @Previousurl, @Ipaddress, @Country, @state, @city, @status, now())`, _Outersitesourcelog);
  } else {
    result = 'Invalid Username or Password';
  }
  return result;
}

const sendWithToken = (res, ctx) => { if (ctx.token) res.setHeader('x-auth-token', ctx.token); };

// ---------------------------------------------------------------- DistrubutionSignupKyabol(string username, string password, string DID = "0")
// public (public string method of the controller = MVC action; logs the customer in)
router.all(`${C}/DistrubutionSignupKyabol{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const ctx = {};
  const result = await DistrubutionSignupKyabol(req, ctx, mvcStr(req, 'username'), mvcStr(req, 'password'), mvcStr(req, 'DID', '0'));
  sendWithToken(res, ctx);
  return content(res, result);
}));

// ---------------------------------------------------------------- DirectSignIn(int DID = 0)
// public (login action; uses the static pass/userid)
router.all(`${C}/DirectSignIn{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const ctx = {};
  const result = await DirectSignIn(req, ctx, mvcOptInt(req, 'DID', 0));
  sendWithToken(res, ctx);
  return content(res, result);
}));

// ---------------------------------------------------------------- CustomerOutersignup(string DID = "0", string Tokenid = "")
// public (login action)
router.all(`${C}/CustomerOutersignup{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const ctx = {};
  const result = await CustomerOutersignup(req, ctx, mvcStr(req, 'DID', '0'), mvcStr(req, 'Tokenid', ''));
  sendWithToken(res, ctx);
  return content(res, result);
}));

// PORT-NOTE: in legacy the friendly route "login_as_yourchoice/{username}/{password}/{did}" (all optional) was registered before
//   {controller}/{action}, so /Login_as_yourchoice/<Action> always reached Index (username = "<Action>", decrypting to "").
//   The action routes are registered first here so they stay reachable; the Index result for those URLs was a no-op redirect.
// ---------------------------------------------------------------- Index(string username, string password, string did = "1")
// route-config: "login_as_yourchoice/{username}/{password}/{did}" -> Login_as_yourchoice/Index (all three optional)
// public (login action)
router.all([`${C}/Index{/:id}`, C, '/portal/login_as_yourchoice/:username{/:password}{/:did}'], ps.portalSession, asyncHandler(async (req, res) => {
  const username = mvcStr(req, 'username');
  const password = mvcStr(req, 'password');
  const did = mvcStr(req, 'did', '1');
  const ctx = {};
  let Username = ''; let Password = ''; let Did = ''; let result = ''; let tokenid = ''; let Token = '';
  tokenid = qs(req, 'TokenId');
  Username = await UtilityClass.Decryptword(username);
  Password = await UtilityClass.Decryptword(password);
  if (did != null) {
    if (did.includes('=')) Did = await UtilityClass.Decryptword(did);
    else Did = qs(req, 'Did');
  }
  if (tokenid != null) {
    if (tokenid.includes('=')) Token = await UtilityClass.Decryptword(tokenid);
    else Token = qs(req, 'TokenId');
  }
  if (Username !== '' && Password !== '' && Did !== '') {
    result = String(await DistrubutionSignupKyabol(req, ctx, Username, Password, Did));
  } else if (Did !== '' && Token !== '') {
    result = await CustomerOutersignup(req, ctx, Did, Token);
  }
  if (result === '1') {
    return redirectJson(res, '/Home/Index', ctx.token);
  } else if (result === 'success') {
    result = 'success';
  } else {
    result = 'Invalid Username or Password';
  }
  return redirectJson(res, C, ctx.token); // RedirectToAction("")
}));

module.exports = router;
