// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/BillingDetails.cs (class BillingDetailsController; DB: Db_Shopping)
// Started from src/modules/merchant/billing-details.js; portal differences: mail placeholder $$CompanySupportEmailId$$, MailMessage(NoReplyMail, ToEmail).
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const c = require('./_shared/batch-05-common');
const b = require('./_shared/batch-23-common');
const { checkMailAddress } = require('./_shared/batch-14-common');
const CompanySettingsMod = require('../../lib/portal/CompanySettings');
const SendMail = require('../../lib/portal/SendMail');

const CompanySettings = CompanySettingsMod.CompanySettings || CompanySettingsMod;
const router = express.Router();
const DB = 'shopping';
const P = '/portal/BillingDetails';

// auth (legacy: Session["Plid"] == null => RedirectToAction("Index","Home"); the model lookup is commented out)
// route-config: merchant/billing-info -> BillingDetails/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/billing-info'], ps.customerAuth, asyncHandler(async (req, res) => {
  return c.viewJson(res, '~/Views/CustomerPanel/BillingDetails/Index.cshtml', undefined, {});
}));

const MAIL_TEMPLATE = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>\r\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>\r\n    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet'>\r\n    <table cellpadding='0' cellspacing='0' style='margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>\r\n      <tbody>\r\n        <tr>\r\n          <td><table style='width:100%;'>\r\n              <tbody>\r\n                <tr>\r\n                  <td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/anav-exchange-logo.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\r\n                </tr>\r\n              </tbody>\r\n            </table></td>\r\n        </tr>\r\n        <tr>\r\n          <td><div>\r\n              <div class='clear'></div>\r\n              \r\n              <div style='clear: both'></div>\r\n              <div style='clear: both'></div>\r\n              <table style='padding-bottom: 10px; width: 100%; '>\r\n                <tbody>\r\n                  <tr>\r\n                    <td></td>\r\n                  </tr>\r\n                  <tr>\r\n                    <td align='center'><strong style='font-size: 20px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Your Billing Address updated\r\n                      <p></p>\r\n                      </strong>\r\n                      <div style='text-align:left;'>\r\n                        <h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Hello $$lblname$$, </h1>\r\n                        <p style='font-size: 14px; font-weight: normal; margin: 10px 0px 0px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; text-align:left; color: #000'>Thanks for updating your Billing Address updated on $$CompanyURL$$. </p>\r\n                        <p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 10px; font-family: Arial, Helvetica, sans-serif; text-align:left; color: #000'>Your billing details has been updated successfully according to your provided details. </p>\r\n                      </div>\r\n                      <div style='clear: both'></div>\r\n                      <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\r\n                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>\r\n                          <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> If you have any issues,\r\n            we will be happy to help you. You can contact us on <a href = 'mailto:$$CompanySupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$CompanySupportEmailId$$ </a></p>\r\n                     \r\n                                     </div>\r\n                     \r\n\r\n                                           </td>\r\n                     \r\n                                       </tr>\r\n                     \r\n                                       <tr>\r\n                     \r\n                                         <td><table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>\r\n                        \r\n                                        <tbody>\r\n                        \r\n                                          <tr>\r\n                        \r\n                                          <td>\r\n                        \r\n\r\n                                              <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>\r\n                         \r\n                                                 <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5>\r\n                              \r\n\r\n                                                </td>\r\n                              \r\n                                                  <td>\r\n                              \r\n                                                  <div style = 'margin-right: 7px; text-align:right'>\r\n                               \r\n                                                   <a href = 'https://www.facebook.com/ATCShoppingServices/' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\r\n                                          \r\n                                                              <a href = 'https://twitter.com/ATCShoppingServices' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\r\n                                                     \r\n                                                                         <a href = 'https://plus.google.com/+ATCShoppingIn' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\r\n                                                                \r\n                                                                                    <a href = 'https://www.linkedin.com/company/ATCShopping' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\r\n                                                                           \r\n                                                                                                <a href = 'https://pinterest.com/ATCShoppingServices/' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>\r\n                                                                                      \r\n\r\n                                                                                                           </div></td>\r\n                                                                                      \r\n                                                                                                        </tr>\r\n                                                                                      \r\n                                                                                                      </tbody>\r\n                                                                                      \r\n                                                                                                    </table></td>\r\n                                                                                      \r\n                                                                                                        </tr>\r\n                                                                                      \r\n                                                                                                      </tbody>\r\n                                                                                      \r\n                                                                                                    </table>\r\n                                                                                      \r\n                                                                                                    <div class='clear'></div>\r\n            </div></td>\r\n        </tr>\r\n      </tbody>\r\n    </table>\r\n  </div>\r\n  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>\r\n</div>";

