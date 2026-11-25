'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Add_New_Referral.cs (class Add_New_ReferralController)
// Database: affiliate (Db_Affiliate). Tables: tbl_companymaster, member_login, member_master.
const fs = require('fs');
const path = require('path');
const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/admin/UtilityClass');
const GetIP = require('../../lib/admin/GetIP');
const CustomEncriptionAndDecription = require('../../lib/member/CustomEncriptionAndDecription');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nstr, nre, reqInt, toInt32, outStr, col, view, mapRows } = require('./_shared/batch02-common');
const { errorInsert: libErrorInsert } = require('../../lib/admin/_helpers');

const router = express.Router();
const C = 'Add_New_Referral';

/** class myunusedEpin */
const MYUNUSEDEPIN_PROPS = ['rowNumber', 'EpinId', 'EpinNo', 'KitDesc', 'Amount'];

// public static bool ValidateCaptcha(string response)  (static => not an MVC action; unused by the controller)
// Config: recaptcha secret (was hard-coded) => config.app.secretkey
async function ValidateCaptcha(response) {
  const secret = (config.app.secretkey || '');
  const reply = (await axios.get(`https://www.google.com/recaptcha/api/siteverify?secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(response == null ? '' : response)}`,
    { responseType: 'text', transformResponse: (x) => x })).data;
  const captchaResponse = JSON.parse(reply); // CaptchaResponse { success, error-codes }
  return !!captchaResponse.success;
}

