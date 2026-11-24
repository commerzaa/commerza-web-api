'use strict';
/**
 * Exports: SendMailPortal(string EmailId): int   (static, async)
 * PORT-NOTE: the legacy code hard-coded the SMTP credentials of info@bfxmining.com; the password is now read from
 * config.app.BfxMailPassword (falls back to config.app.CompanyMailPassword). Add BFX_MAIL_PASSWORD to config/.env.example.
 * The legacy SmtpClient("webmail.bfxmining.com") used the default port 25 without SSL.
 */
const nodemailer = require('nodemailer');
const db = require('../db');
const config = require('../config');
const { replaceAll } = require('./_libhelpers');

function pad(n) { return String(n).padStart(2, '0'); }

async function SendMailPortal(EmailId) {
  let loginid = '';
  const Row = await db.queryOne('affiliate', 'select loginid, username, password from portal_login where loginid = @EmailId limit 1', { EmailId });
  if (Row === null) {
    return 0;
  }
  try {
    let username = '', emailidcur = '', password = '';
    const now = new Date();
    const datcur = pad(now.getDate()) + '-' + pad(now.getMonth() + 1) + '-' + now.getFullYear();
    loginid = Row.loginid;
    username = Row.username;
    emailidcur = Row.loginid;
    password = Row.password;
    let myString = '';
    myString = `<div>
               <table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>
<tbody><tr><td>
<table width='585'><tbody><tr><td style='width: 350px'><a href='https://bfxmining.com/' target='UlOxf6W290vd9HCE04UigQH'>
<img src='https://bfxmining.com/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>
<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'></td>
</tr></tbody></table></td>
</tr><tr><td>
<div>
<div class='clear'></div>
<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>
<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px

15px; color: #000'>Dear $$name$$</h1>
<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>Your password for Crypto Inbox account is : $$password$$.</strong>
<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>
 Kindly save this email for future references.</p>
<div style='clear: both'></div>
<div style='clear: both'></div>
<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>
If you have any issues regarding your Crypto Inbox account, we will be happy to help you.
</p>
<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>You can contact  us on support@bfxmining.com</strong>
<div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px'>
<center>
<img src='https://webmail.bfxmining.com/imp/themes/default/graphics/spacer_red.png' htmlimgblocked='https://bfxmining.com/images/divider.png'></center>
</div>

<div style='clear: both'></div>

<div style='clear: both'></div>
</td>
</tr><tr><td>
<table width='554'><tbody><tr><td>

<p style='font-size: 16px; line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>
Sincerely,
<br>
Crypto Inbox Team
</p>
</td>
<td style='width: 265px; text-align: right'>

<div style='margin-right: 7px'>
<font style='margin-right:0px; font-size: 16px; color:#000; font-family:  Arial, Helvetica, sans-serif; float: left; margin-top:2px; font-weight: normal; padding-top:3px'>Follow us on </font>
<a href='https://www.facebook.com/CryptoInbox/' style='color:#3b5998; border: none; text-decoration: none' target='8SE_b89lng5GVbx5a7NZME9'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-facebook'></i></a>
<a href='https://twitter.com/CryptoInbox' style='color:#55acee; border: none; text-decoration: none' target='e3PP7S0O2rDcb5kT5Qxvkl9'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-twitter'></i></a>
<a href='https://plus.google.com/+Crypto InboxIn' style='color:#dd4b39; border: none; text-decoration: none' target='k_lu77WHdSxxe84MTtrgPlD'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-google-plus'></i></a>
<a href='https://www.linkedin.com/company/Crypto Inbox' style='color: #0072a4;' border: none; text-decoration: none' target='1QtmtsX-zlkY3NH-RX8bXJB'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-linkedin'></i></a>
<a href='https://pinterest.com/CryptoInbox/' style='color:#cb2027; border: none; text-decoration: none' target='FTivBEnhJ2wIlo_i9yYL1Xk'>
<i style='margin:4px 0 0 0; font-size:20px;' class='fa fa-pinterest-p'></i></a>
</div>
</td>
</tr></tbody></table></td>
</tr></tbody></table><div class='clear'></div>
</div>
</td>
</tr></tbody></table>
    </div>`;

    myString = replaceAll(myString, '$$name$$', username);
    myString = replaceAll(myString, '$$date$$', datcur);
    myString = replaceAll(myString, '$$loginid$$', loginid);
    myString = replaceAll(myString, '$$password$$', password);
    const transporter = nodemailer.createTransport({
      host: 'webmail.bfxmining.com',
      port: 25,
      secure: false,
      auth: { user: 'info@bfxmining.com', pass: config.app.BfxMailPassword || config.app.CompanyMailPassword || '' },
    });
    await transporter.sendMail({ from: 'info@bfxmining.com', to: emailidcur, subject: 'Password Recovery', html: myString });
    return 1;
  } catch (ExpObj) {
    return 0;
  }
}

module.exports = { SendMailPortal };
