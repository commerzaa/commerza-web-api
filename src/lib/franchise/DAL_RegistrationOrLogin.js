/** Exports (static class DAL_RegistrationOrLogin, all async; Db_Shopping):
 *   Login_Check(string LoginID, string Password, string ip) : Login{DID,Pmid,Smdid,LoginID,UserName,Name,EmailId,Cid,SecretCode}|null   (USP_PORTALLOGIN_M_RESELLER)
 *   validate(string email, string username, string password) : string
 *   checkedDOC_Status(string email, string username) : string   (USP_CHECKING_VISITORREQUEST_STATUS)
 *   Registration(string Referrelcode, string Email, string password, string currency, string country, string username, string ip_address, string MobileNo, string Source, req?) : string  (USP_VISITOR_SIGNUP_TEMP_RESELLER)
 *   AddNewCommunity(string Referrelcode, string email, string password, string currency, string country, string username, string ip_address, string MobileNo, string SponsorIDs, string PlacementIDs, string Side, string Title, string FirstName, string LastName, string Desigantion, string ImageName) : int  (USP_VISITOR_SIGNUP_TEMP)
 *   SendMail(int matplid, string emailid, string HtmlMailPath, string password, string username, string MobileNo, string Name) : void
 *   EncryptFunction(string number) : string ; VerifyDuplicateUser(string email, string username, string MobileNo) : int (USP_ValidateUser)
 *   GET_FAQCATEGORY() : FAQCategory[]{FRCID,CATEGORYNAME} ; FAQDetails(Int64 ID) : FAQAnswer[]{FRCID,FAQQUE,FAQANS}
 *  PORT-NOTE: Registration stored Session["TempPLID"]; here it is written with utils/sessionStore.set(req,'TempPLID',value) when the caller passes the express `req` as the last argument.
 *  PORT-NOTE: legacy Threads (mail / SMS) are background promises; errors are only logged.
 */
