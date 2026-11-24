'use strict';
/** Ported from Franchise\Controllers\CustomerPanel\BillingDetails.cs (BillingDetailsController) */
const express = require('express');
const { queryOne, proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const CompanySettings = require('../../lib/merchant/CompanySettings');
const SendMail = require('../../lib/merchant/SendMail');

const router = express.Router();
const P = '/merchant/BillingDetails';

// auth (null session => RedirectToAction("Index","Home") is handled by the auth middleware)
// route-config: merchant/billing-info
router.all([`${P}/Index{/:id}`, '/merchant/billing-info{/:id}'], auth, asyncHandler(async (req, res) => {
  // legacy server-side logic before the view is commented out; view had no model
  res.json({ view: 'BillingDetails/Index' });
}));

async function SendConfirmationEmailForBillingInfo(ToEmail, Username, Text) {
  try {
    const subject = `${CompanySettings.CompanyName} Support Center`;
    const d = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const z = (n) => String(n).padStart(2, '0');
    const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
    const Date_ = `${days[d.getDay()]} ${months[d.getMonth()]} ${z(d.getDate())} ${d.getFullYear()} ${z(h12)}:${z(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
    let mailtxt = `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>
  <div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>
    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet'>
    <table cellpadding='0' cellspacing='0' style='margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>
      <tbody>
        <tr>
          <td><table style='width:100%;'>
              <tbody>
                <tr>
                  <td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>
                </tr>
              </tbody>
            </table></td>
        </tr>
        <tr>
          <td><div>
              <div class='clear'></div>

              <div style='clear: both'></div>
              <div style='clear: both'></div>
              <table style='padding-bottom: 10px; width: 100%; '>
                <tbody>
                  <tr>
                    <td></td>
                  </tr>
                  <tr>
                    <td align='center'><strong style='font-size: 20px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Your Billing Address updated
                      <p></p>
                      </strong>
                      <div style='text-align:left;'>
                        <h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Hello $$lblname$$, </h1>
                        <p style='font-size: 14px; font-weight: normal; margin: 10px 0px 0px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; text-align:left; color: #000'>Thanks for updating your Billing Address updated on $$CompanyURL$$. </p>
                        <p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 10px; font-family: Arial, Helvetica, sans-serif; text-align:left; color: #000'>Your billing details has been updated successfully according to your provided details. </p>
                      </div>
                      <div style='clear: both'></div>
                      <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>
                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>
                          <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> If you have any issues,
            we will be happy to help you. You can contact us on <a href = 'mailto:$$SupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$SupportEmailId$$ </a></p>

                                     </div>

                                           </td>

                                       </tr>

                                       <tr>

                                         <td><table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>

                                        <tbody>

                                          <tr>

                                          <td>

                                              <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>

                                                 <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$$CompanyName$$ Team</h5>

                                                </td>

                                                  <td>

                                                  <div style = 'margin-right: 7px; text-align:right'>

                                                   <a href = 'javascript:void(0)' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

                                                              <a href = 'javascript:void(0)' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

                                                                         <a href = 'javascript:void(0)' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

                                                                                    <a href = 'javascript:void(0)' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

                                                                                                <a href = 'javascript:void(0)' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>

                                                                                                           </div></td>

                                                                                                        </tr>

                                                                                                      </tbody>

                                                                                                    </table></td>

                                                                                                        </tr>

                                                                                                      </tbody>

                                                                                                    </table>

                                                                                                    <div class='clear'></div>
            </div></td>
        </tr>
      </tbody>
    </table>
  </div>
  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>
</div>`;
    const rep = (k, v) => { mailtxt = mailtxt.split(k).join(v == null ? '' : v); };
    rep('$$lblname$$', Username);
    rep('$$datetime$$', Date_);
    rep('$$lblmessage$$', Text);
    rep('$$CompanyDomain$$', CompanySettings.CompanyDomain);
    rep('$$CompanyURL$$', CompanySettings.CompanyURL);
    rep('$$SupportEmailId$$', CompanySettings.CompanySupportEmailId);
    rep('$$CompanyName$$', CompanySettings.CompanyName);
    await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
  } catch (Exp) {
    console.error(Exp); // ViewBag.Message = Exp.Message
  }
}

// auth
router.all(`${P}/insertbilling{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const Plid = req.user.plid;
  let ResValue = 0;
  const cid = await queryOne('shopping', 'select cid from portal_login where plid=@plid limit 1', { plid: Plid });
  const CID = parseInt(cid.cid, 10); // NullReference in C# when no row (propagates as error)
  const rows = await proc('shopping', 'USP_CREATEBILLING', {
    businessname: p.bussinessname, slid: Plid, contactname: p.contactname, phonenumber: p.txtphonenumber, address: p.address,
    city: p.city, postalcode: p.txtpostalcode, state: p.state, country: CID,
  });
  ResValue = parseInt((rows[0] || {}).intresult, 10);
  if (ResValue > 0) {
    const Obj = await queryOne('shopping', "Select coalesce(Phone,'') As Phone,EmailID,UserName From Portal_Login where plid = @plid", { plid: Plid });
    await SendConfirmationEmailForBillingInfo(Obj.emailid, Obj.username, 'Your billing details has been updated.');
    return res.json(ResValue);
  }
  res.json(0);
}));

module.exports = router;
