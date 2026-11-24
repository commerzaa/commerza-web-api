/** Exports (static class SendRegisrtaionConfirmationMail, all async):
 *   SendRegConfirmMail(double Pltid, string email, string username, string password) : void   (errors swallowed like the C#)
 *   EncryptFunction(string number) : string
 *   AddNewListingMail(string ToEmailId = "", string UserName = "") : void
 *   UpdateListingMail(string ToEmailId = "", string UserName = "") : void
 *  Config keys (config.app, add to config/.env if missing): SMPT_HOST, SMPT_PORT, SMPT_Username, SMPT_Password, SMTP_EnableSSL
 */
'use strict';
const config = require('../../config');
const CompanySettings = require('./CompanySettings');
const CustomEncriptionAndDecription = require('./CustomEncriptionAndDecription');
const { mailAddress, smtpSend } = require('./_mailhelpers');

const TPL_CONFIRM = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; padding:15px 25px;'>\n    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\n    <table cellpadding='0' cellspacing='0' style='width: 100%'>\n      <tbody>\n        <tr>\n          <td><table style='width:100%;'>\n              <tbody>\n                <tr>\n                  <td colspan='2' align='center' style='background:#2d2a24 '><img src='https://franchise.clusteroffer.com/images/dealsinvicta-8.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:10px;'></td>\n                </tr>\n              </tbody>\n            </table></td>\n        </tr>\n        <tr>\n          <td><div>\n              <div class='clear'></div>\n              <table style='padding-bottom: 10px;   width: 100%; '>\n                <tbody>\n                  <tr>\n                    <td align='center'><h1 style='font-size: 18px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px\n\n15px; color: #000'></h1>\n                      <strong style='font-size: 20px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000; padding-top:'>Verify your email address</strong>\n                      <p style='font-size: 14px; font-weight: normal; margin:20px 0px 20px 0px; color: #000;text-align: justify'> Thanks for signing up in $$CompanyName$$. As per your valuable details you need to verify your email address by using link below. This is an one time verification, Follow the link below to confirm your account.</p>\n                      <table border='0' width='100%' height='36px' style='background: #00a0a8; margin: 30px 0 20px; font-weight:bold;'>\n                        <tbody>\n                          <tr>\n                            <td align='center' style='padding: 2px 2px'><a href='$$CompanyResellerURL$$/Regisrtration-Confirmation?emailid=$$lblemailid$$&vmid=$$lblvmid$$' style=' text-align:center; width:100%; font-size: 14px; text-decoration: none; font-family: 'Exo', sans-serif, Helvetica, sans-serif; color: #fff' target='K-P_EYTewa3lJ5WgwetbbkY'>Verify my email</a></td>\n                          </tr>\n                        </tbody>\n                      </table>\n\n                      <div style='clear: both'></div>\n                      <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\n                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>\n                          <p style = 'text-align: justify;font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: 'Exo', sans-serif, Helvetica, sans-serif;  color: #000'> If you have any issues,\n            we will be happy to help you. You can contact us on <a style = 'color:#00a0a8;'> $$CompanySupportEmailId$$</a></p>\n                                     </div>\n\n                                           </td>\n\n                                       </tr>\n\n                                       <tr>\n\n                                         <td>\n\n                                         <table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>\n\n                                      <tbody>\n\n                                        <tr>\n\n                                        <td>\n\n                                            <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>\n\n                                               <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5>\n\n                                              </td>\n\n                                                <td>\n\n                                                <div style = 'margin-right: 7px; text-align:right'>\n\n                                                                                                         </div></td>\n\n                                                                                                      </tr>\n\n                                                                                                    </tbody>\n\n                                                                                                  </table>\n\n                                                                                                          </td>\n\n                                                                                                      </tr>\n\n                                                                                                    </tbody>\n\n                                                                                                  </table>\n\n                                                                                                  <div class='clear'></div>\n            </div></td>\n        </tr>\n      </tbody>\n    </table>\n  </div>\n  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2022 All Rights Reserved | $$CompanyURL$$</p>\n</div>";
const TPL_NEWLISTING = "<div>\n               <table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif;width: 585px'>\n<tbody><tr><td>\n<table width='585'><tbody><tr><td style='width: 350px; background:#f9b217'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>\n<img src='http://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>\n<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: 'Exo', sans-serif, Helvetica, sans-serif; width: 250px'></td>\n</tr></tbody></table></td>\n</tr><tr><td>\n<div>\n<div class='clear'></div>\n\n<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>\n<h1 style='font-size: 18px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px\n\n15px; color: #000'>Hello $$user$$,</h1>\n<strong style='font-size: 16px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>Thanks for updating your profile on $$CompanyURL$$.\n</strong>\n<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>\nWe have successfully changed the information as per your action. You can access your $$CompanyName$$ account in order see the changes.\n</p>\n<div style='clear: both'></div>\n<div style='clear: both'></div>\n<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; color: #000'>\nIf you have any issues, we will be happy to help you.\n</p>\n<strong style='font-size: 16px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>You can contact  us on $$CompanySupportEmailID$$</strong>\n<div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px'>\n<center>\n<img src='http://webwebmail.mlmkabila.com/imp/themes/default/graphics/spacer_red.png' htmlimgblocked='https://$$CompanyURL$$/images/divider.png'></center>\n</div>\n\n<div style='clear: both'></div>\n\n<div style='clear: both'></div>\n</td>\n</tr><tr><td>\n<table width='554'><tbody><tr><td>\n\n<p style='font-size: 16px; line-height:1.6; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>\nSincerely,\n<br>\n$$CompanyName$$ Team\n</p>\n</td>\n<td style='width: 265px; text-align: right'>\n\n\n</td>\n</tr></tbody></table></td>\n</tr></tbody></table><div class='clear'></div>\n</div>\n</td>\n</tr></tbody></table>\n    </div>";
const TPL_UPDATELISTING = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; padding:15px 25px;'>\n    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\n    <table cellpadding='0' cellspacing='0' style='margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; width: 100%'>\n        <tbody>\n\n      <tr>\n        <td>\n        <table style='width:100%;'>\n            <tbody>\n              <tr>\n                <td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\n              </tr>\n            </tbody>\n          </table></td>\n      </tr>\n        <tr>\n\n        <td>\n\n      <div>\n        <div class='clear'></div>\n        <table style='padding-bottom: 10px; width: 100%;'>\n          <tbody>\n            <tr>\n              <td>\n            <tr>\n              <td align='center'><strong style='font-size: 20px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Your Profile Updated Successfully\n                </p>\n                </strong>\n                <div style='text-align:left;'>\n                  <h1 style='font-size: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Hello $$user$$, </h1>\n                  <p style='font-size: 14px; font-weight: normal; margin: 10px 0px 0px 0px; padding-top: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; text-align:left; color: #000'>Thanks for updating your profile on $$CompanyURL$$. We have successfully changed the information as per your action.</p>\n                  <p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 10px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; text-align:left; color: #000'>You can access your $$CompanyName$$ account in order see the changes.</p>\n                </div>\n                <div style='clear: both'></div>\n\n                <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\n                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>\n                          <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: 'Exo', sans-serif, Helvetica, sans-serif;  color: #000'> If you have any issues,\n            we will be happy to help you. You can contact us on <a href = 'mailto:$$CompanySupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$CompanySupportEmailId$$ </a></p>\n\n                                     </div>\n                                     </td>\n                                 </tr>\n                               <div style = 'clear: both'></div>\n\n                                <div style = 'clear: both'></div>\n                                   </td>\n                                   </tr>\n                                 <tr>\n\n                                   <td><table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'><tbody><tr><td>\n                          <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>\n                          <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5></td><td>\n\n                                 <div style = 'margin-right: 7px; text-align:right'><a href = 'javascript:void(0)' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n                                 <a href = 'javascript:void(0)' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n                                 <a href = 'javascript:void(0)' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n                                 <a href = 'javascript:void(0)' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n                                 <a href = 'javascript:void(0)' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a></div></td></tr></tbody></table></td></tr></tbody></table>\n                                 <div class='clear'></div></div></td></tr></tbody></table></div>\n  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>";

