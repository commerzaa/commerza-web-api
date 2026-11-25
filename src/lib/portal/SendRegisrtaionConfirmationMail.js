/**
 * Exports (static class SendRegisrtaionConfirmationMail):
 *   async SendRegConfirmMail(double Pltid, string email, string username, string password): void;
 *   EncryptFunction(string number): string;
 *   async AddNewListingMail(string ToEmailId = "", string UserName = ""): void;
 *   async UpdateListingMail(string ToEmailId = "", string UserName = ""): void
 * Ported from ClusterofferShopingPortal DAL/SendRegisrtaionConfirmationMail.cs (differs from every other app's version: templates, sender, SMTP).
 * PORT-NOTE: SmtpClient(CompanyMailServer) => default port 25, no SSL; credentials CompanyInfoEmailId / CompanyMailPassword; From = CompanyInfoEmailId.
 *   All mail errors are swallowed (legacy empty catch). The opened DataBaseContext was never used (no DB access).
 * Legacy replaces "$$CompanySupportEmailID$$" (case-sensitive) - reproduced as is.
 */
'use strict';
const nodemailer = require('nodemailer');
const CompanySettings = require('./CompanySettings');
const CustomEncriptionAndDecription = require('./CustomEncriptionAndDecription');

const rep = (s, k, v) => s.split(k).join(v === null || v === undefined ? '' : String(v));
const pad = (n) => String(n).padStart(2, '0');

async function send(to, subject, html) {
  const transporter = nodemailer.createTransport({
    host: '' + CompanySettings.CompanyMailServer, port: 25, secure: false, ignoreTLS: true,
    auth: { user: '' + CompanySettings.CompanyInfoEmailId, pass: '' + CompanySettings.CompanyMailPassword },
  });
  await transporter.sendMail({ from: '' + CompanySettings.CompanyInfoEmailId, to, subject, html });
}

