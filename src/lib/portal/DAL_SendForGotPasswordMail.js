/**
 * Exports (static class DAL_SendForGotPasswordMail): async SendMailPortal(string EmailId): int  (1 = mail sent, 0 = not found / error)
 * Portal DataBaseContext = Db_Shopping; entity Portal_Login => table portal_login.
 * PORT-NOTE: SmtpClient(CompanyMailServer) => default port 25, no SSL, credentials CompanyInfoEmailId + the LITERAL string
 *   "CompanySettings.CompanyMailPassword" (legacy bug: the property name was quoted) - reproduced as is.
 * PORT-NOTE: legacy replaces "$$CompanySupportEmailID$$" but the template contains $$CompanySupportEmailId$$ (case differs => left unreplaced) - reproduced.
 */
'use strict';
const nodemailer = require('nodemailer');
const db = require('../../db');
const CompanySettings = require('./CompanySettings');

const rep = (s, k, v) => s.split(k).join(v === null || v === undefined ? '' : String(v));
const pad = (n) => String(n).padStart(2, '0');

async function SendMailPortal(EmailId) {
  let loginid = '';
  const Row = await db.queryOne('shopping', 'select loginid, username, password from portal_login where loginid = @EmailId limit 1', { EmailId });
  if (Row === null) {
    return 0;
  }
  try {
    let username = '';
    let emailidcur = '';
    let password = '';
    const now = new Date();
    const datcur = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
    if (Row !== null) {
      loginid = Row.loginid;
      username = Row.username;
      emailidcur = Row.loginid;
      password = Row.password;
    }
    let myString = `<div>
               <table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>
<tbody><tr><td>
<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>
<img src='https://$$CompanyURL$$/images/anav-exchange-logo.png' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>
<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'></td>
</tr></tbody></table></td>
</tr><tr><td>
<div>
<div class='clear'></div>
<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>
<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px

15px; color: #000'>Dear $$name$$</h1>
<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>Your password for $$CompanyName$$ account is : $$password$$.</strong>
<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>
 Kindly save this email for future references.</p>
<div style='clear: both'></div>
<div style='clear: both'></div>
<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>
If you have any issues regarding your $$CompanyName$$ account, we will be happy to help you.
</p>
<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>You can contact  us on $$CompanySupportEmailId$$</strong>
<div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px'>
<center>
<img src='http://webmail.jewria.com/imp/themes/default/graphics/spacer_red.png' htmlimgblocked='https://$$CompanyURL$$/images/divider.png'></center>
</div>

<div style='clear: both'></div>

<div style='clear: both'></div>
</td>
</tr><tr><td>
<table width='554'><tbody><tr><td>

<p style='font-size: 16px; line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>
Sincerely,
<br>
$$CompanyName$$ Team
</p>
</td>
<td style='width: 265px; text-align: right'>

<div style='margin-right: 7px'>
<font style='margin-right:0px; font-size: 16px; color:#000; font-family:  Arial, Helvetica, sans-serif; float: left; margin-top:2px; font-weight: normal; padding-top:3px'>Follow us on </font>
<a href='https://www.facebook.com/ATCShoppingServices/' style='color:#3b5998; border: none; text-decoration: none' target='8SE_b89lng5GVbx5a7NZME9'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-facebook'></i></a>
<a href='https://twitter.com/ATCShoppingServices' style='color:#55acee; border: none; text-decoration: none' target='e3PP7S0O2rDcb5kT5Qxvkl9'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-twitter'></i></a>
<a href='https://plus.google.com/+ATCShoppingIn' style='color:#dd4b39; border: none; text-decoration: none' target='k_lu77WHdSxxe84MTtrgPlD'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-google-plus'></i></a>
<a href='https://www.linkedin.com/company/ATCShopping' style='color: #0072a4;' border: none; text-decoration: none' target='1QtmtsX-zlkY3NH-RX8bXJB'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-linkedin'></i></a>
<a href='https://pinterest.com/ATCShoppingServices/' style='color:#cb2027; border: none; text-decoration: none' target='FTivBEnhJ2wIlo_i9yYL1Xk'>
<i style='margin:4px 0 0 0; font-size:20px;' class='fa fa-pinterest-p'></i></a>
</div>
</td>
</tr></tbody></table></td>
</tr></tbody></table><div class='clear'></div>
</div>
</td>
</tr></tbody></table>
    </div>`;
    myString = rep(myString, '$$name$$', username);
    myString = rep(myString, '$$date$$', datcur);
    myString = rep(myString, '$$loginid$$', loginid);
    myString = rep(myString, '$$password$$', password);
    myString = rep(myString, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    myString = rep(myString, '$$CompanyURL$$', CompanySettings.CompanyURL);
    myString = rep(myString, '$$CompanyName$$', CompanySettings.CompanyName);
    myString = rep(myString, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
    const transporter = nodemailer.createTransport({
      host: '' + CompanySettings.CompanyMailServer, port: 25, secure: false, ignoreTLS: true,
      auth: { user: '' + CompanySettings.CompanyInfoEmailId, pass: 'CompanySettings.CompanyMailPassword' },
    });
    await transporter.sendMail({
      from: '' + CompanySettings.CompanyInfoEmailId,
      to: emailidcur,
      subject: 'Password Recovery',
      html: myString,
    });
    return 1;
  } catch (e) {
    return 0;
  }
}

module.exports = { SendMailPortal };