/** DateTime.Now.ToString("dddd MMMM dd yyyy hh:mm tt") */
function longDate(d = new Date()) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const z = (n) => String(n).padStart(2, '0');
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${z(d.getDate())} ${d.getFullYear()} ${z(h12)}:${z(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** protected void SendConfirmationEmailForBillingInfo(string ToEmail, string Username, string Text) */
async function SendConfirmationEmailForBillingInfo(ToEmail, Username, Text) {
  const ViewBag = {};
  try {
    const subject = '' + c.str(CompanySettings.CompanyName) + ' Support Center';
    let mailtxt = '';
    const Date_ = longDate(new Date());
    // MailMessage mm = new MailMessage(NoReplyMail, ToEmail) - validates both addresses (throws into the catch below)
    checkMailAddress('' + c.str(CompanySettings.NoReplyMail) + '', 'from');
    checkMailAddress(ToEmail, 'to');
    mailtxt = MAIL_TEMPLATE;
    const rep = (k, v) => { mailtxt = c.csReplace(mailtxt, k, v); };
    rep('$$lblname$$', Username);
    rep('$$datetime$$', Date_);
    rep('$$lblmessage$$', Text);
    rep('$$CompanyName$$', CompanySettings.CompanyName);
    rep('$$CompanyURL$$', CompanySettings.CompanyURL);
    rep('$$CompanyDomain$$', CompanySettings.CompanyDomain);
    rep('$$CompanySupportEmailId$$', CompanySettings.CompanySupportEmailId);
    await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
  } catch (Exp) {
    ViewBag.Message = Exp.message;
    console.error(Exp);
  }
}

// auth (legacy cast (Login)Session["Plid"] without a null check => NullReferenceException)
router.all(`${P}/insertbilling{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const s = (n) => b.mvcStr(req, n);
  const bussinessname = s('bussinessname'); const contactname = s('contactname'); const txtphonenumber = s('txtphonenumber');
  const address = s('address'); const city = s('city'); const txtpostalcode = s('txtpostalcode'); const state = s('state');
  let ResValue = 0;
  const Plid = Number(req.user.plid);
  // db._Portal_Login.Where(i => i.PLID == Plid).Select(i => new { CID = i.CID }).FirstOrDefault()
  const cid = await db.queryOne(DB, 'select cid from portal_login where plid = @plid limit 1', { plid: Plid });
  if (!cid) throw c.NRE();
  const CID = c.toInt32(cid.cid);
  const row = await db.procOne(DB, 'usp_createbilling', {
    businessname: bussinessname, slid: Plid, contactname, phonenumber: txtphonenumber, address, city, postalcode: txtpostalcode, state, country: CID,
  });
  // @INTRESULT OUT (varchar): Convert.ToInt32(spOutput.Value.ToString())
  const k = row ? Object.keys(row).find((x) => x.toLowerCase() === 'intresult') : undefined;
  ResValue = b.strictInt32(k === undefined || row[k] === null ? '' : String(row[k]));

  if (ResValue > 0) {
    const r = await db.queryOne(DB, "select coalesce(phone, '') as phone, emailid, username from portal_login where plid = @plid", { plid: String(Plid) });
    if (!r) throw c.NRE();
    const Obj = { Phone: r.phone, EmailID: r.emailid, UserName: r.username, Password: null };
    await SendConfirmationEmailForBillingInfo(Obj.EmailID, Obj.UserName, 'Your billing details has been updated.');
    return res.json(ResValue);
  }
  return res.json(0);
}));

module.exports = router;