async function SendRegConfirmMail(Pltid, email, username, password) {
  try {
    const now = new Date();
    const curdate = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
    let MyString = `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>
  <div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>
    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
    <table cellpadding='0' cellspacing='0' style='width: 100%'>
      <tbody>
        <tr>
          <td><table style='width:100%;'>
              <tbody>
                <tr>
                  <td colspan='2' align='center'><img src='http://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:10px;'></td>
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
                      <p style='font-size: 14px; font-weight: normal; margin:20px 0px 20px 0px; color: #000'> Thanks for signing up in $$CompanyName$$. As per your valuable details you need to verify your email address by using link below. This is an one time verification, Follow the link below to confirm your account.</p>
                      <table border='0' width='100%' height='36px' style='background: #00a0a8; margin: 30px 0 20px; font-weight:bold;'>
                        <tbody>
                          <tr>
                            <td align='center' style='padding: 2px 2px'><a href='http://$$CompanyURL$$/Regisrtration-Confirmation?emailid=$$lblemailid$$&vmid=$$lblvmid$$' style=' text-align:center; width:100%; font-size: 14px; text-decoration: none; font-family: Arial, Helvetica, sans-serif; color: #fff' target='K-P_EYTewa3lJ5WgwetbbkY'>Verify my email</a></td>
                          </tr>
                        </tbody>
                      </table>
                       <p style='font-size: 14px; font-weight: normal; margin:20px 0px 20px 0px; color: #000'> After verify your account you can use following service like Business listing, Deal listing and Promotion, Bulk SMS, Bulk Email, Online Earning System through View and Share and by posting Blog and Short note. $$CompanyName$$ provide you Extensive range free services also the paid services are adequately placed giving customers flexible packages to choose from. Our priority is to make detailed information available for the customers.</p>
                      <div style='clear: both'></div>
                      <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>
                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>
                          <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> If you have any issues,
            we will be happy to help you. You can contact us on <a style = 'color:#00a0a8;'> $$CompanySupportEmailId$$ </a></p>
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
                       
                                               <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5>
                            

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
  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>
</div>`;
    MyString = rep(MyString, '$$date$$', curdate);
    MyString = rep(MyString, '$$name$$', username);
    MyString = rep(MyString, '$$lblPassword$$', password);
    MyString = rep(MyString, '$$lblloginid$$', email);
    MyString = rep(MyString, '$$lblemailid$$', email);
    const encryt = EncryptFunction(String(Pltid));
    MyString = rep(MyString, '$$lblvmid$$', String(encryt));
    MyString = rep(MyString, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    MyString = rep(MyString, '$$CompanyURL$$', CompanySettings.CompanyURL);
    MyString = rep(MyString, '$$CompanyName$$', CompanySettings.CompanyName);
    MyString = rep(MyString, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
    const subject = 'Activate your ' + CompanySettings.CompanyName + ' account by verifying the link & start using ' + CompanySettings.CompanyName + ' service.';
    await send(email, subject, MyString);
  } catch (e) {
    // legacy: empty catch
  }
}

function EncryptFunction(number) {
  const p = new CustomEncriptionAndDecription();
  return p.encryption(number);
}

async function AddNewListingMail(ToEmailId = '', UserName = '') {
  try {
    let myString = `<div>
               <table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>
<tbody><tr><td>
<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>
<img src='http://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>
<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'></td>
</tr></tbody></table></td>
</tr><tr><td>
<div>
<div class='clear'></div>

<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>
<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px

15px; color: #000'>Hello $$user$$,</h1>
<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>Thanks for updating your profile on $$CompanyURL$$.
</strong>
<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>
We have successfully changed the information as per your action. You can access your $$CompanyName$$ account in order see the changes.
</p>
<div style='clear: both'></div>
<div style='clear: both'></div>
<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>
If you have any issues, we will be happy to help you.
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

//<div style='margin-right: 7px'>
//<font style='margin-right:0px; font-size: 16px; color:#000; font-family:  Arial, Helvetica, sans-serif; float: left; margin-top:2px; font-weight: normal; padding-top:3px'>Follow us on </font>
//<a href='https://www.facebook.com/atcshoppingServices/' style='color:#3b5998; border: none; text-decoration: none' target='8SE_b89lng5GVbx5a7NZME9'>
//<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-facebook'></i></a>
//<a href='https://twitter.com/atcshoppingServices' style='color:#55acee; border: none; text-decoration: none' target='e3PP7S0O2rDcb5kT5Qxvkl9'>
//<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-twitter'></i></a>
//<a href='https://plus.google.com/+atcshopping' style='color:#dd4b39; border: none; text-decoration: none' target='k_lu77WHdSxxe84MTtrgPlD'>
//<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-google-plus'></i></a>
//<a href='https://www.linkedin.com/company/atcshopping' style='color: #0072a4;' border: none; text-decoration: none' target='1QtmtsX-zlkY3NH-RX8bXJB'>
//<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-linkedin'></i></a>
//<a href='https://pinterest.com/atcshopping/' style='color:#cb2027; border: none; text-decoration: none' target='FTivBEnhJ2wIlo_i9yYL1Xk'>
//<i style='margin:4px 0 0 0; font-size:20px;' class='fa fa-pinterest-p'></i></a>
//</div>
</td>
</tr></tbody></table></td>
</tr></tbody></table><div class='clear'></div>
</div>
</td>
</tr></tbody></table>
    </div>`;
    myString = rep(myString, '$$user$$', UserName);
    myString = rep(myString, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    myString = rep(myString, '$$CompanyURL$$', CompanySettings.CompanyURL);
    myString = rep(myString, '$$CompanyName$$', CompanySettings.CompanyName);
    myString = rep(myString, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
    await send(ToEmailId, 'New Business Listing', myString);
  } catch (e) {
    // legacy: empty catch
  }
}

async function UpdateListingMail(ToEmailId = '', UserName = '') {
  try {
    let myString = `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>
  <div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>
    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
    <table cellpadding='0' cellspacing='0' style='margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>
        <tbody>
      
      <tr>
        <td>
        <table style='width:100%;'>
            <tbody>
              <tr>
                <td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/anav-exchange-logo.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>
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
                  <p style='font-size: 14px; font-weight: normal; margin: 10px 0px 0px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; text-align:left; color: #000'>Thanks for updating your profile on $$CompanyURL$$. We have successfully changed the information as per your action.</p>
                  <p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 10px; font-family: Arial, Helvetica, sans-serif; text-align:left; color: #000'>You can access your $$CompanyName$$ account in order see the changes.</p>
                </div>
                <div style='clear: both'></div>
                
                <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>
                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>
                          <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> If you have any issues,
            we will be happy to help you. You can contact us on <a href = 'mailto:$$CompanySupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$CompanySupportEmailId$$ </a></p>
                     
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
                          <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5></td><td>
                                
                                 <div style = 'margin-right: 7px; text-align:right'><a href = 'https://www.facebook.com/ATCShoppingServices/' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>
                                 <a href = 'https://twitter.com/ATCShoppingServices' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>
                                 <a href = 'https://plus.google.com/+ATCShoppingIn' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>
                                 <a href = 'https://www.linkedin.com/company/ATCShopping' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>
                                 <a href = 'https://pinterest.com/ATCShoppingServices/' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a></div></td></tr></tbody></table></td></tr></tbody></table>
                                 <div class='clear'></div></div></td></tr></tbody></table></div>
  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>`;
    myString = rep(myString, '$$user$$', UserName);
    myString = rep(myString, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    myString = rep(myString, '$$CompanyURL$$', CompanySettings.CompanyURL);
    myString = rep(myString, '$$CompanyName$$', CompanySettings.CompanyName);
    myString = rep(myString, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
    await send(ToEmailId, 'Update Business Listing', myString);
  } catch (e) {
    // legacy: empty catch
  }
}

module.exports = { SendRegConfirmMail, EncryptFunction, AddNewListingMail, UpdateListingMail };
