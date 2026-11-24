'use strict';
/**
 * Exports (static, async): SendRegConfirmMail(double Pltid, string ToEmail, string username, string Loginpassword, string TransaactionPassword = "",
 *   string AutoUserName = "", string FromEmail = "", string SenderId = "", string SenderName = "", string password = ""): void;
 *   EncryptFunction(string number): string; AddNewListingMail(string ToEmailId = "", string UserName = ""): void;
 *   UpdateListingMail(string ToEmailId = "", string UserName = ""): void
 * PORT-NOTE: AddNewListingMail/UpdateListingMail hard-coded the SMTP credentials of info@bfxmining.com; the password is now read from
 * config.app.BfxMailPassword (falls back to config.app.CompanyMailPassword). Add BFX_MAIL_PASSWORD to config/.env.example.
 */
const nodemailer = require('nodemailer');
const db = require('../db');
const CustomEncriptionAndDecription = require('./CustomEncriptionAndDecription');
const config = require('../config');
const { replaceAll, errorInsert } = require('./_libhelpers');

function pad(n) { return String(n).padStart(2, '0'); }

const TPL_REG_CONFIRM = `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>
  <div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>
    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
    <table cellpadding='0' cellspacing='0' style='width: 100%'>
      <tbody>
        <tr>
          <td><table style='width:100%;'>
              <tbody>
                <tr style='background: #000;'>
               <td colspan='2' align='center'><img src=$$URLImg$$/></td>

                </tr>
              </tbody>
            </table></td>
        </tr>
        <tr>
          <td><div>
              <div class='clear'></div>
              <table style='padding-bottom: 10px;   width: 100%; '>
                <tbody>
                  <tr>
                    <td align='center'><h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px

15px; color: #000'></h1>
                      <strong style='font-size: 20px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000; padding-top:'>Verify your email address</strong>
                      <p style='font-size: 14px; font-weight: normal; margin:20px 0px 20px 0px; color: #000'>$$Content$$ </p>
                      <table border='0' width='100%' height='36px' style='background: #00a0a8; margin: 30px 0 20px; font-weight:bold;'>
                        <tbody>
                          <tr>

                            <td align='center' style='padding: 2px 2px'><a href=$$LinkUrl$$>Verify my email</a></td>
                          </tr>
                        </tbody>
                      </table>
                      <div style='clear: both'></div>
                      <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>
                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>
                          <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> If you have any issues,
            we will be happy to help you. You can contact us on <a style = 'color:#00a0a8;'>$$CompanyEmailId$$</a></p>
                                     </div>

                                           </td>

                                       </tr>

                                       <tr>

                                         <td>

                                         <table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>

                                      <tbody>

                                        <tr>

                                        <td>

                                            <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>

                                               <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$ReplaceWithCompanyName$$ Team</h5>

                                              </td>

                                                <td>

                                                <div style = 'margin-right: 7px; text-align:right'>

                                                                                                         </div></td>

                                                                                                      </tr>

                                                                                                    </tbody>

                                                                                                  </table>

                                                                                                          </td>

                                                                                                      </tr>

                                                                                                    </tbody>

                                                                                                  </table>

                                                                                                  <div class='clear'></div>
            </div></td>
        </tr>
      </tbody>
    </table>
  </div>
  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>$$CompanyTitle$$</p>
</div>`;
const TPL_ADD_LISTING = `<div>
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

15px; color: #000'>Hello $$user$$,</h1>
<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>Thanks for updating your profile on bfxmining.com.
</strong>
<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>
We have successfully changed the information as per your action. You can access your Crypto Inbox account in order see the changes.
</p>
<div style='clear: both'></div>
<div style='clear: both'></div>
<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>
If you have any issues, we will be happy to help you.
</p>
<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>You can contact  us on $$CompanyEmailId$$</strong>
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
const TPL_UPDATE_LISTING = `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>
  <div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>
    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
    <table cellpadding='0' cellspacing='0' style='margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>
        <tbody>

      <tr>
        <td>
        <table style='width:100%;'>
            <tbody>
              <tr>
                <td width='100%' align='center'><a href='https://bfxmining.com/' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://bfxmining.com/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>
              </tr>
            </tbody>
          </table></td>
      </tr>
        <tr>

        <td>

      <div>
        <div class='clear'></div>
        <table style='padding-bottom: 10px; width: 100%;'>
          <tbody>
            <tr>
              <td>
            <tr>
              <td align='center'><strong style='font-size: 20px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Your Profile Updated Successfully
                </p>
                </strong>
                <div style='text-align:left;'>
                  <h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Hello $$user$$, </h1>
                  <p style='font-size: 14px; font-weight: normal; margin: 10px 0px 0px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; text-align:left; color: #000'>Thanks for updating your profile on bfxmining.com. We have successfully changed the information as per your action.</p>
                  <p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 10px; font-family: Arial, Helvetica, sans-serif; text-align:left; color: #000'>You can access your Crypto Inbox account in order see the changes.</p>
                </div>
                <div style='clear: both'></div>

                <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>
                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>
                          <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> If you have any issues,
            we will be happy to help you. You can contact us on <a href = 'mailto:support@bfxmining.com' target = '_blank' style = 'color:#00a0a8;'> $$CompanyEmailId$$ </a></p>

                                     </div>
                                     </td>
                                 </tr>
                               <div style = 'clear: both'></div>

                                <div style = 'clear: both'></div>
                                   </td>
                                   </tr>
                                 <tr>

                                   <td><table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'><tbody><tr><td>
                          <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>
                          <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The Crypto Inbox Team</h5></td><td>

                                 <div style = 'margin-right: 7px; text-align:right'><a href = 'https://www.facebook.com/CryptoInbox/' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://bfxmining.com/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>
                                 <a href = 'https://twitter.com/CryptoInbox' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://bfxmining.com/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>
                                 <a href = 'https://plus.google.com/+Crypto InboxIn' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://bfxmining.com/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>
                                 <a href = 'https://www.linkedin.com/company/Crypto Inbox' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://bfxmining.com/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>
                                 <a href = 'https://pinterest.com/CryptoInbox/' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://bfxmining.com/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a></div></td></tr></tbody></table></td></tr></tbody></table>
                                 <div class='clear'></div></div></td></tr></tbody></table></div>
  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2018-2019 All Rights Reserved | bfxmining.com</p>`;

function EncryptFunction(number) {
  const p = new CustomEncriptionAndDecription();
  return p.encryption(number);
}

async function SendRegConfirmMail(Pltid, ToEmail, username, Loginpassword, TransaactionPassword = '', AutoUserName = '', FromEmail = '', SenderId = '', SenderName = '', password = '') {
  try {
    const EmailAcctount = await db.queryOne('affiliate', 'select emailid, hostname, password, smtpport, sendername, senderemail from tbl_emailaccount where eaid = 1 limit 1');
    if (EmailAcctount === null) throw new TypeError('Object reference not set to an instance of an object.');
    FromEmail = EmailAcctount.emailid;
    password = EmailAcctount.password;
    const HostName = EmailAcctount.hostname;
    const usernameemail = EmailAcctount.emailid;
    password = EmailAcctount.password;
    const Portnumber = parseInt(String(EmailAcctount.smtpport), 10);

    const SoftUrl = await db.queryOne('affiliate', 'select software_url, name from tbl_companymaster where comid = 1 limit 1');
    if (SoftUrl === null) throw new TypeError('Object reference not set to an instance of an object.');
    const SoftwareUrl = SoftUrl.software_url;
    const CompanyName = SoftUrl.name;
    if (!ToEmail) throw new Error('The parameter \'to\' cannot be an empty string.'); // new MailMessage(from, to) validation
    if (SenderName === '' || SenderId === '') {
      SenderName = EmailAcctount.sendername;
      SenderId = EmailAcctount.senderemail;
    }
    const curdate = pad(new Date().getDate()) + '-' + pad(new Date().getMonth() + 1) + '-' + new Date().getFullYear();

    let MyString = '';
    const CompanyEmailId = EmailAcctount.emailid;
    const ReplaceWithCompanyName = CompanyName;
    const Content = 'Thanks for signing up in ' + CompanyName + '. As per your valuable details you need to verify your email address by using link below. This is an one time verification, Follow the link below to confirm your account.';
    const LinkUrl = '' + SoftwareUrl + 'Regisrtration-Confirmation?emailid=$$lblemailid$$&vmid=$$lblvmid$$&password=$$Password$$&TransPassword=$$TransaactionPassword$$&AutoUserName=$$AutoUserName$$&username=$$Username$$\' style=\' text-align:center; width:100%; font-size: 14px; text-decoration: none; font-family: Arial, Helvetica, sans-serif; color: #fff\' target=\'K-P_EYTewa3lJ5WgwetbbkY\'';
    const URLImg = ' \'' + SoftwareUrl + '/images/logo-website.png\' height=\'45\' border=\'0\' style=\'margin-top:15px; margin-left:10px; margin-bottom:10px;\'';
    const CompanyTitle = '\u00A9 2018-2019 All Rights Reserved |' + CompanyName + '';
    MyString = TPL_REG_CONFIRM;

    MyString = replaceAll(MyString, '$$CompanyEmailId$$', CompanyEmailId);
    MyString = replaceAll(MyString, '$$Content$$', Content);
    MyString = replaceAll(MyString, '$$LinkUrl$$', LinkUrl);
    MyString = replaceAll(MyString, '$$URLImg$$', URLImg);
    MyString = replaceAll(MyString, '$$CompanyTitle$$', CompanyTitle);
    MyString = replaceAll(MyString, '$$ReplaceWithCompanyName$$', ReplaceWithCompanyName);
    MyString = replaceAll(MyString, '$$date$$', curdate);
    MyString = replaceAll(MyString, '$$name$$', username);
    MyString = replaceAll(MyString, '$$Username$$', username);
    MyString = replaceAll(MyString, '$$Password$$', Loginpassword);
    MyString = replaceAll(MyString, '$$lblPassword$$', password);
    MyString = replaceAll(MyString, '$$TransaactionPassword$$', TransaactionPassword);
    MyString = replaceAll(MyString, '$$AutoUserName$$', AutoUserName);
    MyString = replaceAll(MyString, '$$lblloginid$$', EmailAcctount.emailid);
    MyString = replaceAll(MyString, '$$lblemailid$$', ToEmail);
    const encryt = EncryptFunction(String(Pltid));
    MyString = replaceAll(MyString, '$$lblvmid$$', encryt.toString());
    const subject = 'Activate your ' + CompanyName + ' account by verifying the link & start using ' + CompanyName + ' service.';
    // legacy: mm.From = FromEmail (SenderId/SenderName only used for a discarded MailAddress), recipients: ToEmail
    const transporter = nodemailer.createTransport({
      host: HostName,
      port: Portnumber,
      secure: false,
      auth: { user: usernameemail, pass: password },
    });
    await transporter.sendMail({ from: FromEmail, to: ToEmail, subject, html: MyString });
  } catch (ExpObj) {
    await errorInsert('SendRegConfirmMail', 'DAL/SendRegisrtaionConfirmationMail', ExpObj);
  }
}

function bfxTransport() {
  return nodemailer.createTransport({
    host: 'webmail.bfxmining.com',
    port: 25,
    secure: false,
    auth: { user: 'info@bfxmining.com', pass: config.app.BfxMailPassword || config.app.CompanyMailPassword || '' },
  });
}

async function AddNewListingMail(ToEmailId = '', UserName = '') {
  try {
    let myString = TPL_ADD_LISTING;
    myString = replaceAll(myString, '$$user$$', UserName);
    await bfxTransport().sendMail({ from: 'info@bfxmining.com', to: ToEmailId, subject: 'New Business Listing', html: myString });
  } catch (ExpObj) {
    await errorInsert('AddNewListingMail', 'DAL/SendRegisrtaionConfirmationMail', ExpObj);
  }
}

async function UpdateListingMail(ToEmailId = '', UserName = '') {
  try {
    let myString = TPL_UPDATE_LISTING;
    myString = replaceAll(myString, '$$user$$', UserName);
    await bfxTransport().sendMail({ from: 'info@bfxmining.com', to: ToEmailId, subject: 'Update Business Listing', html: myString });
  } catch (ExpObj) {
    await errorInsert('UpdateListingMail', 'DAL/SendRegisrtaionConfirmationMail', ExpObj);
  }
}

module.exports = { SendRegConfirmMail, EncryptFunction, AddNewListingMail, UpdateListingMail };
