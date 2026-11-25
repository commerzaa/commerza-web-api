'use strict';
// Ported from Franchise\Controllers\CustomerPanel\My_Profile.cs  (database: shopping — Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('../../config');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const Base32Encoder = require('../../lib/franchise/Base32Encoder');
const Security_Key = require('../../lib/franchise/Security_Key');
const SendMail = require('../../lib/franchise/SendMail');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const CompanySettings = require('../../lib/franchise/CompanySettings');
const GetCountry = require('../../lib/franchise/GetCountry');

const router = express.Router();
const P = '/franchise/My_Profile';

const MEMBERPROFILE = ['PMID', 'plid', 'Title', 'Fname', 'Lname', 'Phone', 'Designation', 'CPer_EmailID', 'LoginId', 'Password', 'ImageName', 'USERNAME', 'PhoneWithCode', 'CountryName', 'INTRO_PLID', 'DOB', 'FatherOrMotherName', 'Gender'];

const str = (v) => (v === undefined || v === null ? '' : String(v)); // ToStringOrEmpty
const nz = (v) => (v === undefined ? null : v);
// ConfigurationManager.AppSettings[key]
const appSetting = (k) => (config.app && config.app[k] !== undefined ? config.app[k] : process.env[k]);
// Server.MapPath("~/Folder") -> config.uploadDir/Folder
const mapPath = (p) => path.join(config.uploadDir, String(p || '').replace(/^~?[\\/]*/, ''));
// OUT parameter value read from the single result row (db.proc convention)
const outv = (row, name) => {
  if (!row) return null;
  const k = name.toLowerCase();
  if (k in row) return row[k];
  const keys = Object.keys(row);
  return keys.length ? row[keys[0]] : null;
};
const rnd = (a, b) => Math.floor(Math.random() * (b - a)) + a; // Random.Next(a,b)

