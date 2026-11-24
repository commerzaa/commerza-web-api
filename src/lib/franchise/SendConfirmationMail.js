/** Exports: class SendConfirmationMail { static async SendMail(int matplid, string emailid, string HtmlMailPath): void } */
'use strict';
const nodemailer = require('nodemailer');
const db = require('../../db');
const CompanySettings = require('./CompanySettings');
const UtilityClass = require('./UtilityClass');

// PORT-NOTE: legacy DataBaseContext for Franchise points at Db_Shopping (Web.config); entity Portal_Login => table tbl_distributor (key DID).
class SendConfirmationMail {
  static async SendMail(matplid, emailid, HtmlMailPath) {
    let username = '', loginid = '', password = '', resellerid = '';
    try {
      let Message = '';
      let MobileNo = '';
      const Row = await db.queryOne('shopping', 'select phone, username, emailid, password, fname, loginid from tbl_distributor where did = @matplid limit 1', { matplid });
      if (Row !== null) {
        MobileNo = Row.phone;
        username = Row.username;
        loginid = Row.emailid;
        password = Row.password;
        resellerid = Row.loginid;
        Message = 'Dear Reseller,\r\nYour account has been created successfully.\r\nYou can visit on this Login Link: ' + CompanySettings.CompanyResellerURL + '/reseller-login \r\nMobile: ' + MobileNo + ' \r\nPwd: ' + password + ' \r\nReseller id:' + resellerid + ' \r\nThank you,\r\nThe ' + CompanySettings.CompanyName + ' Team';
        let myString = `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>
  <div style='background: #fff; margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; padding:15px 25px;'>
    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
    <table cellpadding='0' cellspacing='0' style='margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; width: 100%'>
        <tbody>

      <tr>
        <td><table style='width:100%;'>
            <tbody>
              <tr>
                <td colspan='2' align='center' style='background:#2d2a24'><img src='https://franchise.clusteroffer.com/images/dealsinvicta-8.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:10px;'></td>
              </tr>
            </tbody>
          </table></td>
      </tr>
        <tr>
        <td>
      <div>
        <div class='clear'></div>
        <table style='padding-bottom: 10px; width: 100%; '>
          <tbody>
            <tr>
              <td>
            <tr>
              <td align='center'><strong style='font-size: 20px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Account Created
                </p>
                </strong>
                <div style='text-align:left;'>
                  <h1 style='font-size: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42; text-align:center'>Welcome </h1>
                  <h1 style='font-size: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px

15px; color: #3f3f42;'>Dear Reseller $$lblName$$, </h1>
                  <strong style='font-size: 14px;font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #3f3f42;'>Thank you for verifying your account at <a href='$$CompanyDomain$$' target='_blank' style='color:#00a0a8;'> www.$$CompanyURL$$ </a> <br />
                  </strong>
                  <div style='font-size: 15px; color: #333;'>
                    <p style='font-size:14px; font-weight:bold;  margin-top:20px; margin-bottom:0;'>Your account information </p>
                    <p style='font-size:14px; font-weight:bold; margin:5px; margin-left:0;'> Reseller Id: $$lblresellerLoginId$$ </p>                    
                    <p style='font-size:14px; font-weight:bold; margin:5px; margin-left:0;'> Registered Email: $$lblLoginId$$ </p>
                    <p style='font-size:14px; font-weight:bold;  margin:5px; margin-left:0;'> Your Password: $$lblPassword$$ </p>
                  </div>
                </div>
                <div style='clear: both'></div>

                <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>
                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>
                          <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: 'Exo', sans-serif, Helvetica, sans-serif;  color: #000'> If you have any issues,
            we will be happy to help you. You can contact us on <a href = 'mailto:$$CompanySupportEmailID$$' target = '_blank' style = 'color:#00a0a8;'> $$CompanySupportEmailID$$ </a></p>

                                     </div>

                                     </td>

                                 </tr>
                               <div style = 'clear: both'></div>
                                <div style = 'clear: both'></div>
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

                                                   <a href = 'javascript:void(0)' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = '$$CompanyResellerurl$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

                                                              <a href = 'javascript:void(0)' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = '$$CompanyResellerurl$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

                                                                         <a href = 'javascript:void(0)' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = '$$CompanyResellerurl$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

                                                                                    <a href = 'javascript:void(0)' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = '$$CompanyResellerurl$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

                                                                                                <a href = 'javascript:void(0)' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = '$$CompanyResellerurl$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>

                                                                                                           </div></td>

                                                                                                        </tr>

                                                                                                      </tbody>

                                                                                                    </table></td>

                                                                                                </tr>

                                                                                                  </tbody>

                                                                                              </table>

                                                                                              <div class='clear'></div>
      </div>
        </td>

        </tr>

        </tbody>

    </table>
  </div>
  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2019-2020 All Rights Reserved | $$CompanyURL$$</p>
</div>`;
        const rep = (s, k, v) => s.split(k).join(v === null || v === undefined ? '' : String(v));
        myString = rep(myString, '$$lblName$$', username);
        myString = rep(myString, '$$lblLoginId$$', loginid);
        myString = rep(myString, '$$lblEmail$$', emailid);
        myString = rep(myString, '$$lblPassword$$', password);
        myString = rep(myString, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
        myString = rep(myString, '$$CompanyURL$$', CompanySettings.CompanyURL);
        myString = rep(myString, '$$CompanyName$$', CompanySettings.CompanyName);
        myString = rep(myString, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
        myString = rep(myString, '$$CompanyResellerurl$$', CompanySettings.CompanyResellerURL);
        myString = rep(myString, '$$Logo$$', CompanySettings.Logo);
        myString = rep(myString, '$$lblresellerLoginId$$', resellerid);
        // PORT-NOTE: System.Net.Mail SmtpClient default port 25, no SSL, explicit credentials.
        const transporter = nodemailer.createTransport({
          host: '' + CompanySettings.CompanyMailServer, port: 25, secure: false,
          auth: { user: '' + CompanySettings.CompanyInfoEmailId, pass: '' + CompanySettings.CompanyMailPassword },
        });
        await transporter.sendMail({
          from: '' + CompanySettings.CompanyInfoEmailId,
          to: emailid,
          subject: '' + CompanySettings.CompanyName + ' Reseller Account Activated ',
          html: myString,
        });
        await UtilityClass.SendMsgOnMobile(MobileNo, Message);
      }
    } catch (e) {
      // legacy: empty catch
    }
  }
}

module.exports = SendConfirmationMail;
