'use strict';
// Ported from Member/Common/Controllers/VisitorSignupController.cs  (controller "visitor_signup", 21 public actions)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
// Session -> JWT / utils/sessionStore:
//   * Session["Plid"] (Login object: Plid, Pmid, Smdid, LoginID, UserName, Name, Cid, MOBILE, EMAILID, SecretCode) is put in the JWT payload at login
//     (lower-case keys: plid, pmid, smdid, loginid, username, name, cid, mobile, emailid, secretcode; plus userType:'member').
//   * Session["Member_User_Menu"] -> sessionStore key 'Member_User_Menu' (member subject); also returned in the login response.
//   * Anonymous visitor values (SessionOTP, SessionEmailOTP, LoginType, transids, CURRENCYCODE, CountryName, TempData["ml"]) -> sessionStore (subject anon:<ip>).
// PORT-NOTE: login responses were bare JSON strings ("1", "0", "2^..."). On success ("1") the body is now {result:"1", token, ...Login values, Member_User_Menu}; every other string response is unchanged.
// PORT-NOTE: SignIn's two-factor branch ("2^loginid^password") does NOT issue a token (legacy had already stored Session["Plid"] at that point); the token is issued by SignIn1 after the GA key check.
// Config keys used (config.app.*): secretkey (reCAPTCHA secret), LogPath.
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const router = express.Router();
const config = require('../../config');
const { query, queryOne, scalar, proc } = require('../../db');
const { auth, optionalAuth, signToken } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const GetIP = require('../../lib/member/GetIP');
const DAL_RegistrationOrLogin = require('../../lib/member/DAL_RegistrationOrLogin');
const Security_Key = require('../../lib/member/Security_Key');

const DB = 'affiliate';
const BASE = '/member/visitor_signup';
const MENU_PROPS = ['mid', 'mainMenuTitle', 'mainhref', 'aiClass', 'bClass', 'sid', 'subMenuTitle', 'subhref', 'isEdit', 'HeaderClass', 'isDelete', 'Active', 'rid'];
const DETAILS_PROPS = ['TDPMFRID', 'FIELDNAME', 'DISPLAYSHOW', 'SHOWACTIVE', 'VALIDATIONACTIVE', 'ISEDIT', 'STATUS', 'ACTIVE', 'FID', 'ISADVANCE', 'ISSETTINGS', 'CONTROLNAME'];