const rep = (s, k, v) => s.split(k).join(v === null || v === undefined ? '' : String(v));
const pad = (n) => String(n).padStart(2, '0');

async function SendRegConfirmMail(Pltid, email, username, password) {
  try {
    const d = new Date();
    const curdate = pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear(); // DateTime.Now.ToString("dd-MM-yyyy")
    let MyString = TPL_CONFIRM;
    MyString = rep(MyString, '$$date$$', curdate);
    MyString = rep(MyString, '$$name$$', username);
    MyString = rep(MyString, '$$lblPassword$$', password);
    MyString = rep(MyString, '$$lblloginid$$', email);
    MyString = rep(MyString, '$$lblemailid$$', email);
    MyString = rep(MyString, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    MyString = rep(MyString, '$$CompanyURL$$', CompanySettings.CompanyURL);
    MyString = rep(MyString, '$$CompanyName$$', CompanySettings.CompanyName);
    MyString = rep(MyString, '$$CompanyResellerURL$$', CompanySettings.CompanyResellerURL);
    MyString = rep(MyString, '$$CompanySupportEmailId$$', CompanySettings.CompanySupportEmailId);
    MyString = rep(MyString, '$$Logo$$', '');
    const encryt = EncryptFunction(String(Pltid));
    MyString = rep(MyString, '$$lblvmid$$', encryt);

    const message = {
      from: mailAddress(config.app.SMPT_Username),
      to: mailAddress(email),
      subject: '' + CompanySettings.CompanyName + ' Franchisee Account Verification.',
      html: MyString,
    };
    const port = parseInt(config.app.SMPT_PORT, 10);
    if (Number.isNaN(port)) throw new Error('Input string was not in a correct format.');
    const enableSsl = String(config.app.SMTP_EnableSSL).toLowerCase() === 'true';
    await smtpSend({ host: config.app.SMPT_HOST, port, user: config.app.SMPT_Username, pass: config.app.SMPT_Password, enableSsl, message }); // result string unused in the C#

    const UtilityClass = require('./UtilityClass');
    await UtilityClass.TrackRegistrationEmail(email, MyString, 'REGISTRATION');
  } catch (ex) {
    // swallowed
  }
}

function EncryptFunction(number) {
  const p = new CustomEncriptionAndDecription();
  return p.encryption(number);
}

async function AddNewListingMail(ToEmailId = '', UserName = '') {
  try {
    const from = '' + CompanySettings.CompanyInfoEmailId + '';
    const mm = { from: mailAddress(from), to: mailAddress(ToEmailId) };
    let myString = TPL_NEWLISTING;
    myString = rep(myString, '$$user$$', UserName);
    myString = rep(myString, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    myString = rep(myString, '$$CompanyURL$$', CompanySettings.CompanyURL);
    myString = rep(myString, '$$CompanyName$$', CompanySettings.CompanyName);
    myString = rep(myString, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
    mm.subject = 'New Business Listing';
    mm.html = myString;
    // ms.Send(mm): exceptions are swallowed by the surrounding catch; SmtpClient(host) => port 25
    const r = await smtpSend({ host: CompanySettings.CompanyMailServer, port: 25, user: CompanySettings.CompanyInfoEmailId, pass: CompanySettings.CompanyMailPassword, message: mm });
    if (r !== 's') throw new Error(r);
  } catch (e) {
    // swallowed
  }
}

async function UpdateListingMail(ToEmailId = '', UserName = '') {
  try {
    const from = '' + CompanySettings.CompanyInfoEmailId + '';
    const mm = { from: mailAddress(from), to: mailAddress(ToEmailId) };
    let myString = TPL_UPDATELISTING;
    myString = rep(myString, '$$user$$', UserName);
    myString = rep(myString, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    myString = rep(myString, '$$CompanyURL$$', CompanySettings.CompanyURL);
    myString = rep(myString, '$$CompanyName$$', CompanySettings.CompanyName);
    myString = rep(myString, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
    mm.subject = 'Update Business Listing';
    mm.html = myString;
    const r = await smtpSend({ host: CompanySettings.CompanyMailServer, port: 25, user: CompanySettings.CompanyInfoEmailId, pass: CompanySettings.CompanyMailPassword, message: mm });
    if (r !== 's') throw new Error(r);
  } catch (e) {
    // swallowed
  }
}

module.exports = { SendRegConfirmMail, EncryptFunction, AddNewListingMail, UpdateListingMail };