const TPL_PROFILE = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; padding:15px 25px;'>\n    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\n    <table cellpadding='0' cellspacing='0' style='margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; width: 100%'>\n        <tbody>\n\n      <tr>\n        <td><table style='width:100%;'>\n            <tbody>\n              <tr>\n                <td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\n              </tr>\n            </tbody>\n          </table></td>\n      </tr>\n        <tr>\n\n        <td>\n\n      <div>\n        <div class='clear'></div>\n        <table style='padding-bottom: 10px; width: 100%; '>\n          <tbody>\n            <tr>\n              <td>\n            <tr>\n              <td align='center'><strong style='font-size: 20px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Your Profile Updated Successfully\n                </p>\n                </strong>\n                <div style='text-align:left;'>\n                  <h1 style='font-size: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Hello $$lblname$$, </h1>\n                  <p style='font-size: 14px; font-weight: normal; margin: 10px 0px 0px 0px; padding-top: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; text-align:left; color: #000'>Thanks for updating your profile on $$CompanyURL$$.</p>\n                  <p style='font-size: 14px; font-weight: normal; margin: 0px 0px 0px 0px; padding-top: 10px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; text-align:left; color: #000'>\n                  <table cellpadding='0' cellspacing='0' width='98%' style='font-size:12px;  font-family:Arial; color:#454545;   '>\n                    <tr>\n                      <td colspan='3' style='height:10px; line-height:10px;'></td>\n                    </tr>\n                    <tr>\n                      <td  style='text-align:right; width:90px; margin:0px; padding:0px; line-height:25px; height:25px;'><span style='float:right;'>Username </span></td>\n                      <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\n                      <td align='left' style='line-height:25px; height:25px;'><span style='font-weight:bold;'>$$lblupdateusername$$</span></td>\n                    </tr>\n                    <tr>\n                      <td  style='text-align:right; width:90px; margin:0px; padding:0px; line-height:25px; height:25px;'><span style='float:right;'>Title </span></td>\n                      <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\n                      <td align='left' style='line-height:25px; height:25px;'><span style='font-weight:bold;'>$$lblTitle$$</span></td>\n                    </tr>\n                    <tr>\n                      <td  style='text-align:right; width:90px; margin:0px; padding:0px; line-height:25px; height:25px;'><span style='float:right;'>Full Name </span></td>\n                      <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\n                      <td align='left' style='line-height:25px; height:25px;'><span  style='font-weight:bold;'>$$lblFirstName$$</span></td>\n                    </tr>\n\n                    <tr>\n                      <td  style='text-align:right; width:90px; margin:0px; padding:0px; line-height:25px; height:25px;'><span style='float:right;'>Contact No. </span></td>\n                      <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\n                      <td align='left' style='line-height:25px; height:25px;'><span  style='font-weight:bold;'>$$lblContact$$</span></td>\n                    </tr>\n                    <tr>\n                      <td  style='text-align:right; width:90px; margin:0px; padding:0px; line-height:25px; height:25px;'><span style='float:right;'>Email Id </span></td>\n                      <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\n                      <td align='left' style='line-height:25px; height:25px;'><span  style='font-weight:bold;'>$$lblemailid$$</span></td>\n                    </tr>\n                    <tr>\n                      <td  style='text-align:right; width:90px; margin:0px; padding:0px; line-height:25px; height:25px;'><span style='float:right;'>Designation </span></td>\n                      <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\n                      <td align='left' style='line-height:25px; height:25px;'><span  style='font-weight:bold;'>$$lbldesignation$$</span></td>\n                    </tr>\n                  </table>\n                  </p>\n                </div>\n                <div style='clear: both'></div>\n                <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\n                  <h5 style='margin:0; font-size:18px; font-weight:normal; padding-bottom:5px;'>Need Support?</h5>\n                  <p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: 'Exo', sans-serif, Helvetica, sans-serif;  color: #000'> If you have any issues,\nwe will be happy to help you. You can contact us on <a href='mailto:$$CompanySupportEmailID$$' target='_blank' style='color:#00a0a8;'>$$CompanySupportEmailID$$ </a></p>\n                </div>\n                </td>\n            </tr>\n          <div style='clear: both'></div>\n          <div style='clear: both'></div>\n            </td>\n\n            </tr>\n\n          <tr>\n            <td>\n\n            <table style='width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>\n                <tbody>\n                  <tr>\n                  <td>\n\n                      <p style='margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'>Sincerely</p>\n                        <h5 style='margin:0; font-size:14px;  padding-bottom:5px;'>The $$CompanyName$$ Team</h5>\n\n                  </td>\n                    <td>\n                    <div style='margin-right: 7px; text-align:right'>\n                    <a href='javascript:void(0)' style='color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target='8SE_b89lng5GVbx5a7NZME9'> <img src='https://$$CompanyURL$$/images/mailer-facebook.png'  style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n                    <a href='javascript:void(0)' style='color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='e3PP7S0O2rDcb5kT5Qxvkl9'> <img src='https://$$CompanyURL$$/images/mailer-twitter.png' style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n                    <a href='javascript:void(0)' style='color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='k_lu77WHdSxxe84MTtrgPlD'> <img src='https://$$CompanyURL$$/images/mailer-gplus.png'  style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n                    <a href='javascript:void(0)' style='color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='1QtmtsX-zlkY3NH-RX8bXJB'> <img src='https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n                     <a href='javascript:void(0)' style='color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='FTivBEnhJ2wIlo_i9yYL1Xk'> <img src='https://$$CompanyURL$$/images/mailer-pintrest.png'  style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>\n\n                     </div></td>\n                  </tr>\n                </tbody>\n              </table></td>\n          </tr>\n            </tbody>\n\n        </table>\n        <div class='clear'></div>\n      </div>\n        </td>\n\n        </tr>\n\n        </tbody>\n\n    </table>\n  </div>\n  <p style='font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>\n</div>";
const TPL_BANK = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; padding:15px 25px;'>\n    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet'>\n    <table cellpadding='0' cellspacing='0' style='margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; width: 100%'>\n      <tbody>\n        <tr>\n          <td><table style='width:100%;'>\n              <tbody>\n                <tr>\n                  <td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\n                </tr>\n              </tbody>\n            </table></td>\n        </tr>\n        <tr>\n          <td><div>\n              <div class='clear'></div>\n\n              <div style='clear: both'></div>\n              <div style='clear: both'></div>\n              <table style='padding-bottom: 10px; width: 100%; '>\n                <tbody>\n                  <tr>\n                    <td></td>\n                  </tr>\n                  <tr>\n                    <td align='center'><strong style='font-size: 20px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Your Bank Details\n                      <p></p>\n                      </strong>\n                      <div style='text-align:left;'>\n                        <h1 style='font-size: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Hello $$lblname$$, </h1>\n                        <p style='font-size: 14px; font-weight: normal; margin: 10px 0px 0px 0px; padding-top: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; text-align:left; color: #000'>Thanks for updating your bank details  on $$CompanyURL$$. </p>\n                        <p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 10px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; text-align:left; color: #000'>Your bank details has been updated successfully according to your provided details. </p>\n                      </div>\n                      <div style='clear: both'></div>\n\n                      <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\n                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>\n                          <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: 'Exo', sans-serif, Helvetica, sans-serif;  color: #000'> If you have any issues,\n            we will be happy to help you. You can contact us on <a href = 'mailto:$$CompanySupportEmailID$$' target = '_blank' style = 'color:#00a0a8;'> $$CompanySupportEmailID$$ </a></p>\n\n                                     </div>\n\n                                           </td>\n\n                                       </tr>\n\n                                       <tr>\n\n                                         <td>\n\n                                         <table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>\n\n                                      <tbody>\n\n                                        <tr>\n\n                                        <td>\n\n                                            <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>\n\n                                               <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5>\n\n                                              </td>\n\n                                                <td>\n\n                                                <div style = 'margin-right: 7px; text-align:right'>\n\n                                                 <a href = '$$CompanyFacebookLink$$' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n\n                                                            <a href = '$$CompanyTwitterLink$$' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n\n                                                                       <a href = '$$CompanyGooglePlusLink$$' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n\n                                                                                  <a href = '$$CompanyLinkedinLink$$' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n\n                                                                                              <a href = '$$CompanyPinterestLink$$' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>\n\n                                                                                                         </div></td>\n\n                                                                                                      </tr>\n\n                                                                                                    </tbody>\n\n                                                                                                  </table></td>\n\n                                                                                                      </tr>\n\n                                                                                                    </tbody>\n\n                                                                                                  </table>\n\n                                                                                                  <div class='clear'></div>\n            </div></td>\n        </tr>\n      </tbody>\n    </table>\n  </div>\n  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>\n</div>";
const TPL_KYC = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; padding-bottom:10px;'>\n<div style='background: #fff; margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; padding:15px 25px;'>\n<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\n<table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; width: 100%'>\n<tbody>\n<tr>\n<td><table style='width:100%;'>\n<tbody>\n<tr>\n<td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\n</tr>\n</tbody>\n</table></td>\n</tr>\n<tr>\n<td>\n<div class='clear'></div>\n<table style='padding-bottom: 10px; width: 100%; '>\n<tbody>\n<tr>\n<td>\n<tr>\n<td align='center'><strong style='font-size: 18px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> KYC Documents Verification Process\n</p>\n</strong>\n<div style='text-align:left;'>\n<h1 style='font-size: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Dear $$lblname$$, </h1>\n<div style='font-size: 15px; color: #333;'>\n</div>\n<p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: 'Exo', sans-serif, Helvetica, sans-serif;  color: #000'> Thanks for Submitting your KYC documents. Your Referral Program will be working only after your KYC documents are approved by our Verification Team. </p>\n<p  style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: 'Exo', sans-serif, Helvetica, sans-serif;  color: #000'>We will process the documents and update the status within next 48hrs. Please be patience.</p>\n</div>\n<div style='clear: both'></div>\n<div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\n<h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>\n<p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: 'Exo', sans-serif, Helvetica, sans-serif;  color: #000'> If you have any issues,\nwe will be happy to help you. You can contact us on <a href = 'mailto:$$CompanySupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$CompanySupportEmailId$$ </a></p>\n</div>\n</td>\n</tr>\n<div style = 'clear: both'></div>\n<div style = 'clear: both'></div>\n</td>\n</tr>\n<tr>\n<td><table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>\n<tbody>\n<tr>\n<td>\n<p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>\n<h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5>\n</td>\n<td>\n<div style = 'margin-right: 7px; text-align:right'>\n<a href = '$$CompanyFacebookLink$$' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n\n<a href = '$$CompanyTwitterLink$$' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n\n<a href = '$$CompanyGooglePlusLink$$' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n\n<a href = '$$CompanyLinkedinLink$$' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n\n<a href = '$$CompanyPinterestLink$$' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>\n</div></td>\n</tr>\n</tbody>\n</table></td>\n</tr>\n</tbody>\n</table>\n<div class='clear'></div>\n</div>\n</td>\n</tr>\n</tbody>\n</table>\n</div>\n<p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>\n</div>";

