/** Exports (static class SendRegisrtaionConfirmationMail, all async, errors swallowed like the C# unless noted):
 *   SendRegConfirmMail(double Pltid, string email, string username, string password) : void   (merchant activation mail via UtilityClass.CallBackAddress + TrackRegistrationEmail)
 *   SendEnquiryMail(string email, string username, string Text) : void
 *   EncryptFunction(string number) : string
 *   AddNewListingMail(string ToEmailId = "", string UserName = "") : void
 *   UpdateListingMail(string ToEmailId = "", string UserName = "") : void
 *   TestSendMail() : void   (UtilityClass.TrackError on failure)
 *  Merchant differences vs Franchise: mail goes through UtilityClass.CallBackAddress (no direct SMTP in SendRegConfirmMail), new methods SendEnquiryMail/TestSendMail,
 *  SMTP = CompanySettings.CompanyMailServer:587 authenticated as CompanySupportEmailId; From = CompanySendMailEmailId (CompanyInfoEmailId for SendRegConfirmMail).
 */
'use strict';
const CompanySettings = require('./CompanySettings');
const CustomEncriptionAndDecription = require('./CustomEncriptionAndDecription');
const { mailAddress, smtpSend } = require('../franchise/_mailhelpers');

const TPL_CONFIRM = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>\n  <div style='background: #fff; margin:0 auto; color: #333; padding:15px 25px;'>\n<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\n    <table cellpadding='0' cellspacing='0' style='width: 100%'>\n      <tbody>\n        <tr>\n          <td><table style='width:100%;'>\n              <tbody>\n                <tr>\n                  <td colspan='2' align='center' style='background:#f9b217 '><img src='$$CompanyURL$$/images/logo2.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:10px;'></td>\n                </tr>\n              </tbody>\n            </table></td>\n        </tr>\n        <tr>\n          <td><div>\n              <div class='clear'></div>\n              <table style='padding-bottom: 10px;width: 100%;'>\n                <tbody>\n                  <tr>\n                    <td align='center'><h1 style='font-size: 18px; font-weight: normal; margin: 15px 0px 15px; color: #000'></h1>\n                      <strong style='font-size: 20px; font-weight: normal; margin:0; color: #000; padding-top:'>Hello Merchant </strong>\n                       <br><p>Greeting for the day!</p>\n                      <p style='font-size: 14px; font-weight: normal; margin:20px 0px 20px 0px; color: #000;text-align: justify'>Thank you for Registering  with $$CompanyName$$. Kindly click on the activation link shown below to to activate the account.</p>\n                      <table border='0' width='100%' height='36px' style='background: #00a0a8; margin: 30px 0 20px; font-weight:bold;'>\n                        <tbody>\n                          <tr>\n                            <td align='center' style='padding: 2px 2px'><a href='$$CompanyMerchantURL$$/Regisrtration-Confirmation?emailid=$$lblemailid$$&vmid=$$lblvmid$$' style=' text-align:center; width:100%; font-size: 14px; text-decoration: none; color: #fff' target='K-P_EYTewa3lJ5WgwetbbkY'>Verify email</a></td>\n                          </tr>\n                        </tbody>\n                      </table>\n\n                      <div style='clear: both'></div>\n\n                                           </td>\n\n                                       </tr>\n\n                                       <tr>\n\n                                         <td>\n\n                                         <table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>\n\n                                      <tbody>\n\n                                        <tr>\n\n                                        <td>\n\n                                            <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Best Regards </p>\n\n                                               <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5>\n\n                                              </td>\n\n                                                <td>\n\n                                                <div style = 'margin-right: 7px; text-align:right'>\n\n                                                </div></td>\n\n                                                </tr>\n\n                                                </tbody>\n                                               </table>\n\n                                                                                                          </td>\n\n                                                                                                      </tr>\n\n                                                                                                    </tbody>\n\n                                                                                                  </table>\n\n                                                                                                  <div class='clear'></div>\n            </div></td>\n        </tr>\n      </tbody>\n    </table>\n  </div>\n  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'> All Rights Reserved | $$CompanyDomain$$ </p>\n</div>";
const TPL_ENQUIRY = "<div>\n\n<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>\n<tbody><tr><td>\n<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>\n<img src='$$CompanyDomainLogo$$' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>\n<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'>$$datetime$$</td>\n</tr></tbody></table></td>\n</tr><tr><td>\n<div>\n<div class='clear'></div>\n\n<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>\n<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px15px; color: #000'>\nDear $$lblname$$,</h1>\n<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>\nThanks for choosing $$CompanyName$$! </strong>\n<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>\n<table cellpadding='0' cellspacing='0' width='98%' style='font-size:14px;  font-family:Arial; color:#454545;  border:1px solid #eaeaea; background:#f0ffff;  '>\n    <tr>\n        <td colspan='3' style='height:10px; line-height:10px;'></td>\n    </tr>\n    <tr>\n    <td colspan='3' style='height:10px; line-height:30px;'>$$lblmessage$$</td>\n    </tr>\n\n    <tr>\n        <td colspan='3' style='height:15px; line-height:15px;'></td>\n    </tr>\n\n</table>\n</p>\n<div style='clear: both'></div>\n<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>\n\n</p>\n<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>\nIf you have any issues regarding this mail, you can write us on <a style='color:#00008B'>$$CompanySupportEmailId$$</a></p>\n<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'></strong>\n<div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px'>\n<center>\n</center>\n</div>\n\n<div style='clear: both'></div>\n\n<div style='clear: both'></div>\n</td>\n</tr><tr><td>\n<table width='554'><tbody><tr><td>\n<p style='font-size: 16px; line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>\nThank & Regards,\n<br>\n$$CompanySupportEmailId$$  Team\n</p>\n</td>\n<td style='width: 240px; text-align: right'>\n<span>Follow us on</span>\n<br>\n<div style = 'margin-right: 7px; text-align:right'>\n<a href = '$$FacebookShare$$' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = '$$CompanyDomain$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n\n<a href = '$$TwitterShare$$' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = '$$CompanyDomain$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n\n<a href = '$$GoogleplusShare$$' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = '$$CompanyDomain$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n\n<a href = '$$LinkedinShare$$' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = '$$CompanyDomain$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n\n<a href = '$$PinterestShare$$' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = '$$CompanyDomain$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>\n</div>\n</td>\n</tr></tbody></table></td>\n</tr></tbody></table><div class='clear'></div>\n</div>\n</td>\n</tr></tbody></table>\n    </div>";
const TPL_NEWLISTING = "<div>\n               <table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>\n<tbody><tr><td>\n<table width='585'><tbody><tr><td style='width: 350px; background:#f9b217'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>\n<img src='http://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>\n<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'></td>\n</tr></tbody></table></td>\n</tr><tr><td>\n<div>\n<div class='clear'></div>\n\n<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>\n<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px\n\n15px; color: #000'>Hello $$user$$,</h1>\n<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>Thanks for updating your profile on $$CompanyURL$$.\n</strong>\n<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>\nWe have successfully changed the information as per your action. You can access your $$CompanyName$$ account in order see the changes.\n</p>\n<div style='clear: both'></div>\n<div style='clear: both'></div>\n<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>\nIf you have any issues, we will be happy to help you.\n</p>\n<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>You can contact  us on $$SupportEmailId$$</strong>\n<div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px'>\n<center>\n<img src='http://webmail.$$CompanyURL$$/imp/themes/default/graphics/spacer_red.png' htmlimgblocked='https://$$CompanyURL$$/images/divider.png'></center>\n</div>\n\n<div style='clear: both'></div>\n\n<div style='clear: both'></div>\n</td>\n</tr><tr><td>\n<table width='554'><tbody><tr><td>\n\n<p style='font-size: 16px; line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>\nSincerely,\n<br>\n$$CompanyName$$ Team\n</p>\n</td>\n<td style='width: 265px; text-align: right'>\n\n</td>\n</tr></tbody></table></td>\n</tr></tbody></table><div class='clear'></div>\n</div>\n</td>\n</tr></tbody></table>\n    </div>";
const TPL_UPDATELISTING = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>\n\n    <table cellpadding='0' cellspacing='0' style='margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>\n        <tbody>\n\n      <tr>\n        <td>\n        <table style='width:100%;'>\n            <tbody>\n              <tr>\n                <td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\n              </tr>\n            </tbody>\n          </table></td>\n      </tr>\n        <tr>\n\n        <td>\n\n      <div>\n        <div class='clear'></div>\n        <table style='padding-bottom: 10px; width: 100%;'>\n          <tbody>\n            <tr>\n              <td>\n            <tr>\n              <td align='center'><strong style='font-size: 20px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Your Profile Updated Successfully\n                </p>\n                </strong>\n                <div style='text-align:left;'>\n                  <h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Hello $$user$$, </h1>\n                  <p style='font-size: 14px; font-weight: normal; margin: 10px 0px 0px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; text-align:left; color: #000'>Thanks for updating your profile on $$CompanyURL$$. We have successfully changed the information as per your action.</p>\n                  <p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 10px; font-family: Arial, Helvetica, sans-serif; text-align:left; color: #000'>You can access your $$CompanyName$$ account in order see the changes.</p>\n                </div>\n                <div style='clear: both'></div>\n\n                <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\n                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>\n                          <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> If you have any issues,\n            we will be happy to help you. You can contact us on <a href = 'mailto:$$SupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$SupportEmailId$$ </a></p>\n\n                                     </div>\n                                     </td>\n                                 </tr>\n                               <div style = 'clear: both'></div>\n\n                                <div style = 'clear: both'></div>\n                                   </td>\n                                   </tr>\n                                 <tr>\n\n                                   <td><table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'><tbody><tr><td>\n                          <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>\n                          <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5></td><td>\n\n                                 <div style = 'margin-right: 7px; text-align:right'><a href = 'javascript:void(0)' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n                                 <a href = 'javascript:void(0)' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n                                 <a href = 'javascript:void(0)' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n                                 <a href = 'javascript:void(0)' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n                                 <a href = 'javascript:void(0)' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a></div></td></tr></tbody></table></td></tr></tbody></table>\n                                 <div class='clear'></div></div></td></tr></tbody></table></div>\n  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>";

