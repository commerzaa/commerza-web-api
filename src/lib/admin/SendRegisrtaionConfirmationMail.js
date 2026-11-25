/** Exports (static, async; C# `public class SendRegisrtaionConfirmationMail`, MLM Admin, database 'affiliate'):
 *   SendRegConfirmMail(double Pltid, string ToEmail, string username, string Loginpassword, string TransaactionPassword = "", string AutoUserName = "",
 *                      string FromEmail = "", string SenderId = "", string SenderName = "", string password = "") : void
 *   EncryptFunction(string number) : string
 * Ported (not re-exported from ../SendRegisrtaionConfirmationMail) because the admin C# differs from the Member/API one:
 *   - company row from TBL_COMPANYMASTER (Member: TBL_COMP_MASTER entity), content text "...verify your franchise...", heading "Verify your franchise",
 *     logo URL quoting "'<url>'/images/logo-website.png", copyright "© 2016-2017", no black background on the logo row;
 *   - the admin class has NO AddNewListingMail / UpdateListingMail;
 *   - the catch logs via the ADMIN DataUtility.ErrorInsert (@Panel = "Admin").
 * PORT-NOTE: SMTP credentials come from TBL_EMAILACCOUNT (EAID = 1), exactly like the legacy code (nothing hard-coded).
 * PORT-NOTE: new MailMessage(from, to) already adds ToEmail; when ToEmail matches the e-mail regex it is added a second time (legacy did the same).
 */
'use strict';
const nodemailer = require('nodemailer');
const { queryOne } = require('../../db');
const CustomEncriptionAndDecription = require('../member/CustomEncriptionAndDecription');
const { replaceAll } = require('../_libhelpers');
const { errorInsert } = require('./_helpers');

const DB = 'affiliate';
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const pad = (n) => String(n).padStart(2, '0');

const TPL_REG_CONFIRM = `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>
  <div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>
    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
    <table cellpadding='0' cellspacing='0' style='width: 100%'>
      <tbody>
        <tr>
          <td><table style='width:100%;'>
              <tbody>
                <tr>
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
                      <strong style='font-size: 20px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000; padding-top:'>Verify your franchise</strong>
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

const EMAIL_REGEX = /^([\w.\-]+)@([\w\-]+)((\.(\w){2,3})+)$/;

function EncryptFunction(number) {
  const p = new CustomEncriptionAndDecription();
  return p.encryption(number);
}

async function SendRegConfirmMail(Pltid, ToEmail, username, Loginpassword, TransaactionPassword = '', AutoUserName = '', FromEmail = '', SenderId = '', SenderName = '', password = '') {
  try {
    // Db._TBL_EMAILACCOUNT.Where(a => a.EAID == 1).FirstOrDefault()
    const EmailAcctount = await queryOne(DB, 'select * from tbl_emailaccount where eaid = @eaid limit 1', { eaid: 1 });
    if (!EmailAcctount) throw NRE();
    FromEmail = EmailAcctount.emailid;
    password = EmailAcctount.password;
    const HostName = EmailAcctount.hostname;
    const usernameemail = EmailAcctount.emailid;
    password = EmailAcctount.password;
    const Portnumber = parseInt(String(EmailAcctount.smtpport), 10);
    if (Number.isNaN(Portnumber)) throw new Error('Input string was not in a correct format.');

    // Db._TBL_COMPANYMASTER.Where(a => a.COMID == 1).FirstOrDefault()
    const SoftUrl = await queryOne(DB, 'select * from tbl_companymaster where comid = @comid limit 1', { comid: 1 });
    if (!SoftUrl) throw NRE();
    const SoftwareUrl = SoftUrl.software_url;
    const CompanyName = SoftUrl.name;
    // new MailMessage(EmailAcctount.EMAILID, ToEmail)
    if (ToEmail === null || ToEmail === undefined) throw new TypeError('Value cannot be null. Parameter name: to');
    if (ToEmail === '') throw new Error("The parameter 'to' cannot be an empty string. Parameter name: to");
    const to = [ToEmail];
    if (SenderName === '' || SenderId === '') {
      SenderName = EmailAcctount.sendername;
      SenderId = EmailAcctount.senderemail;
    }
    if (ToEmail !== '') {
      if (EMAIL_REGEX.test(ToEmail.trim())) {
        if (ToEmail !== '') to.push(ToEmail);
      }
    }
    const now = new Date();
    const curdate = pad(now.getDate()) + '-' + pad(now.getMonth() + 1) + '-' + now.getFullYear();

    let MyString = '';
    const CompanyEmailId = EmailAcctount.emailid;
    const ReplaceWithCompanyName = CompanyName;
    const Content = 'Thanks for signing up in ' + CompanyName + '. As per your valuable details you need to verify your franchise by using link below. This is an one time verification, Follow the link below to confirm your account.';
    const LinkUrl = '' + SoftwareUrl + "Regisrtration-Confirmation?emailid=$$lblemailid$$&vmid=$$lblvmid$$&password=$$Password$$&TransPassword=$$TransaactionPassword$$&AutoUserName=$$AutoUserName$$&username=$$Username$$' style=' text-align:center; width:100%; font-size: 14px; text-decoration: none; font-family: Arial, Helvetica, sans-serif; color: #fff' target='K-P_EYTewa3lJ5WgwetbbkY'";
    const URLImg = " '" + SoftwareUrl + "'/images/logo-website.png height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:10px;'";
    const CompanyTitle = '© 2016-2017 All Rights Reserved |' + CompanyName + '';
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
    // mm.From = EMAILID (constructor); the SenderId/SenderName MailAddress is created and discarded in the legacy code.
    let from = EmailAcctount.emailid;
    if (SenderId === '' || SenderName === '') from = FromEmail;
    const transporter = nodemailer.createTransport({
      host: HostName, port: Portnumber, secure: Portnumber === 465, auth: { user: usernameemail, pass: password },
    });
    await transporter.sendMail({ from, to, subject, html: MyString });
  } catch (ExpObj) {
    await errorInsert('SendRegConfirmMail', 'DAL/SendRegisrtaionConfirmationMail', ExpObj);
  }
}

module.exports = { SendRegConfirmMail, EncryptFunction };
