'use strict';
/**
 * Shared helpers for portal batch 19 (profile / KYC):
 *   CustomerPanel/My_Profile, CustomerPanel/KYCCheck, CustomerPanel/KYC, CustomerPanel/kyc_mobile, UserPanel/Business_KYC.
 * Not a router (lives in _shared/, not mounted by src/modules/portal.js).
 *
 * Exports: DB, s, nz, NRE, str, outAny, sqlInt, toInt32, requiredInt, mapPath, randomNext, bg, todayDMY, longDate, fillMail,
 *          checkMailAddress, tempDataKeep, appFolder, legacyKycImgName, deleteIfExists, updatemerchantkyc,
 *          T_PROFILE, T_BANK, T_KYCCHECK, T_BUSINESS_KYC,
 *          KycCheckSendConfirmationEmail(ToEmail, Username, Text), BusinessKycSendConfirmationEmail(ToEmail, Username, Text),
 *          InsertKYCViaCs(Typetext, MemberImg, Mode, Id, Get_This, Plid)   (KYCCheckController.InsertKYCViaCs, used by
 *          KYCCheck/InsertKYCViaCs and My_Profile/Insert_BankDetail), memberMasterByPlid, kycCount, portalLoginByPlid,
 *          businessKycViewBagDefaults(ViewBag), customerKycDetailsViewBag(ViewBag, Plid),
 *          customerKycInsertViaJquery(req, res), customerKycSaveBankDetails(req, res)   (KYC + kyc_mobile action bodies)
 *
 * PORT-NOTE (all batch-19 modules): string action parameters keep the posted value ("" stays "", absent => null). The legacy views
 * post empty strings (e.g. R1:"" when requesting an OTP) and the C# compares them with "" - the port follows that contract.
 * PORT-NOTE (all batch-19 modules): ADO.NET did not send SqlParameters whose value is C# null (the EXEC then failed with "expects the
 * parameter ... which was not supplied"); the port passes SQL NULL instead.
 * PORT-NOTE (all batch-19 modules): T-SQL implicitly converted '' / numeric strings passed to INT proc parameters ('' => 0);
 * `sqlInt` reproduces that conversion because PostgreSQL does not.
 */
const fs = require('fs');
const path = require('path');
const db = require('../../../db');
const config = require('../../../config');
const ps = require('./portal-session');
const UtilityClass = require('../../../lib/portal/UtilityClass');
const SendMail = require('../../../lib/portal/SendMail');
const CS = require('../../../lib/portal/CompanySettings');
const b14 = require('./batch-14-common');

const CompanySettings = CS.CompanySettings || CS;
const { DB, s, nz, NRE, toInt32, requiredInt, mapPath, randomNext, bg, todayDMY, checkMailAddress, updatemerchantkyc } = b14;

/** string action parameter: absent => null, otherwise the posted text (see PORT-NOTE above) */
const str = (v) => (v === undefined || v === null ? null : Array.isArray(v) ? v.join(',') : String(v));

/** OUTPUT parameter of a proc (db.proc returns OUT params as columns of the first row): first matching name, DBNull/no row => '' */
function outAny(rowOrRows, ...names) {
  const row = Array.isArray(rowOrRows) ? rowOrRows[0] : rowOrRows;
  if (!row) return '';
  for (const n of names) {
    const k = Object.keys(row).find((x) => x.toLowerCase() === String(n).toLowerCase());
    if (k !== undefined) return s(row[k]);
  }
  return '';
}

/** T-SQL implicit nvarchar -> int conversion of a value passed to an INT proc parameter */
function sqlInt(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return Math.trunc(v);
  const t = String(v).trim();
  if (t === '') return 0;
  if (!/^[+-]?\d+$/.test(t)) throw new Error(`Conversion failed when converting the nvarchar value '${String(v)}' to data type int.`);
  return parseInt(t, 10);
}