/** CommonController.validate(email, username, password) (static helper of Controllers/CommonController.cs, inlined) */
function validate(email, username, password) {
  if (email === null || email === undefined) throw nre();
  if (email.trim() === '') return 'empty';
  // \A(?:[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\Z
  const isEmail = /^(?:[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\n?$/.test(email.trim());
  if (!isEmail) return 'wrong';
  if (password === null || password === undefined) throw nre();
  if (password.trim() === '') return 'empty';
  if (username === null || username === undefined) throw nre();
  if (username.trim() === '') return 'empty';
  return 'ok';
}

// #region mail template (verbatim)
const MAIL_TEMPLATE = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>\r\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>\r\n    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\r\n    <table cellpadding='0' cellspacing='0' style='margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>\r\n        <tbody>\r\n\r\n      <tr>\r\n        <td><table style='width:100%;'>\r\n            <tbody>\r\n              <tr>\r\n                <td width='100%' align='center'><a href='http://cryptoinbox.com/' target='UlOxf6W290vd9HCE04UigQH'> <img src='http://cryptoinbox.com/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\r\n              </tr>\r\n            </tbody>\r\n          </table></td>\r\n      </tr>\r\n        <tr>\r\n        <td>\r\n      <div>\r\n        <div class='clear'></div>\r\n        <table style='padding-bottom: 10px; width: 100%; '>\r\n          <tbody>\r\n            <tr>\r\n              <td>\r\n            <tr>\r\n              <td align='center'><strong style='font-size: 20px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> REFERRAL PROGRAM\r\n                </p>\r\n                </strong>\r\n                <div style='text-align:left;'>\r\n                  <h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42; text-align:center'>Welcome </h1>\r\n                  <h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px\r\n\r\n15px; color: #3f3f42;'>Dear $lblName$, </h1>\r\n                  <strong style='font-size: 14px;font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #3f3f42;'>We welcome you to our Referral Program. <br/> <br/>\r\n\r\n     Please note, <u>submission</u> of your KYC documents is must to run this program (check my profile on your panel). We request you to submit your KYC documents as soon as possible or <a href='http://cryptoinbox.com/referral-login' target='_blank' style='color:#00a0a8;'>www.cryptoinbox.com/referral-login  </a> to submit now.\r\n                  </strong>\r\n                  <div style='font-size: 15px; color: #333;'>\r\n                    <p style='font-size:14px; font-weight:bold;  margin-top:20px; margin-bottom:0;'>Your account information: </p>\r\n                    <p style='font-size:14px; font-weight:bold; margin:5px; margin-left:0; '> User Name: $lblName$ </p>\r\n                    <p style='font-size:14px; font-weight:bold; margin:5px; margin-left:0;'> Registered Email: $lblLoginId$ </p>\r\n                    <p style='font-size:14px; font-weight:bold;  margin:5px; margin-left:0;'> Your Password: $lblPassword$ </p>\r\n                  </div>\r\n                </div>\r\n                <div style='clear: both'></div>\r\n\r\n                <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\r\n                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>\r\n                          <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> If you have any issues,\r\n            we will be happy to help you. You can contact us on <a href = 'mailto:support@cryptoinbox.com' target = '_blank' style = 'color:#00a0a8;'> support@cryptoinbox.com </a></p>\r\n\r\n                                     </div>\r\n\r\n                                     </td>\r\n\r\n                                 </tr>\r\n                               <div style = 'clear: both'></div>\r\n                                <div style = 'clear: both'></div>\r\n                                   </td>\r\n                                   </tr>\r\n                                 <tr>\r\n\r\n                                   <td>\r\n\r\n                                   <table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>\r\n\r\n                                        <tbody>\r\n                                          <tr>\r\n                                          <td>\r\n\r\n                                              <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>\r\n\r\n                                                 <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The Crypto Inbox Team</h5>\r\n\r\n                                                </td>\r\n                                                  <td>\r\n                                                  <div style = 'margin-right: 7px; text-align:right'>\r\n\r\n                                                   <a href = 'https://www.facebook.com/CryptoInbox/' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://cryptoinbox.com/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\r\n\r\n                                                              <a href = 'https://twitter.com/CryptoInbox' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://cryptoinbox.com/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\r\n\r\n                                                                         <a href = 'https://plus.google.com/+Crypto InboxIn' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://cryptoinbox.com/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\r\n\r\n                                                                                    <a href = 'https://www.linkedin.com/company/Crypto Inbox' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://cryptoinbox.com/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\r\n\r\n                                                                                                <a href = 'https://pinterest.com/CryptoInbox/' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://cryptoinbox.com/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>\r\n\r\n                                                                                                           </div></td>\r\n\r\n                                                                                                        </tr>\r\n\r\n                                                                                                      </tbody>\r\n\r\n                                                                                                    </table></td>\r\n\r\n                                                                                                </tr>\r\n\r\n                                                                                                  </tbody>\r\n\r\n                                                                                              </table>\r\n\r\n                                                                                              <div class='clear'></div>\r\n      </div>\r\n        </td>\r\n\r\n        </tr>\r\n\r\n        </tbody>\r\n\r\n    </table>\r\n  </div>\r\n  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | cryptoinbox.com</p>\r\n</div>";
// #endregion

// public static void SendMail(int matplid, string emailid, string HtmlMailPath, string password, string username, string MobileNo, string Name)
// Config: SMTP (was hard-coded info@cryptoinbox.com / webmail.cryptoinbox.com) => CryptoInboxMailUser, CryptoInboxMailPassword, CryptoInboxMailHost, CryptoInboxMailFrom
async function SendMail(matplid, emailid, HtmlMailPath, password, username, MobileNo, Name) {
  const loginid = emailid;
  try {
    let Message = '';
    Message = 'Dear ' + username + ',\r\nyour account has been created successfully! Login Link: www.cryptoinbox.com/referral-login,\r\nUsername: ' + username
      + ' \r\nReg. Email: ' + emailid + ' \r\nPwd: ' + password + ' \r\nThank you.\r\nThe Crypto Inbox Team';
    void Message; // built but unused (legacy)
    if (!emailid) throw new Error("The parameter 'addresses' cannot be an empty string."); // new MailMessage(from, "") throws
    let myString = MAIL_TEMPLATE;
    const rep = (s, a, b) => s.split(a).join(b == null ? '' : b);
    myString = rep(myString, '$$lblName$$', username);
    myString = rep(myString, '$$lblLoginId$$', loginid);
    myString = rep(myString, '$$lblEmail$$', emailid);
    myString = rep(myString, '$$lblPassword$$', password);
    const transporter = nodemailer.createTransport({
      host: (config.app.CryptoInboxMailHost || ''), port: 25, secure: false,
      auth: { user: (config.app.CryptoInboxMailUser || ''), pass: (config.app.CryptoInboxMailPassword || '') },
    });
    await transporter.sendMail({ from: (config.app.CryptoInboxMailFrom || ''), to: emailid, subject: 'Welcome To Crypto Inbox', html: myString });
  } catch (ExpObj) {
    await libErrorInsert('SendMail', 'Controllers/AdminPanel/Add_News_Referals', ExpObj);
  }
}

// public static int AddNewCommunity(...)
async function AddNewCommunity(Referrelcode, email, password, currency, country, username, ip_address, MobileNo, SponsorIDs, PlacementIDs, Side, Title,
  FirstName, LastName, Desigantion, ImageName, Country, State, Cityname) {
  let IntOutPutResult = 0;
  if (email === null || email === undefined) throw nre();
  // [DBO].[USP_VISITOR_SIGNUP_TEMP] @LOGINID,@PASSWORD,@USERNAME,@INTRESULT Out,@MODE,@QPAYREGNO,@CURRENCYSYMBOL,@COUNTRY,@PLID OUT,@Referrelcode,
  //   @IPADDRESS,@MobileNo,@SponsorIDs,@PlacementIDs,@Side,@Title,@FirstName,@LastName,@Desigantion,@ImageName,@ModeForJoining,@CID,@SID,@CTID,
  //   @Atc_WalletAddress,@CityName
  // PORT-NOTE: the EXEC text is POSITIONAL. In the procedure, IMAGENAME is followed by MARITALSTATUS, ISMOBILESELFVERIFIED, MODEFORJOINING,
  //   CID, SID, CTID, so the last six values land shifted by two: MARITALSTATUS='1', ISMOBILESELFVERIFIED=Country, MODEFORJOINING=State,
  //   CID='0', SID='' (=> 0), CTID=Cityname (SQL Server converted it to int; a non-numeric city name failed). Reproduced as the legacy EXEC did.
  const ctid = /^\s*[+-]?\d+\s*$/.test(String(Cityname == null ? '' : Cityname)) ? Number(Cityname) : (Cityname === '' ? 0 : Cityname);
  if (typeof ctid === 'string' || ctid === null) {
    if (ctid !== null) throw new Error(`Error converting data type varchar to int.`);
  }
  const row = await db.procOne(DB, 'USP_VISITOR_SIGNUP_TEMP', {
    LOGINID: email.trim(), PASSWORD: password, USERNAME: username, MODE: '0', QPAYREGNO: '0', CURRENCYSYMBOL: currency, COUNTRY: country,
    REFERRELCODE: Referrelcode, IPADDRESS: ip_address, MOBILENO: MobileNo, SPONSORIDS: SponsorIDs, PLACEMENTIDS: PlacementIDs, SIDE: Side, TITLE: Title,
    FIRSTNAME: FirstName, LASTNAME: LastName, DESIGANTION: Desigantion, IMAGENAME: ImageName,
    MARITALSTATUS: '1', ISMOBILESELFVERIFIED: Country, MODEFORJOINING: State, CID: 0, SID: 0, CTID: ctid,
  });
  IntOutPutResult = toInt32(outStr(col(row, 'intresult')));
  if (IntOutPutResult === 1) {
    const TempPLID = Number(outStr(col(row, 'plid')));
    const plid = Math.round(TempPLID);
    const MobileNoNoForSendSms = MobileNo;
    const crow = await db.queryOne(DB, 'select name from tbl_companymaster where comid = 1 limit 1', {});
    const companyname = crow ? col(crow, 'name') : null;
    const cn = companyname == null ? '' : companyname;
    const Message = 'Dear ' + username + ',\r\nYour account has been created successfully.Please click on the link to login your account www.' + cn
      + '.com/referral-login,\r\nUsername: ' + username + '\r\nPassword: ' + password + '\r\nThank you!\r\n' + cn;
    // new Thread(...).Start() => fire-and-forget
    (async () => {
      await SendMail(plid, email, '', password, username, MobileNo, FirstName);
      await UtilityClass.SendMsgOnMobile(MobileNoNoForSendSms, Message);
    })().catch((e) => console.error('[Add_New_Referral] mail/sms thread:', e.message));
  }
  return IntOutPutResult;
}

// protected void SendMailAndMsg(string okwithregno)  (not routable; never called in the controller)
async function SendMailAndMsg(okwithregno) {
  try {
    const Currency = config.app.Currency; // read, unused (legacy)
    void Currency;
    if (okwithregno !== '' && okwithregno.indexOf('ok^') > -1) {
      const stringsplit = okwithregno.trim().split('^');
      const regNo = Number(stringsplit[1]);
      const Ml = await db.queryOne(DB, 'select regno, loginid, password, tpassword from member_login where regno = @regNo limit 1', { regNo });
      const MM = await db.queryOne(DB, 'select regno, username, mobile, emailid from member_master where regno = @regNo limit 1', { regNo });
      const crow = await db.queryOne(DB, 'select software_url from tbl_companymaster where comid = 1 limit 1', {});
      const companyname = crow ? col(crow, 'software_url') : null;
      if (!Ml || !MM) throw nre();
      const MobileMsg = 'Welcome to company, your account is created successfully. Your Loginid is: ' + (col(Ml, 'loginid') ?? '') + ' and Password='
        + (col(Ml, 'password') ?? '') + ' and Trans. Password is :' + (col(Ml, 'tpassword') ?? '') + ' Visit ' + (companyname ?? '');
      if (col(MM, 'mobile') !== '') {
        await UtilityClass.SendMsgOnMobile(col(MM, 'mobile'), MobileMsg);
      }
      if (col(MM, 'emailid') !== '') {
        const Subject = 'Welcome to Company.';
        const ReadFile = fs.readFileSync(path.join(config.uploadDir, 'welcome-login.html'), 'utf8'); // Server.MapPath("~/welcome-login.html")
        let MyString = ReadFile;
        const rep = (s, a, b) => s.split(a).join(b == null ? '' : b);
        MyString = rep(MyString, '$$lblLoginId$$', col(MM, 'username'));
        MyString = rep(MyString, '$$lblpassword$$', col(Ml, 'password'));
        MyString = rep(MyString, '$$lbltpassword$$', col(Ml, 'tpassword'));
        const resultMailSend = await UtilityClass.Send('', col(MM, 'emailid'), '', '', Subject, MyString);
        void resultMailSend;
      }
    }
  } catch (ExpObj) {
    await libErrorInsert('SendMailAndMsg', 'Controllers/AdminPanel/Add_News_Referals', ExpObj);
  }
}

// public static string EncryptFunction(string number)
function EncryptFunction(number) {
  const p = new CustomEncriptionAndDecription();
  return p.encryption(number);
}

// private static bool ThumbnailCallback() => throw new NotImplementedException();
function ThumbnailCallback() {
  throw new Error('The method or operation is not implemented.');
}

// ---------------------------------------------------------------- Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/add-new-referral" -> Add_New_Referral/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/add-new-referral'], adminAuth, asyncHandler(async (req, res) => {
  return view(res, '~/Views/AdminPanel/Add_New_Referral/Index.cshtml');
}));