function fillMail(tpl, map) {
  let t = tpl;
  for (const k of Object.keys(map)) t = t.split(k).join(map[k] === undefined || map[k] === null ? '' : String(map[k]));
  return t;
}

function fmtDate() { // DateTime.Now.ToString("dddd MMMM dd yyyy hh:mm tt")
  const d = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const p = (n) => String(n).padStart(2, '0');
  const h = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${p(d.getDate())} ${d.getFullYear()} ${p(h)}:${p(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

async function SendConfirmationEmail(ToEmail, Username, Text, Title, Designation, Phoneno, Email, Fname, Lname, updateusername) {
  try {
    const subject = '' + CompanySettings.CompanyName + ' Support Center';
    let mailtxt = TPL_PROFILE;
    const Date_ = fmtDate();
    mailtxt = fillMail(mailtxt, {
      '$$lblupdateusername$$': updateusername, '$$lblname$$': Username, '$$datetime$$': Date_, '$$lblmessage$$': Text,
      '$$lblTitle$$': Title, '$$lblFirstName$$': Fname, '$$lblLastName$$': Lname, '$$lblContact$$': Phoneno,
      '$$lblemailid$$': Email, '$$lbldesignation$$': Designation, '$$CompanyDomain$$': CompanySettings.CompanyDomain,
      '$$CompanyURL$$': CompanySettings.CompanyURL, '$$CompanyName$$': CompanySettings.CompanyName,
      '$$CompanySupportEmailID$$': CompanySettings.CompanySupportEmailId,
    });
    await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
  } catch (exp) { /* ViewBag.Message = exp.Message */ }
}

async function SendConfirmationEmailForBankFetail(ToEmail, Username, Text) {
  try {
    const subject = '' + CompanySettings.CompanyName + ' Support Center';
    let mailtxt = TPL_BANK;
    const Date_ = fmtDate();
    mailtxt = fillMail(mailtxt, {
      '$$lblname$$': Username, '$$datetime$$': Date_, '$$lblmessage$$': Text,
      '$$CompanyDomain$$': CompanySettings.CompanyDomain, '$$CompanyURL$$': CompanySettings.CompanyURL,
      '$$CompanyName$$': CompanySettings.CompanyName, '$$CompanySupportEmailID$$': CompanySettings.CompanySupportEmailId,
      '$$CompanyFacebookLink$$': CompanySettings.CompanyFacebookLink, '$$CompanyLinkedinLink$$': CompanySettings.CompanyLinkedinLink,
      '$$CompanyGooglePlusLink$$': CompanySettings.CompanyGooglePlusLink, '$$CompanyTwitterLink$$': CompanySettings.CompanyTwitterLink,
      '$$CompanyPinterestLink$$': CompanySettings.CompanyPinterestLink,
    });
    await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
  } catch (exp) { /* ViewBag.Message = exp.Message */ }
}

// KYCCheckController.SendConfirmationEmail (called from InsertKYCViaCs)
async function KycSendConfirmationEmail(ToEmail, Username, Text) {
  try {
    const subject = '' + CompanySettings.CompanyName + ' Support Center';
    const Date_ = (() => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`; })();
    const mailtxt = fillMail(TPL_KYC, {
      '$$lblname$$': Username, '$$datetime$$': Date_, '$$lblmessage$$': Text,
      '$$CompanyDomain$$': CompanySettings.CompanyDomain, '$$CompanyURL$$': CompanySettings.CompanyURL,
      '$$CompanyName$$': CompanySettings.CompanyName, '$$CompanySupportEmailID$$': CompanySettings.CompanySupportEmailId,
      '$$CompanySupportEmailId$$': CompanySettings.CompanySupportEmailId, '$$CompanyFacebookLink$$': CompanySettings.CompanyFacebookLink,
      '$$CompanyLinkedinLink$$': CompanySettings.CompanyLinkedinLink, '$$CompanyGooglePlusLink$$': CompanySettings.CompanyGooglePlusLink,
      '$$CompanyTwitterLink$$': CompanySettings.CompanyTwitterLink, '$$CompanyPinterestLink$$': CompanySettings.CompanyPinterestLink,
    });
    await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
  } catch (exp) { /* ViewBag.Message = exp.Message */ }
}

// KYCCheckController.InsertKYCViaCs (private helper of the legacy controller, inlined; loginid field is "" in that controller)
async function InsertKYCViaCs(Typetext, MemberImg, Mode, Id, Get_This, Plid) {
  let ret = '';
  let strValidFullName = '';
  try {
    let ImgName = '';
    if (MemberImg.trim() !== '' && MemberImg.includes('base64,')) {
      const SavePaths = appSetting('KYC_Images');
      let ProfileImage = ''; // loginid
      const GetRandomNumber = rnd(1111, 9999);
      ProfileImage = ProfileImage.trim().replace(/&amp;/g, 'And').replace(/&/g, ' And ').replace(/[^\w\d]/g, '').replace(/ /g, '-');
      ImgName = ProfileImage + '-' + Plid + '-' + GetRandomNumber + '.jpg';
      strValidFullName = path.join(mapPath(SavePaths), ImgName);
      ImgName = str(await UtilityClass.ImageUploadMasterMethod(MemberImg, SavePaths, SavePaths, UtilityClass.ImageMode.Original, 'KYC'));
    }
    const sp = await db.procOne('shopping', 'usp_insertkyc', { plid: Plid, type: Get_This, image: ImgName, id: Id, mode: Mode });
    ret = str(outv(sp, 'strresult')).toLowerCase();
    let emailid = ''; let username = ''; let regno = 0;
    const row = await db.queryOne('shopping', 'select emailid, username, regno from member_master where plid = @plid limit 1', { plid: Plid });
    if (row) {
      emailid = row.emailid; username = row.username; regno = row.regno;
      const kyc_count = Number(await db.scalar('shopping', 'select count(*) from kyc_distributor where regno = @regno and isaprove = 0 and kyctype = 1', { regno }));
      if (kyc_count === 4) {
        await KycSendConfirmationEmail(emailid, username, 'Thank you accepting the referral program.');
      }
    }
  } catch (Exp) {
    try { if (strValidFullName && fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName); } catch (e) { /* ignore */ }
    return Exp.message;
  }
  return ret;
}

// public (SecretKey is a plain public method returning TwoFactorSecret)
router.all(P + '/SecretKey{/:id}', asyncHandler(async (req, res) => {
  const secret = req.p.secret;
  const enc = new Base32Encoder().Encode(Buffer.from(String(secret), 'ascii'));
  res.json({ EncodedSecret: enc });
}));

// auth
router.all(P + '/Manage_Secutiry_Key{/:id}', auth, asyncHandler(async (req, res) => {
  let { Mode, Sms, GaKey } = req.p;
  const ActiveKey = parseInt(req.p.ActiveKey, 10);
  if (req.user == null) {
    return res.json('error^This page has been expired, Pleae login again !');
  }
  if (ActiveKey === 1) GaKey = '';
  if (ActiveKey === 2) Sms = '';
  try {
    const obj = new Security_Key();
    const returnval = await obj.Manage_Security_Key(req.user.did, Mode, Sms, GaKey, ActiveKey);
    return res.json(returnval);
  } catch (Exp) {
    return res.json('error^Some error occured' + Exp.message);
  }
}));

async function kycStatus(Plid) {
  const r = await db.procOne('shopping', 'usp_check_kyc', { plid: Plid });
  return str(outv(r, 'strresult'));
}

// auth  (view: ReferralMyProfile, layout _DealsRecordNotFoundLayout)
async function Index1(req, res) {
  const Plid = Number(req.user.did);
  const memdetails = mapRow(await db.procOne('shopping', 'usp_getcontactdetails', { PLID: Plid }), MEMBERPROFILE);
  res.json({ Model: memdetails, view: 'ReferralMyProfile', layout: '_DealsRecordNotFoundLayout' });
}
router.all(P + '/Index1{/:id}', auth, asyncHandler(Index1));

async function Index(req, res) {
  const Plid = Number(req.user.did);
  const status = await kycStatus(Plid);
  const memdetails = mapRow(await db.procOne('shopping', 'usp_getcontactdetails_reseller', { PLID: Plid }), MEMBERPROFILE);
  res.json({ status, Model: memdetails, view: 'ReferralMyProfile', layout: '_DealsRecordNotFoundLayout' });
}
router.all(P + '/Index{/:id}', auth, asyncHandler(Index));
// route-config: franchisee/my-profile
router.all('/franchise/franchisee/my-profile{/:id}', auth, asyncHandler(Index));

async function profileView(req, res, layout) {
  let profile_type = req.p.profile_type;
  if (str(profile_type) === '') profile_type = '';
  const vb = { profile_type: str(profile_type) };
  const Plid = Number(req.user.did);
  vb.status = await kycStatus(Plid);
  let regno = 0;
  const row = await db.queryOne('shopping', 'select regno from member_master where plid = @plid limit 1', { plid: Plid });
  if (row) regno = row.regno;
  vb.pancarfDeails = '../../KYC_Images/NoImage.jpg';
  vb.ProofresidencyDeails = '../../KYC_Images/NoImage.jpg';
  vb.IDProofDeails = '../../KYC_Images/NoImage.jpg';
  vb.photograph = '../../KYC_Images/NoImage.jpg';
  vb.bank_passbook = '../../KYC_Images/NoImage.jpg';
  vb.FormBackDeails = '../../KYC_Images/NoImage.jpg';
  vb.OtherDeails = '../../KYC_Images/NoImage.jpg';
  const row1 = await db.queryOne('shopping', 'select accountholdername, accountno, bankname, branchname, ifsccode, pancardno from bank_accounts where regno = @regno and active = true limit 1', { regno });
  if (row1) {
    vb.acountholdername = str(row1.accountholdername);
    vb.acountno = str(row1.accountno);
    vb.bankname = str(row1.bankname);
    vb.branchname = str(row1.branchname);
    vb.ifsccode = str(row1.ifsccode);
    vb.panno = str(row1.pancardno);
  }
  const memdetails = mapRow(await db.procOne('shopping', 'usp_getcontactdetails', { PLID: Plid }), MEMBERPROFILE);
  res.json({ ...vb, Model: memdetails, view: 'ReferralMyProfile', layout });
}

// auth
const ReferralIndex = (req, res) => profileView(req, res, '_ReferralLayout');
router.all(P + '/ReferralIndex{/:id}', auth, asyncHandler(ReferralIndex));
// route-config: referral/my-profile/{profile_type}, referral/my-profile
router.all('/franchise/referral/my-profile/:profile_type', auth, asyncHandler(ReferralIndex));
router.all('/franchise/referral/my-profile', auth, asyncHandler(ReferralIndex));

// auth
const CustomerIndex = (req, res) => profileView(req, res, '_OuterSearchLayout');
router.all(P + '/CustomerIndex{/:id}', auth, asyncHandler(CustomerIndex));
// route-config: customer/my-profile
router.all('/franchise/customer/my-profile{/:id}', auth, asyncHandler(CustomerIndex));

// public
router.all(P + '/checkifsccode{/:id}', asyncHandler(async (req, res) => {
  try {
    const baseurl = 'https://ifsc.razorpay.com/' + req.p.ifsccode;
    const r = await axios.get(baseurl, { responseType: 'text', transformResponse: (x) => x });
    return res.json(r.data);
  } catch (Exp) {
    return res.json(' Not Found');
  }
}));

// public
router.all(P + '/insert_email_newsletter{/:id}', asyncHandler(async (req, res) => {
  const emaild = req.p.emaild;
  let Result = '';
  // PORT-NOTE: Session["COUNTRYID"/"COUNTRYNAME"/"IPADDRESS"] are kept in sessionStore (filled by GetCountry lib when it can)
  if (sessionStore.get(req, 'COUNTRYID') == null) {
    try {
      const Sessionid = req.ip;
      await GetCountry.SettingVisitor(Sessionid);
      await GetCountry.InitializeVisitorCountrySession(req);
    } catch (Exp) { /* ViewBag.Message */ }
  }
  const CountryName = sessionStore.get(req, 'COUNTRYNAME').toString();
  const IPAddress = sessionStore.get(req, 'IPADDRESS').toString();
  if (str(emaild).trim() !== '') {
    const r = await db.procOne('shopping', 'usp_subscribenewsletter', { emailid: emaild, ipaddress: IPAddress, ipcountry: CountryName });
    Result = str(outv(r, 'strresult'));
  }
  return res.json(Result);
}));

// auth
router.all(P + '/ProfileVerification{/:id}', auth, asyncHandler(async (req, res) => {
  const Phoneno = nz(req.p.Phoneno), Email = nz(req.p.Email), R1 = nz(req.p.R1), R2 = nz(req.p.R2), IsSend = nz(req.p.IsSend);
  let IsVerified = 4;
  if (R1 !== '') {
    if (R1 !== str(sessionStore.get(req, 'R1'))) {
      IsVerified = 0;
      return res.json('2');
    }
    IsVerified = 1;
    await db.exec('shopping', `Update MEMBER_MASTER Set IsMobileSelfVerified=1,
                IsProfileSelfVerified=(Case When IsEmailSelfVerified=1 Then 1 ELSE 0 END),
                IS_PROFILE_STATUS=(Case When IsEmailSelfVerified=1 Then 1 ELSE 0 END) Where PLID=@plid`, { plid: req.user.did });
  }
  if (R2 !== '') {
    if (R2 !== str(sessionStore.get(req, 'R2'))) {
      IsVerified = 0;
      return res.json('3');
    }
    IsVerified = 1;
    await db.exec('shopping', `Update MEMBER_MASTER Set IsEmailSelfVerified=1,
                IsProfileSelfVerified=(Case When IsMobileSelfVerified=1 Then 1 ELSE 0 END),
                IS_PROFILE_STATUS=(Case When IsMobileSelfVerified=1 Then 1 ELSE 0 END) Where PLID=@plid`, { plid: req.user.did });
  }
  if (R1 !== '' && R2 !== '' && IsVerified === 1) {
    IsVerified = 1;
  }
  if (IsSend === '1') {
    const R11 = rnd(100000, 555555);
    const R21 = rnd(666666, 999999);
    sessionStore.set(req, 'R1', R11);
    sessionStore.set(req, 'R2', R21);
    // background thread in legacy (IsBackground = true)
    // PORT-NOTE: the legacy thread also assigned IsVerified (5/6/7) after the response value was read (race); only the
    // deterministic case (no email and no phone => 7) is applied before responding.
    if (Email === '' && Phoneno === '') IsVerified = 7;
    (async () => {
      try {
        if (Email !== '') {
          await SendMail.Send1('', Email, '', '', 'Verification Code', 'Verification Code:' + R21 + ' Please Use This Verification Code For Update Your Email Id.');
        }
        if (Phoneno !== '') {
          await UtilityClass.SendMsgOnMobile(Phoneno, 'Verification Code:' + R11 + ' Please Use This Verification Code For Update Your Contact No.');
        }
      } catch (e) { console.error(e.message); }
    })();
  }
  return res.json(IsVerified);
}));

// auth
router.all(P + '/UpdateUserDetails{/:id}', auth, asyncHandler(async (req, res) => {
  const { Title, Fname, Lname, Phoneno, Email, Designation, username, DOB, FatherOrMotherName, Gender, HighestQualification, IdType, IdRefNo, PANNO } = req.p;
  const R1 = nz(req.p.R1), R2 = nz(req.p.R2);
  let IsVerified = 0;
  if (req.user == null) return res.json('12');
  if (R1 !== '') {
    if (R1 !== str(sessionStore.get(req, 'R1'))) { IsVerified = 0; return res.json('13'); }
    IsVerified = 1;
  }
  if (R2 !== '') {
    if (R2 !== str(sessionStore.get(req, 'R2'))) { IsVerified = 0; return res.json('14'); }
    IsVerified = 1;
  }
  if (R1 !== '' && R2 !== '' && IsVerified === 1) {
    IsVerified = 1;
  }
  const DID = Number(req.user.did);
  const sp = await db.procOne('shopping', 'usp_editcontactdetailsreseller', {
    did: DID, cpertitle: Title, cperdesignation: Designation, cpermobileno: Phoneno, cperemailid: Email,
    firstname: Fname, lastname: Lname, username, dob: DOB, fatherormothername: FatherOrMotherName, gender: Gender,
    highestqualification: HighestQualification, mode: '2', isverified: IsVerified, idtype: IdType, idrefno: IdRefNo, panno: PANNO,
  });
  const ResValue = str(outv(sp, 'intresult'));
  const rv = parseInt(ResValue, 10);
  if (rv === 1) {
    try {
      const Obj = await db.queryOne('shopping', "Select coalesce(Phone,'') As Phone,EmailID,UserName From TBL_DISTRIBUTOR where DID = @did", { did: DID });
      if (Obj != null && (Obj.emailid !== '' && Obj.emailid != null)) {
        let title = '';
        if (Title === '1') title = 'Mr.';
        else if (Title === '2') title = 'Miss.';
        else if (Title === '3') title = 'Mrs.';
        else if (Title === '4') title = 'M/S.';
        if (rv !== 9 && rv !== 10 && rv !== 11) {
          await SendConfirmationEmail(Obj.emailid, Obj.username, 'Your profile details has been updated.', title, Designation, Phoneno, Email, Fname, Lname, username);
        }
      }
    } catch (Exp) { /* ViewBag.Message */ }
  } else if (rv === 9 || rv === 10 || rv === 11) {
    const R11 = rnd(100000, 555555);
    const R21 = rnd(666666, 999999);
    sessionStore.set(req, 'R1', R11);
    sessionStore.set(req, 'R2', R21);
    (async () => {
      try {
        if (rv === 9 || rv === 11) await SendMail.Send1('', Email, '', '', 'Verification Code', 'Verification Code:' + R21 + ' Please Use This Verification Code For Update Your Email Id.');
        if (rv === 9 || rv === 10) await UtilityClass.SendMsgOnMobile(Phoneno, 'Verification Code:' + R11 + ' Please Use This Verification Code For Update Your Contact No.');
      } catch (e) { console.error(e.message); }
    })();
  }
  return res.json(ResValue);
}));

// auth
router.all(P + '/UpdateimageDetails{/:id}', auth, asyncHandler(async (req, res) => {
  const ImageName = req.p.ImageName;
  if (req.user == null) return res.json('This page has been expired');
  let imgname = '';
  const Plid = Number(req.user.did);
  const SavePaths = appSetting('MemberImagePath');
  if (ImageName.includes('base64,')) {
    const r = await db.queryOne('shopping', 'select imagename from tbl_distributor where did = @did limit 1', { did: Plid });
    if (!r) throw new TypeError('Object reference not set to an instance of an object.');
    const oldimage = str(r.imagename);
    if (oldimage !== '') {
      const f = path.join(mapPath(SavePaths), oldimage);
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    imgname = str(await UtilityClass.ImageUploadMasterMethod(ImageName, SavePaths, SavePaths, UtilityClass.ImageMode.Thumbnail, 'Member_profile'));
  }
  const sp = await db.procOne('shopping', 'usp_editimageprofilereseller', { plid: Plid, imagename: imgname });
  return res.json(str(outv(sp, 'intresult')));
}));

// auth
router.all(P + '/Insert_BankDetail{/:id}', auth, asyncHandler(async (req, res) => {
  const { HolderName, AccountNo, BankName, BranchName, IFSCCode, PanCard, PassBookChequeImage, TypeText, GetThisId } = req.p;
  const Plid = Number(req.user.did);
  const ok = await InsertKYCViaCs(TypeText, PassBookChequeImage, parseInt(req.p.Mode, 10), parseInt(req.p.ID, 10), GetThisId, Plid);
  if (ok !== 'ok') return res.json(ok);
  const cid = await db.queryOne('shopping', 'select cid from tbl_distributor where did = @did limit 1', { did: Plid });
  if (!cid) throw new TypeError('Object reference not set to an instance of an object.');
  const sp = await db.procOne('shopping', 'usp_insertbankdetais', {
    plid: Plid, holdername: HolderName, acountno: AccountNo, bankname: BankName, branchname: BranchName,
    iesccode: IFSCCode, pancard: PanCard,
  });
  const ResValue = parseInt(str(outv(sp, 'intresult')), 10);
  if (ResValue > 0) {
    const Obj = await db.queryOne('shopping', "SELECT coalesce(PHONE,'') AS PHONE,EMAILID,USERNAME FROM PORTAL_LOGIN WHERE PLID = @plid", { plid: Plid });
    await SendConfirmationEmailForBankFetail(Obj.emailid, Obj.username, 'Your bank details has been updated.');
    return res.json(ResValue);
  }
  return res.json(0);
}));

module.exports = router;