/** DateTime.Now.ToString("dddd MMMM dd yyyy hh:mm tt") */
function longDate() {
  const d = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const p = (n) => String(n).padStart(2, '0');
  const h = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${p(d.getDate())} ${d.getFullYear()} ${p(h)}:${p(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** sequential string.Replace(old, new) calls, in the given order (null new value => removed, like C#) */
function fillMail(tpl, pairs) {
  let t = tpl;
  for (const [k, v] of pairs) t = t.split(k).join(v === undefined || v === null ? '' : String(v));
  return t;
}

/** TempData.Keep(): every TempData value read in this request survives to the next request */
function tempDataKeep(req) {
  const read = req.__tempRead || {};
  for (const k of Object.keys(read)) ps.tempDataSet(req, k, read[k]);
}

/** ConfigurationManager.AppSettings[key] for upload folder names (not secrets) */
const appFolder = (key) => (config.app && config.app[key] !== undefined && config.app[key] !== null ? config.app[key] : '');

/** the (unused afterwards) image name the KYC controllers build from their `loginid` field ("" in every controller) */
function legacyKycImgName(loginid, Plid) {
  let ProfileImage = s(loginid);
  ProfileImage = ProfileImage.trim();
  ProfileImage = ProfileImage.split('&amp;').join('And');
  ProfileImage = ProfileImage.split('&').join(' And ');
  ProfileImage = ProfileImage.replace(/[^\w\d]/g, '');
  ProfileImage = ProfileImage.split(' ').join('-');
  const GetRandomNumber = randomNext(1111, 9999);
  return ProfileImage + '-' + Plid + '-' + GetRandomNumber + '.jpg';
}

/** if (File.Exists(p)) File.Delete(p) */
function deleteIfExists(p) {
  try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch (e) { console.error('[portal batch19] delete', e.message); }
}

/** My_Profile.SendConfirmationEmail mail body (verbatim C# string) */
const T_PROFILE = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>\n    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\n    <table cellpadding='0' cellspacing='0' style='margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>\n        <tbody>\n      \n      <tr>\n        <td><table style='width:100%;'>\n            <tbody>\n              <tr>\n                <td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/anav-exchange-logo.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\n              </tr>\n            </tbody>\n          </table></td>\n      </tr>\n        <tr>\n      \n        <td>\n      \n      <div>\n        <div class='clear'></div>\n        <table style='padding-bottom: 10px; width: 100%; '>\n          <tbody>\n            <tr>\n              <td>\n            <tr>\n              <td align='center'><strong style='font-size: 20px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Your Profile Updated Successfully\n                </p>\n                </strong>\n                <div style='text-align:left;'>\n                  <h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Hello $$lblname$$, </h1>\n                  <p style='font-size: 14px; font-weight: normal; margin: 10px 0px 0px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; text-align:left; color: #000'>Thanks for updating your profile on $$CompanyURL$$.</p>\n                  <p style='font-size: 14px; font-weight: normal; margin: 0px 0px 0px 0px; padding-top: 10px; font-family: Arial, Helvetica, sans-serif; text-align:left; color: #000'>\n                  <table cellpadding='0' cellspacing='0' width='98%' style='font-size:12px;  font-family:Arial; color:#454545;   '>\n                    <tr>\n                      <td colspan='3' style='height:10px; line-height:10px;'></td>\n                    </tr>\n                    <tr>\n                      <td  style='text-align:right; width:90px; margin:0px; padding:0px; line-height:25px; height:25px;'><span style='float:right;'>Username </span></td>\n                      <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\n                      <td align='left' style='line-height:25px; height:25px;'><span style='font-weight:bold;'>$$lblupdateusername$$</span></td>\n                    </tr>\n                    <tr>\n                      <td  style='text-align:right; width:90px; margin:0px; padding:0px; line-height:25px; height:25px;'><span style='float:right;'>Title </span></td>\n                      <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\n                      <td align='left' style='line-height:25px; height:25px;'><span style='font-weight:bold;'>$$lblTitle$$</span></td>\n                    </tr>\n                    <tr>\n                      <td  style='text-align:right; width:90px; margin:0px; padding:0px; line-height:25px; height:25px;'><span style='float:right;'>Full Name </span></td>\n                      <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\n                      <td align='left' style='line-height:25px; height:25px;'><span  style='font-weight:bold;'>$$lblFirstName$$</span></td>\n                    </tr>\n                    \n                    <tr>\n                      <td  style='text-align:right; width:90px; margin:0px; padding:0px; line-height:25px; height:25px;'><span style='float:right;'>Contact No. </span></td>\n                      <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\n                      <td align='left' style='line-height:25px; height:25px;'><span  style='font-weight:bold;'>$$lblContact$$</span></td>\n                    </tr>\n                    <tr>\n                      <td  style='text-align:right; width:90px; margin:0px; padding:0px; line-height:25px; height:25px;'><span style='float:right;'>Email Id </span></td>\n                      <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\n                      <td align='left' style='line-height:25px; height:25px;'><span  style='font-weight:bold;'>$$lblemailid$$</span></td>\n                    </tr>\n                    <tr>\n                      <td  style='text-align:right; width:90px; margin:0px; padding:0px; line-height:25px; height:25px;'><span style='float:right;'>Designation </span></td>\n                      <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\n                      <td align='left' style='line-height:25px; height:25px;'><span  style='font-weight:bold;'>$$lbldesignation$$</span></td>\n                    </tr>\n                  </table>\n                  </p>\n                </div>\n                <div style='clear: both'></div>\n                <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\n                  <h5 style='margin:0; font-size:18px; font-weight:normal; padding-bottom:5px;'>Need Support?</h5>\n                  <p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> If you have any issues, \nwe will be happy to help you. You can contact us on <a href='mailto:$$CompanySupportEmailId$$' target='_blank' style='color:#00a0a8;'>$$CompanySupportEmailId$$ </a></p>\n                </div>\n                </td>\n            </tr>\n          <div style='clear: both'></div>\n          <div style='clear: both'></div>\n            </td>\n          \n            </tr>\n          \n          <tr>\n            <td>\n            \n            <table style='width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>\n                <tbody>\n                  <tr>\n                  <td>\n                  \t\n                      <p style='margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'>Sincerely</p>\n                        <h5 style='margin:0; font-size:14px;  padding-bottom:5px;'>The $$CompanyName$$ Team</h5>\n                    \n                  </td>\n                    <td>\n                    <div style='margin-right: 7px; text-align:right'>  \n                    <a href='https://www.facebook.com/ATCShoppingServices/' style='color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target='8SE_b89lng5GVbx5a7NZME9'> <img src='https://$$CompanyURL$$/images/mailer-facebook.png'  style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a> \n                    <a href='https://twitter.com/ATCShoppingServices' style='color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='e3PP7S0O2rDcb5kT5Qxvkl9'> <img src='https://$$CompanyURL$$/images/mailer-twitter.png' style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a> \n                    <a href='https://plus.google.com/+ATCShoppingIn' style='color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='k_lu77WHdSxxe84MTtrgPlD'> <img src='https://$$CompanyURL$$/images/mailer-gplus.png'  style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a> \n                    <a href='https://www.linkedin.com/company/ATCShopping' style='color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='1QtmtsX-zlkY3NH-RX8bXJB'> <img src='https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n                     <a href='https://pinterest.com/ATCShoppingServices/' style='color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='FTivBEnhJ2wIlo_i9yYL1Xk'> <img src='https://$$CompanyURL$$/images/mailer-pintrest.png'  style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a> \n                     \n                     </div></td>\n                  </tr>\n                </tbody>\n              </table></td>\n          </tr>\n            </tbody>\n          \n        </table>\n        <div class='clear'></div>\n      </div>\n        </td>\n      \n        </tr>\n      \n        </tbody>\n      \n    </table>\n  </div>\n  <p style='font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>\n</div>";
/** My_Profile.SendConfirmationEmailForBankFetail mail body (verbatim C# string) */
const T_BANK = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>\n    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet'>\n    <table cellpadding='0' cellspacing='0' style='margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>\n      <tbody>\n        <tr>\n          <td><table style='width:100%;'>\n              <tbody>\n                <tr>\n                  <td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/anav-exchange-logo.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\n                </tr>\n              </tbody>\n            </table></td>\n        </tr>\n        <tr>\n          <td><div>\n              <div class='clear'></div>\n              \n              <div style='clear: both'></div>\n              <div style='clear: both'></div>\n              <table style='padding-bottom: 10px; width: 100%; '>\n                <tbody>\n                  <tr>\n                    <td></td>\n                  </tr>\n                  <tr>\n                    <td align='center'><strong style='font-size: 20px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Your Bank Details\n                      <p></p>\n                      </strong>\n                      <div style='text-align:left;'>\n                        <h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Hello $$lblname$$, </h1>\n                        <p style='font-size: 14px; font-weight: normal; margin: 10px 0px 0px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; text-align:left; color: #000'>Thanks for updating your bank details  on $$CompanyURL$$. </p>\n                        <p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 10px; font-family: Arial, Helvetica, sans-serif; text-align:left; color: #000'>Your bank details has been updated successfully according to your provided details. </p>\n                      </div>\n                      <div style='clear: both'></div>\n                      \n                      <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\n                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>\n                          <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> If you have any issues,\n            we will be happy to help you. You can contact us on <a href = 'mailto:$$CompanySupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$CompanySupportEmailId$$ </a></p>\n                     \n                                     </div>\n                     \n\n\n                                           </td>\n                     \n                                       </tr>\n                     \n                                       <tr>\n                     \n                                         <td>\n                     \n                                         <table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>\n                      \n                                      <tbody>\n                      \n                                        <tr>\n                      \n                                        <td>\n                      \n\n                                            <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>\n                       \n                                               <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5>\n                            \n\n                                              </td>\n                            \n                                                <td>\n                            \n                                                <div style = 'margin-right: 7px; text-align:right'>\n                             \n                                                 <a href = 'https://www.facebook.com/ATCShoppingServices/' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n                                        \n                                                            <a href = 'https://twitter.com/ATCShoppingServices' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n                                                   \n                                                                       <a href = 'https://plus.google.com/+ATCShoppingIn' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n                                                              \n                                                                                  <a href = 'https://www.linkedin.com/company/ATCShopping' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n                                                                         \n                                                                                              <a href = 'https://pinterest.com/ATCShoppingServices/' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>\n                                                                                    \n\n                                                                                                         </div></td>\n                                                                                    \n                                                                                                      </tr>\n                                                                                    \n                                                                                                    </tbody>\n                                                                                    \n                                                                                                  </table></td>\n                                                                                    \n                                                                                                      </tr>\n                                                                                    \n                                                                                                    </tbody>\n                                                                                    \n                                                                                                  </table>\n                                                                                    \n                                                                                                  <div class='clear'></div>\n            </div></td>\n        </tr>\n      </tbody>\n    </table>\n  </div>\n  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>\n</div>";
/** KYCCheck.SendConfirmationEmail mail body (verbatim C# string) */
const T_KYCCHECK = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; padding-bottom:10px;'>\n<div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>\n<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\n<table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>\n<tbody>\n<tr>\n<td><table style='width:100%;'>\n<tbody>\n<tr>\n<td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/anav-exchange-logo.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\n</tr>\n</tbody>\n</table></td>\n</tr>\n<tr>\n<td>\n<div class='clear'></div>\n<table style='padding-bottom: 10px; width: 100%; '>\n<tbody>\n<tr>\n<td>\n<tr>\n<td align='center'><strong style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> KYC Documents Verification Process\n</p>\n</strong>\n<div style='text-align:left;'>\n<h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Dear $$lblname$$, </h1>\n<div style='font-size: 15px; color: #333;'>\n</div>\n<p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> Thanks for Submitting your KYC documents. Your Referral Program will be working only after your KYC documents are approved by our Verification Team. </p>\n<p  style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'>We will process the documents and update the status within next 48hrs. Please be patience.</p>\n</div>\n<div style='clear: both'></div>\n<div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\n<h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>\n<p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> If you have any issues,\nwe will be happy to help you. You can contact us on <a href = 'mailto:$$CompanySupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$CompanySupportEmailId$$ </a></p>\n</div>\n</td>\n</tr>\n<div style = 'clear: both'></div>\n<div style = 'clear: both'></div>\n</td>\n</tr>\n<tr>\n<td><table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>\n<tbody>\n<tr>\n<td>\n<p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>\n<h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5>\n</td>\n<td>\n<div style = 'margin-right: 7px; text-align:right'>\n<a href = 'https://www.facebook.com/ATCShoppingServices/' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n\n<a href = 'https://twitter.com/ATCShoppingServices' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n\n<a href = 'https://plus.google.com/+ATCShoppingIn' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n\n<a href = 'https://www.linkedin.com/company/ATCShopping' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n\n<a href = 'https://pinterest.com/ATCShoppingServices/' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>\n</div></td>\n</tr>\n</tbody>\n</table></td>\n</tr>\n</tbody>\n</table>\n<div class='clear'></div>\n</div>\n</td>\n</tr>\n</tbody>\n</table>\n</div>\n<p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>\n</div>";
/** UserPanel/Business_KYC.SendConfirmationEmail mail body (verbatim C# string) */
const T_BUSINESS_KYC = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; padding-bottom:10px;'>\n<div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>\n<link href='http://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\n<table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>\n<tbody>\n<tr>\n<td><table style='width:100%;'>\n<tbody>\n<tr>\n<td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='http://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\n</tr>\n</tbody>\n</table></td>\n</tr>\n<tr>\n<td>\n<div class='clear'></div>\n<table style='padding-bottom: 10px; width: 100%; '>\n<tbody>\n<tr>\n<td>\n<tr>\n<td align='center'><strong style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Business KYC Verification Process\n</p>\n</strong>\n<div style='text-align:left;'>\n<h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Dear Sir/ Ma’m, </h1>\n<div style='font-size: 15px; color: #333;'>\n</div>\n<p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> Thanks for Submitting your Business KYC. </p>\n<p  style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'>We will process the documents and update the status within two working days. Please keep patience.</p>\n</div>\n<div style='clear: both'></div>\n<div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\n<h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>\n<p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> If you have any issues,\nwe will be happy to help you. You can contact us on <a href = 'mailto:$$SupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$SupportEmailId$$ </a></p>\n</div>\n</td>\n</tr>\n<div style = 'clear: both'></div>\n<div style = 'clear: both'></div>\n</td>\n</tr>\n<tr>\n<td><table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>\n<tbody>\n<tr>\n<td>\n<p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>\n<h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5>\n</td>\n<td>\n<div style = 'margin-right: 7px; text-align:right'>\n<a href = 'javascript:void(0)' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'http://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n\n<a href = 'javascript:void(0)' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'http://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n\n<a href = 'javascript:void(0)' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'http://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n\n<a href = 'javascript:void(0)' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'http://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n\n<a href = 'javascript:void(0)' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'http://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>\n</div></td>\n</tr>\n</tbody>\n</table></td>\n</tr>\n</tbody>\n</table>\n<div class='clear'></div>\n</div>\n</td>\n</tr>\n</tbody>\n</table>\n</div>\n<p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2017-2018 All Rights Reserved | $$CompanyURL$$</p>\n</div>";

/** KYCCheckController.SendConfirmationEmail (protected helper, not an action) */
async function KycCheckSendConfirmationEmail(ToEmail, Username, Text) {
  let send = 0;
  try {
    const subject = '' + s(CompanySettings.CompanyName) + ' Support Center';
    let mailtxt = '';
    const Date_ = todayDMY();
    if (send === 0) {
      mailtxt = T_KYCCHECK;
      mailtxt = fillMail(mailtxt, [
        ['$$lblname$$', Username], ['$$datetime$$', Date_], ['$$lblmessage$$', Text],
        ['$$CompanyName$$', CompanySettings.CompanyName], ['$$CompanyURL$$', CompanySettings.CompanyURL],
        ['$$CompanyDomain$$', CompanySettings.CompanyDomain], ['$$CompanySupportEmailId$$', CompanySettings.CompanySupportEmailId],
      ]);
      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) {
    // ViewBag.Message = exp.Message
  }
}

/** UserPanel/Business_KYCController.SendConfirmationEmail (protected helper, not an action) */
async function BusinessKycSendConfirmationEmail(ToEmail, Username, Text) {
  let send = 0;
  try {
    const subject = '' + s(CompanySettings.CompanyName) + ' Support Center';
    let mailtxt = '';
    const Date_ = todayDMY();
    if (send === 0) {
      mailtxt = T_BUSINESS_KYC;
      // legacy typo "$$$CompanyDomain$$" kept: the $$CompanyDomain$$ placeholder is never replaced
      mailtxt = fillMail(mailtxt, [
        ['$$lblname$$', Username], ['$$datetime$$', Date_], ['$$lblmessage$$', Text],
        ['$$$CompanyDomain$$', CompanySettings.CompanyDomain], ['$$SupportEmailId$$', CompanySettings.CompanySupportEmailId],
        ['$$CompanyName$$', CompanySettings.CompanyName], ['$$CompanyURL$$', CompanySettings.CompanyURL],
      ]);
      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) {
    // ViewBag.Message = exp.Message
  }
}

/** db._Member_Master.Where(a => a.PLID == Plid).FirstOrDefault() (EMAILID, USERNAME, REGNO) */
async function memberMasterByPlid(Plid) {
  return db.queryOne(DB, 'select emailid, username, regno from member_master where plid = @Plid limit 1', { Plid });
}

/**
 * db._kyc.Where(a => a.CLID == regno && a.isAprove == 0 && a.KYCTYPE == 1).Count()
 * PORT-NOTE: the portal Kyc entity maps its key property CLID to a column that does not exist in DBO.KYC (the table has Regno);
 * EF would have failed with "Invalid column name 'CLID'". The port counts on regno (the evident intent, as in the Merchant panel).
 */
async function kycCount(regno) {
  return Number(await db.scalar(DB, 'select count(1) from kyc where regno = @regno and isaprove = 0 and kyctype = 1', { regno })) || 0;
}

/** KYCCheckController.InsertKYCViaCs(string Typetext, string MemberImg, int Mode, int Id, string Get_This, double Plid) : string */
async function InsertKYCViaCs(Typetext, MemberImg, Mode, Id, Get_This, Plid) {
  let ret = '';
  if (Typetext === 'Pancard-Details') {
    // (bank details check commented out in legacy)
  }
  if (Typetext === 'bank-passbook') {
    // (bank details check commented out in legacy)
  }
  let strValidFullName = '';
  try {
    let ImgName = '';
    if (MemberImg === null || MemberImg === undefined) throw NRE(); // MemberImg.Trim()
    if (MemberImg.trim() !== '' && MemberImg.includes('base64,')) {
      const SavePaths = appFolder('KYC_Images');
      if (MemberImg !== '') {
        ImgName = legacyKycImgName('', Plid); // private string loginid = ""
      } else {
        ImgName = ' ';
      }
      strValidFullName = mapPath(SavePaths) + '/' + ImgName;
      ImgName = s(await UtilityClass.ImageUploadMasterMethod(MemberImg, SavePaths, SavePaths, UtilityClass.ImageMode.Original, 'KYC'));
    }
    const sp = await db.procOne(DB, 'USP_INSERTKYC', { PLID: Plid, TYPE: Get_This, IMAGE: ImgName, ID: Id, MODE: Mode });
    ret = outAny(sp, 'STRRESULT').toLowerCase();
    let emailid = ''; let username = ''; let regno = 0;
    const row = await memberMasterByPlid(Plid);
    if (row !== null) {
      emailid = row.emailid;
      username = row.username;
      regno = row.regno;
      const kyc_count = await kycCount(regno);
      if (kyc_count === 4) {
        await KycCheckSendConfirmationEmail(emailid, username, 'Thank you accepting the referral program.');
      }
    }
  } catch (Exp) {
    // ViewBag.Message = Exp.Message
    deleteIfExists(strValidFullName);
    return Exp.message;
  }
  return ret;
}

/** ViewBag defaults shared by KYC.Index, kyc_mobile.Index and UserPanel/Business_KYC.Index (same statements, same order) */
function businessKycViewBagDefaults(ViewBag) {
  ViewBag.PancardDeails = '/images/uploadkyc.png';
  ViewBag.AddressProofDeails = '/images/uploadkyc.png';
  ViewBag.CompanyPancardDeails = '/images/uploadkyc.png';
  ViewBag.Deed = '/images/uploadkyc.png';
  ViewBag.PartnerShipDeed = '/images/uploadkyc.png';
  ViewBag.MemorandumOfAssociation = '/images/uploadkyc.png';
  ViewBag.IncorporationCertificate = '/images/uploadkyc.png';
  ViewBag.Bankimage = '/images/uploadkyc.png';
  ViewBag.CompanyAddressProofDeails = '/images/uploadkyc.png';
  ViewBag.PancardMessage = '';
  ViewBag.PancardApprovalStatus = 0;
  ViewBag.AddressProofMessage = '';
  ViewBag.AddressProofApprovalStatus = 0;
  ViewBag.DeedMessage = '';
  ViewBag.DeedApprovalStatus = 0;
  ViewBag.PartnerShipDeedMessage = '';
  ViewBag.PartnerShipDeedApprovalStatus = 0;
  ViewBag.MemorandumOfAssociationMessage = '';
  ViewBag.MemorandumOfAssociationApprovalStatus = 0;
  ViewBag.IncorporationCertificateMessage = '';
  ViewBag.IncorporationCertificateApprovalStatus = 0;
  ViewBag.BankProofMessage = '';
  ViewBag.BankProofApprovalStatus = 0;
  ViewBag.PancardImageMessage = 'Image Not Uploaded';
  ViewBag.AddressProofImageMessage = 'Image Not Uploaded';
  ViewBag.DeedImageMessage = 'Image Not Uploaded';
  ViewBag.PartnerShipDeedImageMessage = 'Image Not Uploaded';
  ViewBag.MemorandumOfAssociationImageMessage = 'Image Not Uploaded';
  ViewBag.IncorporationCertificateImageMessage = 'Image Not Uploaded';
  ViewBag.BankImageMessage = 'Image Not Uploaded';
  ViewBag.CompanyAddressProofImageMessage = 'Image Not Uploaded';
  ViewBag.CompanyPancardImageMessage = 'Image Not Uploaded';
  return ViewBag;
}

/**
 * Tbl_CustomerKycDetails loop of KYC.Index / kyc_mobile.Index
 * (SqlQuery<BusinessKycDetails>("Select Convert(Varchar(100),DOI,110)As DOI,PANNO,EntityType,Type From Tbl_CustomerKycDetails Where CLID=" + Plid))
 */
async function customerKycDetailsViewBag(ViewBag, Plid) {
  const rows = await db.query(DB, `select to_char(doi, 'MM-DD-YYYY') as doi, panno, entitytype, type
from tbl_customerkycdetails where clid = @Plid`, { Plid });
  for (const r of rows) {
    // BusinessKycDetails.EntityType is a non-nullable int: EF failed to materialise a NULL
    if (r.entitytype === null || r.entitytype === undefined) {
      throw new Error("The 'EntityType' property on 'BusinessKycDetails' could not be set to a 'null' value. You must set this property to a non-null value of type 'System.Int32'. ");
    }
    const row = { DOI: r.doi, PANNO: r.panno, EntityType: Number(r.entitytype), Type: r.type };
    if (row !== null && row.Type === 'Pancard-Details') {
      ViewBag.DOI = row.DOI;
      ViewBag.PanNo = row.PANNO;
      ViewBag.EntityType = row.EntityType;
    }
    if (row !== null && row.Type === 'Company-Pancard-Details') {
      ViewBag.CompanyDOI = row.DOI;
      ViewBag.CompanyPanNo = row.PANNO;
    }
  }
  return ViewBag;
}

/** db._Portal_Login.Where(a => a.PLID == Plid).FirstOrDefault() (EMAILID, PHONE) */
async function portalLoginByPlid(Plid) {
  return db.queryOne(DB, 'select emailid, phone from portal_login where plid = @Plid limit 1', { Plid });
}

const CUSTOMER_KYC_SMS = () => 'Dear Sir/ Ma’m \r\n Thanks for Submitting your Business KYC. \r\n ' + s(CompanySettings.CompanyName) + ' Team ';

/**
 * Body of KYCController.InsertKYCViaJquery and kyc_mobileController.InsertKYCViaJquery (identical C#).
 * (string Typetext, string MemberImg, int Mode, int Id, string GetThisId, string FirstValue, string SecondValue, string AddressType, string AddressTypeNumber)
 */
async function customerKycInsertViaJquery(req, res, controllerName) {
  const sig = 'System.Web.Mvc.JsonResult InsertKYCViaJquery(System.String, System.String, Int32, Int32, System.String, System.String, System.String, System.String, System.String)';
  void controllerName;
  const Typetext = str(req.p.Typetext);
  const MemberImg = str(req.p.MemberImg);
  const Mode = requiredInt(req.p.Mode, 'Mode', sig);
  const Id = requiredInt(req.p.Id, 'Id', sig);
  const GetThisId = str(req.p.GetThisId);
  const FirstValue = str(req.p.FirstValue);
  const SecondValue = str(req.p.SecondValue);
  const AddressType = str(req.p.AddressType);
  const AddressTypeNumber = str(req.p.AddressTypeNumber);
  let ret = '';
  let result = 0;
  const Plid = req.user.plid;
  // (empty if-blocks for Pancard-Details / Address-Proof / Deed / Partnership-Deed / Memorandum-Of-Association /
  //  Incorporation-Certificate / Company-Pancard-Details / Company-Address-Proof in legacy)
  let strValidFullName = '';
  try {
    let ImgName = '';
    if (MemberImg === null) throw NRE(); // MemberImg.Trim()
    if (MemberImg.trim() !== '' && MemberImg.includes('base64,')) {
      const SavePaths = appFolder('KYC_Images');
      if (MemberImg !== '') {
        ImgName = legacyKycImgName('', Plid); // private string loginid = ""
      } else {
        ImgName = ' ';
      }
      strValidFullName = mapPath(SavePaths) + '/' + ImgName;
      ImgName = s(await UtilityClass.ImageUploadMasterMethod(MemberImg, SavePaths, SavePaths, UtilityClass.ImageMode.Original, 'KYC'));
    } else {
      ImgName = MemberImg;
      ImgName = ImgName.split('/KYC_Images/').join('');
    }
    const sp = await db.procOne(DB, 'USP_INSERTKYC_Customer', {
      PLID: Plid, TYPE: GetThisId, IMAGE: ImgName, ID: Id, MODE: Mode, KYCTYPE: 2, AddressType, AddressTypeNumber,
    });
    ret = outAny(sp, 'STRRESULT').toLowerCase();
    if (s(ret) === 'ok' && FirstValue !== '') {
      const r = await db.procOne(DB, 'USP_UPDATECUSTOMERKYCDETAILS', {
        PLID: Plid, EntityType: sqlInt(''), PANNO: FirstValue, DOI: SecondValue, Type: Typetext,
      });
      const ResValue = outAny(r, 'INTRESULT');
      if (ResValue === '3') {
        ret = 'Already Exist';
        return res.json(ret);
      }
      if (ResValue === '1') {
        ret = 'Insert';
        return res.json(ret);
      }
      if (ResValue === '2') {
        ret = 'Update';
        return res.json(ret);
      }
    }
    let emailid = ''; let mobile = ''; const username = '';
    const row = await portalLoginByPlid(Plid);
    result = await updatemerchantkyc(Plid);
    if (row !== null) {
      emailid = row.emailid;
      mobile = row.phone;
      if (result === 1) {
        // SendConfirmationEmail(...) commented out in legacy
        void emailid; void username;
        bg(() => UtilityClass.SendMsgOnMobile(mobile, CUSTOMER_KYC_SMS()));
      }
    }
  } catch (Exp) {
    // ViewBag.Message = Exp.Message
    deleteIfExists(strValidFullName);
    return res.json(Exp.message);
  }
  return res.json({ ret, result });
}

/**
 * Body of KYCController.SaveBankDetails and kyc_mobileController.SaveBankDetails (identical C#).
 * (string Name, string BranchName, string AccountNo, string Ifsccode, string BankName, string Cancelled_Cheque_img, string Address, string state, string city)
 * PORT-NOTE: DBO.USP_INSERTBANKDETAISCUSTOMER is not present in dbshopping.sql; it is called with the legacy argument names.
 */
async function customerKycSaveBankDetails(req, res) {
  const p = req.p;
  const Name = str(p.Name); const BranchName = str(p.BranchName); const AccountNo = str(p.AccountNo);
  const Ifsccode = str(p.Ifsccode); const BankName = str(p.BankName); const Cancelled_Cheque_img = str(p.Cancelled_Cheque_img);
  const Address = str(p.Address); const state = str(p.state); const city = str(p.city);
  let ret = '';
  let result = 0;
  let imgname = '';
  const Plid = req.user.plid;
  const loginid = req.user.loginid; void loginid;
  const SavePaths = appFolder('KYC_Images');
  if (Cancelled_Cheque_img === null) throw NRE(); // Cancelled_Cheque_img.Contains(...)
  if (Cancelled_Cheque_img.includes('base64,')) {
    imgname = s(await UtilityClass.ImageUploadMasterMethod(Cancelled_Cheque_img, SavePaths, SavePaths, UtilityClass.ImageMode.Thumbnail, 'Kyc_Images'));
  }
  const sp = await db.procOne(DB, 'USP_INSERTBANKDETAISCUSTOMER', {
    PLID: Plid, HOLDERNAME: Name, ACOUNTNO: AccountNo, BANKNAME: BankName, BRANCHNAME: BranchName, IESCCODE: Ifsccode,
    Address, state, city, Cancelled_Cheque_img: imgname, Kyctype: '',
  });
  ret = outAny(sp, 'INTRESULT').toLowerCase();
  if (ret === '2') {
    let emailid = ''; let mobile = ''; const username = '';
    const row = await portalLoginByPlid(Plid);
    result = await updatemerchantkyc(Plid);
    if (result === 1) {
      if (row !== null) {
        emailid = row.emailid;
        mobile = row.phone;
        // SendConfirmationEmail(...) commented out in legacy
        void emailid; void username;
        bg(() => UtilityClass.SendMsgOnMobile(mobile, CUSTOMER_KYC_SMS()));
      }
    }
  }
  return res.json({ ret, result });
}

module.exports = {
  businessKycViewBagDefaults, customerKycDetailsViewBag, portalLoginByPlid, customerKycInsertViaJquery, customerKycSaveBankDetails,
  DB, s, nz, NRE, str, outAny, sqlInt, toInt32, requiredInt, mapPath, randomNext, bg, todayDMY, longDate, fillMail,
  checkMailAddress, tempDataKeep, appFolder, legacyKycImgName, deleteIfExists, updatemerchantkyc, memberMasterByPlid, kycCount,
  T_PROFILE, T_BANK, T_KYCCHECK, T_BUSINESS_KYC, CompanySettings,
  KycCheckSendConfirmationEmail, BusinessKycSendConfirmationEmail, InsertKYCViaCs,
};