const rep = (s, k, v) => s.split(k).join(v === null || v === undefined ? '' : String(v));
const pad = (n) => String(n).padStart(2, '0');
const curDate = () => { const d = new Date(); return pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear(); }; // DateTime.Now.ToString("dd-MM-yyyy")

// SmtpClient(CompanyMailServer, 587) with CompanySupportEmailId/CompanyMailPassword credentials; ms.Send(mm) throws on failure
async function _send587(message) {
  const r = await smtpSend({ host: CompanySettings.CompanyMailServer, port: 587, user: CompanySettings.CompanySupportEmailId, pass: CompanySettings.CompanyMailPassword, message });
  if (r !== 's') throw new Error(r);
}

async function SendRegConfirmMail(Pltid, email, username, password) {
  const UtilityClass = require('./UtilityClass');
  try {
    const curdate = curDate();
    const mm = { from: mailAddress('' + CompanySettings.CompanyInfoEmailId + ''), to: mailAddress(email) };
    let MyString = TPL_CONFIRM;
    MyString = rep(MyString, '$$date$$', curdate);
    MyString = rep(MyString, '$$name$$', username);
    MyString = rep(MyString, '$$lblPassword$$', password);
    MyString = rep(MyString, '$$lblloginid$$', email);
    MyString = rep(MyString, '$$lblemailid$$', email);
    MyString = rep(MyString, '$$CompanyName$$', CompanySettings.CompanyName);
    MyString = rep(MyString, '$$CompanyURL$$', CompanySettings.CompanyURL);
    MyString = rep(MyString, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    MyString = rep(MyString, '$$CompanyInfoEmailId$$', CompanySettings.CompanyInfoEmailId);
    MyString = rep(MyString, '$$SupportEmailId$$', CompanySettings.CompanySupportEmailId);
    MyString = rep(MyString, '$$CompanyMerchantURL$$', CompanySettings.CompanyMerchantURL);
    const encryt = EncryptFunction(String(Pltid));
    MyString = rep(MyString, '$$lblvmid$$', encryt);
    mm.subject = 'Activate your ' + CompanySettings.CompanyName + ' merchant account';
    await UtilityClass.CallBackAddress(email, mm.subject, MyString);
    await UtilityClass.TrackRegistrationEmail(email, MyString, 'REGISTRATION');
  } catch (ex) {
    try { await UtilityClass.TrackError(String(ex && ex.message)); } catch (e) { /* TrackError swallows its own errors */ }
  }
}

async function SendEnquiryMail(email, username, Text) {
  const UtilityClass = require('./UtilityClass');
  try {
    const curdate = curDate();
    const process = 'Merchant Enquiry';
    const mm = { from: mailAddress(CompanySettings.CompanySendMailEmailId), to: mailAddress(email) };
    let mailtxt = TPL_ENQUIRY;
    mailtxt = rep(mailtxt, '$$lblname$$', username);
    mailtxt = rep(mailtxt, '$$datetime$$', curdate);
    mailtxt = rep(mailtxt, '$$lblmessage$$', Text);
    mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
    mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
    mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    mailtxt = rep(mailtxt, '$$CompanyDomainLogo$$', CompanySettings.CompanyDomainLogo);
    mailtxt = rep(mailtxt, '$$CompanySupportEmailId$$', CompanySettings.CompanySupportEmailId);
    mailtxt = rep(mailtxt, '$$FacebookShare$$', CompanySettings.FacebookShare);
    mailtxt = rep(mailtxt, '$$TwitterShare$$', CompanySettings.TwitterShare);
    mailtxt = rep(mailtxt, '$$GoogleplusShare$$', CompanySettings.GoogleplusShare);
    mailtxt = rep(mailtxt, '$$LinkedinShare$$', CompanySettings.LinkedinShare);
    mailtxt = rep(mailtxt, '$$PinterestShare$$', CompanySettings.PinterestShare);
    mm.subject = 'Enquiry Mail';
    mm.html = mailtxt;
    await UtilityClass.TrackMerchantsEmails(email, mailtxt, process);
    await _send587(mm);
  } catch (e) {
    // swallowed (legacy empty catch)
  }
}

function EncryptFunction(number) {
  const p = new CustomEncriptionAndDecription();
  return p.encryption(number);
}

async function AddNewListingMail(ToEmailId = '', UserName = '') {
  try {
    const mm = { from: mailAddress(CompanySettings.CompanySendMailEmailId), to: mailAddress(ToEmailId) };
    let myString = TPL_NEWLISTING;
    myString = rep(myString, '$$user$$', UserName);
    myString = rep(myString, '$$CompanyName$$', CompanySettings.CompanyName);
    myString = rep(myString, '$$CompanyURL$$', CompanySettings.CompanyURL);
    myString = rep(myString, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    myString = rep(myString, '$$CompanyInfoEmailId$$', CompanySettings.CompanyInfoEmailId);
    myString = rep(myString, '$$SupportEmailId$$', CompanySettings.CompanySupportEmailId);
    mm.subject = 'New Business Listing';
    mm.html = myString;
    await _send587(mm);
  } catch (e) {
    // swallowed (legacy empty catch)
  }
}

async function UpdateListingMail(ToEmailId = '', UserName = '') {
  try {
    const mm = { from: mailAddress(CompanySettings.CompanySendMailEmailId), to: mailAddress(ToEmailId) };
    let myString = TPL_UPDATELISTING;
    myString = rep(myString, '$$user$$', UserName);
    myString = rep(myString, '$$CompanyName$$', CompanySettings.CompanyName);
    myString = rep(myString, '$$CompanyURL$$', CompanySettings.CompanyURL);
    myString = rep(myString, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    myString = rep(myString, '$$SupportEmailId$$', CompanySettings.CompanySupportEmailId);
    mm.subject = 'Update Business Listing';
    mm.html = myString;
    await _send587(mm);
  } catch (e) {
    // swallowed (legacy empty catch)
  }
}

async function TestSendMail() {
  const UtilityClass = require('./UtilityClass');
  try {
    const mm = { from: mailAddress(CompanySettings.CompanySendMailEmailId), to: mailAddress(CompanySettings.CompanySendMailEmailId) };
    mm.html = 'Test Mail';
    mm.subject = 'Activate your\u3010 ' + CompanySettings.CompanyName + ' \u3011merchant account';
    await _send587(mm);
  } catch (ex) {
    try { await UtilityClass.TrackError(String(ex && ex.message)); } catch (e) { /* swallowed */ }
  }
}

module.exports = { SendRegConfirmMail, SendEnquiryMail, EncryptFunction, AddNewListingMail, UpdateListingMail, TestSendMail };