// ---------------------------------------------------------------- JsonResult AddNewMember(string SponsorIDs, string PlacementIDs, string Side, string Title, string UserName, string FirstName, string LastName, string PhoneNo, string EmailIdLoginId, string Password, string Desigantion, string ImageName, string R1, string R2, int Country, int State, string Cityname, string CountryName)
// auth (legacy had no session check; admin-panel member creation => adminAuth)
router.all(`/admin/${C}/AddNewMember{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const P = (k) => nstr(req.p[k]);
  const Country = reqInt(req.p.Country, 'Country');
  const State = reqInt(req.p.State, 'State');
  const ip_address = await GetIP.GetLocalIP(req);
  const validate_Var = validate(P('EmailIdLoginId'), P('UserName'), P('Password'));
  if (validate_Var !== 'ok') return res.json(validate_Var);
  const IntOutPutResult = await AddNewCommunity('', P('EmailIdLoginId'), P('Password'), 'Rs', P('CountryName'), P('UserName'), ip_address, P('PhoneNo'),
    P('SponsorIDs'), P('PlacementIDs'), P('Side'), P('Title'), P('FirstName'), P('LastName'), P('Desigantion'), '', Country, State, P('Cityname'));
  if (IntOutPutResult === 1) return res.json('success');
  if (IntOutPutResult === 2) return res.json('Email Id Already Exist.');
  if (IntOutPutResult === 5) return res.json('Username Already Exist.');
  if (IntOutPutResult === 6) return res.json('Mobile Already Exist.');
  return res.json('Failed');
}));

// ---------------------------------------------------------------- JsonResult getallepin()
// auth (admin panel)
router.all(`/admin/${C}/getallepin{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  // ((Member_Master_Custom)Session["Member_Master"]).regNo - never set in the admin app => NullReferenceException (see SESSION.md)
  const mm = sessionStore.get(req, 'Member_Master');
  if (!mm) throw nre();
  const Regno = mm.regNo;
  // PORT-NOTE: Usp_GetallFreeEPinList is not in the Db_Affiliate schema dump.
  const AllFreeEpinList = mapRows(await db.proc(DB, 'Usp_GetallFreeEPinList', { RegNo: Regno }), MYUNUSEDEPIN_PROPS);
  return res.json(AllFreeEpinList);
}));

// exported for reuse/tests (not routes)
router.helpers = { ValidateCaptcha, AddNewCommunity, SendMail, SendMailAndMsg, EncryptFunction, ThumbnailCallback, validate };

module.exports = router;