const s = (v) => (v === undefined || v === null ? '' : String(v));
const isNull = (v) => v === undefined || v === null;
const NRE = () => new Error('Object reference not set to an instance of an object.');
const outv = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
const fire = (fn) => { Promise.resolve().then(fn).catch(() => { /* background thread failures are not observable in the legacy app */ }); };
// MVC binds a non-nullable int action parameter; a missing/invalid value fails the request (500)
const reqInt = (v) => { const n = parseInt(v, 10); if (isNull(v) || v === '' || Number.isNaN(n)) throw new Error('The parameters dictionary contains a null entry for a non-nullable parameter.'); return n; };
async function errInsert(req, name, e) {
  try { const DataUtility = require('../../lib/member/DataUtility'); await new DataUtility().ErrorInsert(0, e && e.message, name, 0, req.path); } catch (_) { /* ErrorInsert must never throw */ }
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
const sessionOtp = (req, key) => { const v = sessionStore.get(req, key); if (isNull(v)) throw NRE(); return String(v); };
const showActive = async (id) => { const r = await scalar(DB, 'select showactive from tbl_detailspagemasterforregistration where tdpmfrid = @id limit 1', { id }); return isNull(r) ? 0 : r; };

// public static bool ValidateCaptcha(string response) (static helper, not an action)
async function ValidateCaptcha(response) {
  const secret = s(config.app.secretkey);
  const r = await axios.get('https://www.google.com/recaptcha/api/siteverify', { params: { secret, response }, responseType: 'text', transformResponse: (d) => d });
  const captchaResponse = JSON.parse(r.data);
  return Boolean(captchaResponse.success);
}

// public MemberLOGINLOG(...) body (also routed as an action below)
async function MemberLOGINLOG(LoginID, Password, ip, Status) {
  // PORT-NOTE: @TOTALCOUNT / @ALLOGID OUT are read from the columns of the single result row
  const rows = await proc(DB, 'usp_memberloginlog', { username: LoginID, password: Password, ipaddress: ip, status: Status });
  let ReturnOutPut = '';
  if (Status === 'Failed') {
    let rem = parseInt(outv(rows[0], 'totalcount'), 10);
    if (Number.isNaN(rem)) throw new Error('Object cannot be cast from DBNull to other types.');
    rem = 5 - rem;
    if (rem < 0) ReturnOutPut = '0';
    else ReturnOutPut = rem + ' Attempt Remaining';
  } else {
    ReturnOutPut = '0';
  }
  return ReturnOutPut;
}

// Usp_PickAdminUserRights_memberpanel @EmpID=1,@PLID -> Session["Member_User_Menu"]
async function loadMenu(plid) {
  return mapRows(await proc(DB, 'usp_pickadminuserrights_memberpanel', { empid: 1, plid }), MENU_PROPS);
}

// Session["Plid"] = ObjLogin  =>  JWT carrying every session value + the per-member store
async function buildLoginResponse(req, ObjLogin) {
  const payload = {};
  for (const k of Object.keys(ObjLogin)) payload[k.toLowerCase()] = ObjLogin[k];
  payload.userType = 'member';
  payload.userName = payload.username;
  const token = signToken(payload);
  const menu = await loadMenu(Number(ObjLogin.Plid));
  const prev = req.user;
  req.user = payload; // sessionStore subject = member:<plid>
  sessionStore.set(req, 'Member_User_Menu', menu);
  req.user = prev;
  return {
    result: '1', token, Plid: ObjLogin.Plid, Pmid: ObjLogin.Pmid, Smdid: ObjLogin.Smdid, LoginID: ObjLogin.LoginID, UserName: ObjLogin.UserName,
    Name: ObjLogin.Name, Cid: ObjLogin.Cid, MOBILE: ObjLogin.MOBILE, EMAILID: ObjLogin.EMAILID, Member_User_Menu: menu,
  };
}

// referrel_login(string favoriteurl)
// route-config: login
// public
router.all([`${BASE}/referrel_login{/:id}`, '/member/login'], asyncHandler(async (req, res) => {
  try {
    const ViewBag = {};
    if (!isNull(req.query.image)) {
      const imagesname = String(req.query.image);
      ViewBag.imagename = UtilityClass.Decryptword(imagesname);
    } else {
      const rows = await proc(DB, 'usp_memberregistration_css', { mode: 3 });
      ViewBag.imagename = rows.length ? rows[0][Object.keys(rows[0])[0]] : null;
    }
    let transid = 0;
    sessionStore.set(req, 'LoginType', 2);
    // (SHOWACTIVE is a non-nullable int in the entity, so the C# `!= null` checks are always true)
    ViewBag.ShowActive = await showActive(15);
    const ComplexPassword = await showActive(33);
    if (ComplexPassword === 0) transid = 0; else transid = 1;
    ViewBag.Transpinid = transid;
    sessionStore.set(req, 'transids', transid);
    return res.json({ view: '~/Views/visitor_signup/referrel_login_new1.cshtml', ViewBag });
  } catch (ExpObj) {
    await errInsert(req, 'referrel_login', ExpObj);
    return res.json({ redirect: '/page-not-found' });
  }
}));

// referrel_signup(string Referrelcode, string Referrelid, string Landingpage, string favoriteurl, string referralprogram)
// route-config: signup/{Referrelcode}
// public
router.all([`${BASE}/referrel_signup{/:id}`, '/member/signup/:Referrelcode'], asyncHandler(async (req, res) => {
  try {
    const Referrelcode = !isNull(req.p.Referrelcode) ? req.p.Referrelcode : req.params.Referrelcode;
    const ViewBag = {};
    const rows = await proc(DB, 'usp_memberregistration_css', { mode: 3 });
    ViewBag.imagename = rows.length ? rows[0][Object.keys(rows[0])[0]] : null;
    ViewBag.LoginidPassword = String(await UtilityClass.RandomStringByLength(8));
    ViewBag.IsActiveLoginPass = mapRow(await queryOne(DB, 'select * from tbl_detailspagemasterforregistration where tdpmfrid = 25 limit 1'), DETAILS_PROPS);
    const cookies = parseCookies(req);
    if (!isNull(Referrelcode) && Referrelcode !== '') {
      const row = await queryOne(DB, 'select regno from member_master where username = @code limit 1', { code: Referrelcode });
      if (row) {
        ViewBag.PageNotFound = 'Ok';
        res.cookie('Referrelcode', Referrelcode, { expires: monthAhead() });
        ViewBag.Referrelid = Referrelcode;
      }
    } else if (isNull(cookies.Referrelcode) || cookies.Referrelcode === '') {
      res.cookie('Referrelcode', '', { expires: monthAhead() });
    } else {
      ViewBag.Referrelid = cookies.Referrelcode;
      res.cookie('Referrelcode', ViewBag.Referrelid, { expires: monthAhead() });
    }
    ViewBag.Side = 0;
    const referalid = ViewBag.Referrelid;
    if (!isNull(referalid) && referalid !== '') {
      const Side = await queryOne(DB, 'select defaultsponserside from member_master where username = @u limit 1', { u: referalid });
      if (Side) ViewBag.Side = Side.defaultsponserside;
    }
    const det = await query(DB, "SELECT coalesce(fieldname, '') as fieldname FROM tbl_detailspagemasterforregistration ORDER BY displayshow ASC");
    const Details = det.map((r) => r.fieldname);
    ViewBag.Details = Details;
    return res.json({ view: '~/Views/visitor_signup/referrel_signup_new.cshtml', Model: Details, ViewBag });
  } catch (ExpObj) {
    await errInsert(req, 'referrel_signup', ExpObj);
    return res.json({ redirect: '/page-not-found' });
  }
}));

// Logout(): Session.Abandon / Session.Clear => the client drops the token (server-side per-member store is cleared here)
// public
router.all(`${BASE}/Logout{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  if (req.user) {
    for (const k of ['Member_User_Menu', 'SessionOTP', 'SessionEmailOTP', 'PaymentForOrder']) sessionStore.set(req, k, null);
  }
  res.json('Logout');
}));

// SignIn(string LoginID, string Password, string GoogleCaptcha)
// public
router.all(`${BASE}/SignIn{/:id}`, asyncHandler(async (req, res) => {
  try {
    const LoginID = req.p.LoginID;
    let Password = req.p.Password;
    const GoogleCaptcha = req.p.GoogleCaptcha;
    if (!isNull(GoogleCaptcha) && GoogleCaptcha !== '') {
      const isCapthcaValid = await ValidateCaptcha(GoogleCaptcha);
      if (!isCapthcaValid) return res.json('Invalid Captcha.');
    }
    let ReturnOutPut = '1';
    Password = UtilityClass.Encryptword(Password);
    const ip = await GetIP.GetLocalIP(req);
    const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(LoginID, Password, ip);
    if (ObjLogin === null || ObjLogin === undefined) {
      ReturnOutPut = await MemberLOGINLOG(LoginID, Password, ip, 'Failed');
      return res.json(ReturnOutPut);
    }
    await MemberLOGINLOG(LoginID, Password, ip, 'Success');
    sessionStore.set(req, 'transids', '0');
    // int.Parse(Session["transids"]) == 0 is always true here
    let objs = new Security_Key();
    objs = await objs.Get_Security_Key(ObjLogin.Plid);
    if (objs) {
      objs.plid = parseInt(ObjLogin.Plid, 10);
      sessionStore.set(req, 'TempData.ml', objs);
      const gakey = '2';
      ReturnOutPut = gakey + '^' + LoginID + '^' + UtilityClass.Decryptword(Password);
      return res.json(ReturnOutPut);
    }
    return res.json(await buildLoginResponse(req, ObjLogin));
  } catch (EX) {
    return res.json(EX.message);
  }
}));

// public string MemberLOGINLOG(string LoginID, string Password, string ip, string Status): routable public method.
// Writes login-attempt rows, so it is protected here (it is only used internally by SignIn in the legacy UI).
// auth
router.all(`${BASE}/MemberLOGINLOG{/:id}`, auth, asyncHandler(async (req, res) => {
  const { LoginID, Password, ip, Status } = req.p;
  res.type('text/plain').send(await MemberLOGINLOG(LoginID, Password, ip, Status));
}));

// SignIn1(string LoginID, string Password, string gakey)
// public
router.all(`${BASE}/SignIn1{/:id}`, asyncHandler(async (req, res) => {
  const LoginID = req.p.LoginID;
  const gakey = req.p.gakey;
  const Password = UtilityClass.Encryptword(req.p.Password);
  const ip = await GetIP.GetLocalIP(req);
  const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(LoginID, Password, ip);
  // C#: a failed login leaves Session["Plid"] null and the later ((Login)Session["Plid"]).Plid dereference throws (HTTP 500)
  if (ObjLogin === null || ObjLogin === undefined) throw NRE();
  let objs = new Security_Key();
  objs = await objs.Get_Security_Key(ObjLogin.Plid);
  if (objs) {
    const ActiveKey = objs.Status;
    const ValidRandomNo = await DAL_RegistrationOrLogin.CheckRandomNo(parseInt(ObjLogin.Plid, 10));
    if (ActiveKey === 1) {
      if (!(await objs.Check_GaKey(ObjLogin.Plid, ValidRandomNo, gakey))) {
        return res.json('Please enter valid GA key !');
      }
    }
  }
  return res.json(await buildLoginResponse(req, ObjLogin));
}));

// ForgetPassword(string Getemailid)
// public
router.all(`${BASE}/ForgetPassword{/:id}`, asyncHandler(async (req, res) => {
  try {
    const Getemailid = req.p.Getemailid;
    const ReturnOutPut = 1;
    const Row = await queryOne(DB, 'select regno, loginid, fname, lname, username, emailid, mobile from member_master where username = @u limit 1', { u: Getemailid });
    if (!Row) return res.json('0');
    try {
      const pr = await proc(DB, 'usp_getpassworddetails', { mode: 1, regno: Row.regno });
      const Password = pr.length ? pr[0][Object.keys(pr[0])[0]] : null;
      const Emailid = Row.emailid;
      const subject = 'Forgot Password';
      const rndnumber = String(Math.floor(Math.random() * 2147483647));
      let Encryt = UtilityClass.Encryptword(Row.loginid);
      Encryt = Encryt + '/' + rndnumber;
      const fullname = s(Row.fname) + ' ' + s(Row.lname);
      const smscontent = await queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id = 15 limit 1');
      const emailcontent = await queryOne(DB, 'select email_content, email_send_status from tbl_emailaction where eid = 12 limit 1');
      if (!smscontent || !emailcontent) throw NRE();
      let Emailcont = await UtilityClass.FindingEmailContentWithUserIdPassword(Row.username, emailcontent.email_content, s(Emailid).toLowerCase(), '', 4, '');
      Emailcont = Emailcont.split('$$Encryt$$').join(Encryt);
      let Smsconte = await UtilityClass.FindingSmsContentWithUserIdPassword(Row.username, smscontent.sms_content, Row.loginid, '', 8, '', fullname);
      Smsconte = Smsconte.split('$$Encryt$$').join(Encryt);
      if (smscontent.sms_send_status === 1) {
        fire(() => UtilityClass.SendSMSWithAPI(Row.mobile, Smsconte, '1'));
      }
      if (emailcontent.email_send_status === 1) {
        fire(() => UtilityClass.SendEmailByApiSetting(Row.username, '', '', '', '', '', Emailid, subject, Emailcont, null, '', ''));
      }
      // Maintaining the Password Change History
      await query(DB, 'Insert Into tbl_password_change_history (plid, oldpassword, resetlink, changedate, islinkexpired) Values (@plid, @old, @link, now(), 0)', { plid: Row.regno, old: Password, link: Encryt });
    } catch (ExpObj) {
      await errInsert(req, 'Start Mail and Sms Sent Dynamic', ExpObj);
    }
    return res.json(String(ReturnOutPut));
  } catch (ExpObj) {
    return res.json(String(ExpObj.message));
  }
}));

// SignUpNow(string email, string password, string username, string MobileNo, string Sponser, string VerificationCode, int Country, int State, string Cityname, string FullName,
//   string GoogleCaptcha, string side, int chkreffval, int Gender, string DOB, string parentid, int Ctid, string Lastname, string StateName, string Otp, string VerificationEmailOtp,
//   string Pincode, string CouponCode, string Btcaddress, string Facebooklink, string Address, string pancard, string MaritalStatus, int Title)
// public
router.all(`${BASE}/SignUpNow{/:id}`, asyncHandler(async (req, res) => {
  const p = req.p;
  const Country = reqInt(p.Country);
  const State = reqInt(p.State);
  const chkreffval = reqInt(p.chkreffval);
  const Gender = reqInt(p.Gender);
  const Ctid = reqInt(p.Ctid);
  const Title = reqInt(p.Title);
  const { email, username, MobileNo, Sponser, Cityname, FullName, GoogleCaptcha, side, DOB, parentid, Lastname, StateName, Otp, VerificationEmailOtp, Pincode, CouponCode, Btcaddress, Facebooklink, Address, pancard, MaritalStatus } = p;
  let password = p.password;
  try {
    const OtpShowActive = String(await showActive(22));
    const EmailOtpShow = String(await showActive(34));
    let IsMobileVerified = 0;
    if (OtpShowActive !== '0' && MobileNo !== '') {
      const LoginOtp = sessionOtp(req, 'SessionOTP');
      if (Otp !== LoginOtp) return res.json('Please Enter Valid OTP .');
      IsMobileVerified = 1;
    }
    if (EmailOtpShow !== '0' && email !== '') {
      const LoginEmailOTP = sessionOtp(req, 'SessionEmailOTP');
      if (VerificationEmailOtp !== LoginEmailOTP) return res.json('Please Enter Valid Email OTP .');
    }
    if (!isNull(GoogleCaptcha) && GoogleCaptcha !== '') {
      const isCapthcaValid = await ValidateCaptcha(GoogleCaptcha);
      if (!isCapthcaValid) return res.json('Invalid Captcha.');
    }
    if (isNull(username)) throw NRE();
    if (username.length !== username.split(' ').join('').length) return res.json('Username must not contain space.');
    const ip_address = await GetIP.GetLocalIP(req);
    password = UtilityClass.Encryptword(password);
    const validate_Var = await DAL_RegistrationOrLogin.validate(email, username, password);
    if (validate_Var !== 'ok') return res.json(validate_Var);
    if (!isNull(Sponser) && Sponser !== '') {
      const rows = await proc(DB, 'usp_scalerdata', { mode: 3, identity: Sponser });
      if (!rows.length) return res.json('Invalid Sponser Id.');
    }
    const currency = s(sessionStore.get(req, 'CURRENCYCODE'));
    const IntOutPutResult = await DAL_RegistrationOrLogin.Registration(Sponser, email, password, currency, s(sessionStore.get(req, 'CountryName')), username, ip_address, MobileNo,
      'referral-login', Country, State, Cityname, FullName, side, chkreffval, parentid, Gender, DOB, pancard, Ctid, Lastname, StateName, Pincode, CouponCode, Btcaddress,
      Facebooklink, Address, MaritalStatus, IsMobileVerified, Title);
    const Arrary = String(IntOutPutResult).split('^');
    const Result = Arrary[0];
    if (Result.toLowerCase() === 'success') return res.json(IntOutPutResult);
    return res.json(Result);
  } catch (ExpObj) {
    return res.json(ExpObj.message);
  }
}));

// public void Log(string ParameterName, string logMessage): appends to the log file (AppSettings["LogPath"]). Routable void action; writes to disk => auth.
// auth
router.all(`${BASE}/Log{/:id}`, auth, asyncHandler(async (req, res) => {
  const rel = s(config.app.LogPath).replace(/^~?[\\/]+/, '') || 'Log/log.txt';
  const file = path.join(config.uploadDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.closeSync(fs.openSync(file, 'w'));
  fs.appendFileSync(file, s(req.p.ParameterName) + ':' + s(req.p.logMessage) + '\n');
  res.status(200).end();
}));

// BINDSTATEONCID(int CID)
// public
router.all(`${BASE}/BINDSTATEONCID{/:id}`, asyncHandler(async (req, res) => {
  const rows = await query(DB, 'select sid, cid, statename, scode, sactive from state where cid = @cid and sactive = true order by statename', { cid: reqInt(req.p.CID) });
  res.json(mapRows(rows, ['SID', 'CID', 'STATENAME', 'SCODE', 'SACTIVE']));
}));

// BindCITy(int SID)
// public
router.all(`${BASE}/BindCITy{/:id}`, asyncHandler(async (req, res) => {
  const rows = await query(DB, 'select ctid, cid, sid, cityname, active from city where sid = @sid and active = true order by cityname', { sid: reqInt(req.p.SID) });
  res.json(mapRows(rows, ['CTID', 'CID', 'SID', 'CITYNAME', 'ACTIVE']));
}));

// CheckCheckboxOnTheBehalfOfPermission()
// public
router.all(`${BASE}/CheckCheckboxOnTheBehalfOfPermission{/:id}`, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_getdataforregistration', { mode: 1 });
  res.json(mapRows(rows, ['FID', 'Status', 'VALIDATIONACTIVE', 'ACTIVE', 'FIELDNAME', 'SHOWACTIVE']));
}));

// ChkIPAddress()
// public
router.all(`${BASE}/ChkIPAddress{/:id}`, asyncHandler(async (req, res) => {
  const ip = await GetIP.GetLocalIP(req);
  // PORT-NOTE: @Result / @TOTALCOUNT OUT are read from the columns of the first result row ('' when no rows)
  const rows = await proc(DB, 'usp_blocklinkip', {
    from: '', blid: '0', to: '', emp_id: '0', emp_name: '', maxrow: '', startindexrow: '', mode: '4', ip_address: ip,
  });
  res.json(s(outv(rows[0], 'result')));
}));

// mode 1 mobile / 2 email / 3 pan duplicate check: @RESULT OUT is read from the "result" column
async function checkDynamic(mode, mobile, email, panno) {
  const rows = await proc(DB, 'usp_checkdynmic_mobileemailpan', { mode, mobile, email, panno });
  return s(outv(rows[0], 'result'));
}

// GenerateOTPForSendEmail(string UserName, string EmailID)
// public
router.all(`${BASE}/GenerateOTPForSendEmail{/:id}`, asyncHandler(async (req, res) => {
  const { UserName, EmailID } = req.p;
  const EmailOTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  sessionStore.set(req, 'SessionEmailOTP', EmailOTP);
  const OutResult = await checkDynamic(2, '', EmailID, '');
  if (OutResult !== 'success' && OutResult === 'Email ID Allready Exists !') {
    return res.json(returnmessage + '^' + 'Email Id Already Exist!!!');
  }
  const msg = await queryOne(DB, 'select email_content, email_send_status from tbl_emailaction where eid = 1061 limit 1');
  if (!msg) throw NRE();
  const EmailStatus = msg.email_send_status;
  const OtpShowActive = String(await showActive(34));
  if (EmailStatus === 1) {
    const DynamicMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(UserName, msg.email_content, '', EmailOTP, 9, '');
    fire(() => UtilityClass.SendEmailByApiSetting(UserName, '', '', '', '', '', s(EmailID).toLowerCase(), 'Signup Verification OTP', DynamicMsg, null));
    returnmessage = 'OTP SENT';
  } else {
    returnmessage = 'Please Enable for Email Send Status';
  }
  res.json(returnmessage + '^' + OtpShowActive);
}));

// GenerateOTP(string UserName, string MobileNumber)
// public
router.all(`${BASE}/GenerateOTP{/:id}`, asyncHandler(async (req, res) => {
  const { UserName, MobileNumber } = req.p;
  const OTP = String(await UtilityClass.RandomNumberStringByLength(4));
  let returnmessage = 'OTP SENT';
  sessionStore.set(req, 'SessionOTP', OTP);
  const OutResult = await checkDynamic(1, MobileNumber, '', '');
  if (OutResult !== 'success' && OutResult === 'Mobile No. Allready Exists !') {
    return res.json(returnmessage + '^' + 'Mobile No. Already Exist!!!');
  }
  const msg = await queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id = 20 limit 1');
  if (!msg) throw NRE();
  const Mobilestatus = msg.sms_send_status;
  const OtpShowActive = String(await showActive(22));
  const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(UserName, msg.sms_content, UserName, OTP, 2);
  if (Mobilestatus === 1) {
    fire(() => UtilityClass.SendSMSWithAPI(MobileNumber, messg, '1'));
    returnmessage = 'OTP SENT';
  } else {
    returnmessage = 'Please Enable for Mobile Send Status';
  }
  res.json(returnmessage + '^' + OtpShowActive);
}));

// CheckMobileOTP(string MobileOTP): the C# guard (MobileOTP != null || MobileOTP != "") is always true
// public
router.all(`${BASE}/CheckMobileOTP{/:id}`, asyncHandler(async (req, res) => {
  const SessonOtp = sessionOtp(req, 'SessionOTP');
  res.json(req.p.MobileOTP === SessonOtp ? 'Success' : 'You have Entered Wrong OTP');
}));

// CheckEmailOTP(string EmailOTP)
// public
router.all(`${BASE}/CheckEmailOTP{/:id}`, asyncHandler(async (req, res) => {
  const SessonEmailOtp = sessionOtp(req, 'SessionEmailOTP');
  res.json(req.p.EmailOTP === SessonEmailOtp ? 'Success' : 'You have Entered Wrong OTP');
}));

// Checkotpon(string UserName, string MobileNumber)
// public
router.all(`${BASE}/Checkotpon{/:id}`, asyncHandler(async (req, res) => {
  const returnmessage = 'OTP SENT';
  const OutResult = await checkDynamic(1, req.p.MobileNumber, '', '');
  if (OutResult !== 'success' && OutResult === 'Mobile No. Allready Exists !') {
    return res.json(returnmessage + '^' + 'Mobile No. Already Exist!!!');
  }
  const msg = await queryOne(DB, 'select sms_send_status from tbl_smsaction where id = 20 limit 1');
  if (!msg) throw NRE();
  const OtpShowActive = String(await showActive(22));
  res.json(returnmessage + '^' + OtpShowActive);
}));

// CheckotponEmail(string UserName, string EmailID)
// public
router.all(`${BASE}/CheckotponEmail{/:id}`, asyncHandler(async (req, res) => {
  const returnmessage = 'OTP SENT';
  const OutResult = await checkDynamic(2, '', req.p.EmailID, '');
  if (OutResult !== 'success' && OutResult === 'Email ID Allready Exists !') {
    return res.json(returnmessage + '^' + 'Email Id Already Exist!!!');
  }
  const OtpShowActive = String(await showActive(34));
  res.json(returnmessage + '^' + OtpShowActive);
}));

// AllreadyExistPanNo(string PanNo)
// public
router.all(`${BASE}/AllreadyExistPanNo{/:id}`, asyncHandler(async (req, res) => {
  const OutResult = await checkDynamic(3, '', '', req.p.PanNo);
  if (OutResult !== 'success' && OutResult === 'Pan No. Allready Exists !') return res.json('success');
  return res.json('Done');
}));

// public void SaveGLoginGEODetails(int ALLOGID): routable void action (its call in SignIn is commented out in the C#); writes login geo data => auth
// PORT-NOTE: System.Environment/NetworkInterface/HttpBrowserCapabilities are replaced by Node os + the User-Agent header.
// auth
router.all(`${BASE}/SaveGLoginGEODetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const ALLOGID = reqInt(req.p.ALLOGID);
  const host = s(req.hostname);
  let IAddress = '';
  if (host.toLowerCase() === 'localhost') IAddress = '67.225.214.45';
  else IAddress = await GetIP.GetLocalIP(req);
  const r = await axios.get('https://extreme-ip-lookup.com/json/' + IAddress, { responseType: 'text', transformResponse: (d) => d });
  const location = JSON.parse(r.data);
  sessionStore.set(req, 'COUNTRYNAME', location.country);
  sessionStore.set(req, 'STATENAME', location.region);
  sessionStore.set(req, 'CITYNAME', location.city);
  sessionStore.set(req, 'Latitude', location.lat);
  sessionStore.set(req, 'longitude', location.lon);
  const ua = s(req.headers['user-agent']);
  const BrowserName = (/(edg|opr|chrome|firefox|safari|msie|trident)/i.exec(ua) || ['Unknown'])[0];
  const Platform = /windows/i.test(ua) ? 'WinNT' : /android/i.test(ua) ? 'Android' : /iphone|ipad|mac/i.test(ua) ? 'MacOSX' : /linux/i.test(ua) ? 'Linux' : 'Unknown';
  const nics = os.networkInterfaces();
  let sMacAddress = '';
  let NetworkId = '';
  let NetworkName = '';
  for (const name of Object.keys(nics)) {
    NetworkId = name; NetworkName = name;
    if (sMacAddress === '') sMacAddress = s(nics[name][0] && nics[name][0].mac).replace(/:/g, '').toUpperCase();
  }
  sessionStore.set(req, 'NetworkId', NetworkId);
  sessionStore.set(req, 'NetworkName', NetworkName);
  // PORT-NOTE: @StrResult OUT is read from the "strresult" column (unused by the C#)
  await proc(DB, 'usp_addlogingeodetails', {
    ip_address: IAddress, mac_address: sMacAddress, devicename: os.platform(), devicetype: '1', osversion: os.type() + ' ' + os.release(), domainanme: os.hostname(),
    browsername: BrowserName, browsertype: BrowserName, networkid: NetworkId, networkname: NetworkName, country_name: location.country, region_name: location.region,
    city: location.city, latitude: location.lat, longitude: location.lon, browserplatform: Platform, allogid: ALLOGID,
  });
  res.status(200).end();
}));

module.exports = router;