'use strict';
const { proc, procOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const { outValue } = require('../_http');
const { fire } = require('../_libhelpers');
const CompanySettings = require('./CompanySettings');
const CustomEncriptionAndDecription = require('./CustomEncriptionAndDecription');
const SendRegisrtaionConfirmationMail = require('./SendRegisrtaionConfirmationMail');
const UtilityClass = require('./UtilityClass');
const { mailAddress, smtpSend } = require('./_mailhelpers');

const TPL_WELCOME = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; padding:15px 25px;'>\n    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\n    <table cellpadding='0' cellspacing='0' style='margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; width: 100%'>\n        <tbody>\n\n      <tr>\n        <td><table style='width:100%;'>\n            <tbody>\n              <tr>\n                <td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='http://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\n              </tr>\n            </tbody>\n          </table></td>\n      </tr>\n        <tr>\n        <td>\n      <div>\n        <div class='clear'></div>\n        <table style='padding-bottom: 10px; width: 100%; '>\n          <tbody>\n            <tr>\n              <td>\n            <tr>\n              <td align='center'><strong style='font-size: 20px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> REFERRAL PROGRAM\n                </p>\n                </strong>\n                <div style='text-align:left;'>\n                  <h1 style='font-size: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42; text-align:center'>Welcome </h1>\n                  <h1 style='font-size: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px\n\n15px; color: #3f3f42;'>Dear $$lblName$$, </h1>\n                  <strong style='font-size: 14px;font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #3f3f42;'>We welcome you to our Referral Program. <br/> <br/>\n\n     Please note, <u>submission</u> of your KYC documents is must to run this program (check my profile on your panel). We request you to submit your KYC documents as soon as possible or <a href='$$CompanyResellerURL$$/reseller-login' target='_blank' style='color:#00a0a8;'>$$CompanyDomain$$/reseller-login  </a> to submit now.\n                  </strong>\n                  <div style='font-size: 15px; color: #333;'>\n                    <p style='font-size:14px; font-weight:bold;  margin-top:20px; margin-bottom:0;'>Your account information: </p>\n                    <p style='font-size:14px; font-weight:bold; margin:5px; margin-left:0; '> User Name: $$lblName$$ </p>\n                <p style='font-size:14px; font-weight:bold; margin:5px; margin-left:0;'> Reseller Id: $$lblresellerid$$ </p>                    \n                <p style='font-size:14px; font-weight:bold; margin:5px; margin-left:0;'> Registered Email: $$lblLoginId$$ </p>\n                    <p style='font-size:14px; font-weight:bold;  margin:5px; margin-left:0;'> Your Password: $$lblPassword$$ </p>\n                  </div>\n                </div>\n                <div style='clear: both'></div>\n\n                <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\n                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>\n                          <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: 'Exo', sans-serif, Helvetica, sans-serif;  color: #000'> If you have any issues,\n            we will be happy to help you. You can contact us on <a href = 'mailto:$$CompanySupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$CompanySupportEmailId$$ </a></p>\n\n                                     </div>\n\n                                     </td>\n\n                                 </tr>\n                               <div style = 'clear: both'></div>\n                                <div style = 'clear: both'></div>\n                                   </td>\n                                   </tr>\n                                 <tr>\n\n                                   <td>\n\n                                   <table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>\n\n                                        <tbody>\n                                          <tr>\n                                          <td>\n\n                                              <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>\n\n                                                 <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5>\n\n                                                </td>\n                                                  <td>\n                                                  <div style = 'margin-right: 7px; text-align:right'>\n\n                                                   <a href = '$$CompanyFacebookLink$$' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n\n                                                              <a href = '$$CompanyTwitterLink$$' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n\n                                                                         <a href = '$$CompanyGooglePlusLink$$' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n\n                                                                                    <a href = '$$CompanyLinkedinLink$$' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n\n                                                                                                <a href = '$$CompanyPinterestLink$$' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>\n\n                                                                                                           </div></td>\n\n                                                                                                        </tr>\n\n                                                                                                      </tbody>\n\n                                                                                                    </table></td>\n\n                                                                                                </tr>\n\n                                                                                                  </tbody>\n\n                                                                                              </table>\n\n                                                                                              <div class='clear'></div>\n      </div>\n        </td>\n\n        </tr>\n\n        </tbody>\n\n    </table>\n  </div>\n  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>\n</div>";
const LOGIN = ['DID', 'Pmid', 'Smdid', 'LoginID', 'UserName', 'Name', 'EmailId', 'Cid'];
const rep = (s, k, v) => s.split(k).join(v === null || v === undefined ? '' : String(v));
const toInt32 = (v) => {
  const t = String(v === null || v === undefined ? '' : v).trim();
  if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return parseInt(t, 10);
};
const toDouble = (v) => {
  const n = Number(String(v).trim());
  if (String(v).trim() === '' || Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
};

async function Login_Check(LoginID, Password, ip) {
  const row = await procOne('shopping', 'usp_portallogin_m_reseller', { username: LoginID, password: Password, ipaddress: ip });
  const m = mapRow(row, LOGIN);
  return m ? { ...m, SecretCode: null } : null;
}

async function validate(email, username, password) {
  if (email.trim() === '') {
    // legacy regex is applied to the (empty) trimmed string, so it never matches
    const isEmail = /^(?:[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)$/.test(email.trim());
    if (!isEmail) {
      return 'Email Not Correct Format!';
    }
  }
  return 'ok';
}

async function checkedDOC_Status(email, username) {
  const row = await procOne('shopping', 'usp_checking_visitorrequest_status', { loginid: email.trim(), username: username.trim(), password: '' });
  const ResultStatus = toInt32(outValue(row, 'INTRESULT'));
  if (ResultStatus > 0) {
    if (ResultStatus === 1) {
      return 'registered';
    } else if (ResultStatus === 3) {
      return 'request exist';
    } else if (ResultStatus === 4) {
      return 'user exist';
    }
  }
  return 'ok';
}

async function Registration(Referrelcode, Email, password, currency, country, username, ip_address, MobileNo, Source, req) {
  if (Referrelcode === null || Referrelcode === undefined) Referrelcode = '';
  const row = await procOne('shopping', 'usp_visitor_signup_temp_reseller', {
    loginid: String(Email).trim(), password, username, mode: '0', qpayregno: '0', currencysymbol: currency, country,
    referrelcode: Referrelcode, ipaddress: ip_address, mobileno: MobileNo, source: Source,
  });
  const IntOutPutResult = outValue(row, 'INTRESULT');
  if (IntOutPutResult === '1') {
    const TempPLID = toDouble(outValue(row, 'PLID'));
    if (req) {
      try { require('../../utils/sessionStore').set(req, 'TempPLID', TempPLID); } catch (e) { /* session unavailable */ }
    }
    fire(() => SendRegisrtaionConfirmationMail.SendRegConfirmMail(TempPLID, Email, username, password));
  }
  return IntOutPutResult;
}

async function AddNewCommunity(Referrelcode, email, password, currency, country, username, ip_address, MobileNo, SponsorIDs, PlacementIDs, Side, Title, FirstName, LastName, Desigantion, ImageName) {
  const row = await procOne('shopping', 'usp_visitor_signup_temp', {
    loginid: String(email).trim(), password, username, mode: '0', qpayregno: '0', currencysymbol: currency, country,
    referrelcode: Referrelcode, ipaddress: ip_address, mobileno: MobileNo, sponsorids: SponsorIDs, placementids: PlacementIDs,
    side: Side, title: Title, firstname: FirstName, lastname: LastName, desigantion: Desigantion, imagename: ImageName, modeforjoining: '1',
  });
  const IntOutPutResult = toInt32(outValue(row, 'INTRESULT'));
  if (IntOutPutResult === 1) {
    const TempPLID = toDouble(outValue(row, 'PLID'));
    const plid = Math.trunc(TempPLID);
    const MobileNoNoForSendSms = MobileNo;
    const Message = 'Dear ' + username + ',\r\nyour account has been created successfully! Login Link: ' + CompanySettings.CompanyDomain + '/reseller-login \r\nUsername: ' + username + '\r\n Reg. Email: ' + email + '\r\nPassword: ' + password + ',\r\nThank you.\r\nThe ' + CompanySettings.CompanyName + ' Team';
    fire(async () => {
      await SendMail(plid, email, '', password, username, MobileNo, FirstName);
      await UtilityClass.SendMsgOnMobile(MobileNoNoForSendSms, Message);
    });
  }
  return IntOutPutResult;
}

async function SendMail(matplid, emailid, HtmlMailPath, password, username, MobileNo, Name) {
  const loginid = emailid;
  try {
    const mm = { from: mailAddress('' + CompanySettings.CompanyInfoEmailId + ''), to: mailAddress(emailid) };
    let myString = TPL_WELCOME;
    myString = rep(myString, '$$lblName$$', username);
    myString = rep(myString, '$$lblLoginId$$', loginid);
    myString = rep(myString, '$$lblEmail$$', emailid);
    myString = rep(myString, '$$lblPassword$$', password);
    myString = rep(myString, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    myString = rep(myString, '$$CompanyURL$$', CompanySettings.CompanyURL);
    myString = rep(myString, '$$CompanyName$$', CompanySettings.CompanyName);
    myString = rep(myString, '$$CompanyResellerURL$$', CompanySettings.CompanyResellerURL);
    myString = rep(myString, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
    myString = rep(myString, '$$CompanyFacebookLink$$', CompanySettings.CompanyFacebookLink);
    myString = rep(myString, '$$CompanyLinkedinLink$$', CompanySettings.CompanyLinkedinLink);
    myString = rep(myString, '$$CompanyGooglePlusLink$$', CompanySettings.CompanyGooglePlusLink);
    myString = rep(myString, '$$CompanyTwitterLink$$', CompanySettings.CompanyTwitterLink);
    myString = rep(myString, '$$CompanyPinterestLink$$', CompanySettings.CompanyPinterestLink);
    mm.subject = 'Welcome To ' + CompanySettings.CompanyName + '';
    mm.html = myString;
    // SmtpClient(host): default port 25; exceptions swallowed by the legacy catch
    const r = await smtpSend({ host: CompanySettings.CompanyMailServer, port: 25, user: CompanySettings.CompanyInfoEmailId, pass: CompanySettings.CompanyMailPassword, message: mm });
    if (r !== 's') throw new Error(r);
  } catch (e) {
    // swallowed
  }
}

function EncryptFunction(number) {
  const p = new CustomEncriptionAndDecription();
  return p.encryption(number);
}

async function VerifyDuplicateUser(email, username, MobileNo) {
  const row = await procOne('shopping', 'usp_validateuser', { loginid: String(email).trim(), username, mobileno: MobileNo });
  return toInt32(outValue(row, 'INTRESULT'));
}

async function GET_FAQCATEGORY() {
  return mapRows(await proc('shopping', 'usp_faq_reseller_category', { mode: 1 }), ['FRCID', 'CATEGORYNAME']);
}

async function FAQDetails(ID) {
  return mapRows(await proc('shopping', 'usp_get_faq_reseller', { frqid: ID }), ['FRCID', 'FAQQUE', 'FAQANS']);
}

module.exports = { Login_Check, validate, checkedDOC_Status, Registration, AddNewCommunity, SendMail, EncryptFunction, VerifyDuplicateUser, GET_FAQCATEGORY, FAQDetails };
