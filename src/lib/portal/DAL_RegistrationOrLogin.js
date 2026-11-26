/**
 * Exports (static class DAL_RegistrationOrLogin, ClusterofferShopingPortal DAL/DAL_RegistrationOrLogin.cs):
 *   async Login_Check(string LoginID, string Password, string ip, int DistributorID = 0): Login|null;
 *   validate(string email, string username, string password): string;
 *   async checkedDOC_Status(string email, string username): string;
 *   async Registration(Referrelcode, Email, password, currency, country, username, ip_address, MobileNo, int distributionid = 0, Ref_Username = "",
 *     int Ref_Regno = 0, Address = "", Statename = "", cityname = "", Pincode = "", req?): string;
 *   async VisitiorRegistration(currency, FName, LName, int TitleId, DOB, int CID, Email, MobileNo, LoginPassword, ip_address, req?): string;
 *   async CheckOutRegistration(<same as Registration>, req?): string;
 *   async AddNewCommunity(Referrelcode, email, password, currency, country, username, ip_address, MobileNo, SponsorIDs, PlacementIDs, Side, Title,
 *     FirstName, LastName, Desigantion, ImageName): int;
 *   async SendMail(int matplid, emailid, HtmlMailPath, password, username, MobileNo, Name): void;  EncryptFunction(string number): string;
 *   async VerifyDuplicateUser(email, username, MobileNo): int;
 *   async SocialRegistration(Email, FNAME, LNAME, password, ip_address, int distributionid, LoginID, Country): string;
 *   async SocialLoginCheck(string Email, int DID): Login|null; async GET_FAQTPOIC(): FAQTopic[]; async FAQDetails(Int64 ID): FAQAnswer[]
 * Portal DataBaseContext = Db_Shopping. Login = { Plid, Pmid, Smdid, LoginID, UserName, Name, EmailId, Cid, DID, SecretCode }.
 * PORT-NOTE: HttpContext.Current.Session["TempPLID"] (double) => portal-session sessionSet(req,'TempPLID',TempPLID) when the optional trailing
 *   `req` is passed (SESSION.md section 6).
 * PORT-NOTE: AddNewCommunity / SendMail "new Thread(...).Start()" => fire-and-forget promise. SMTP: SmtpClient(CompanyMailServer) => port 25, no SSL,
 *   credentials CompanyInfoEmailId / CompanyMailPassword.
 * PORT-NOTE: SocialRegistration passed an extra @IPADDRESS SqlParameter that the command text never referenced - not sent.
 */
'use strict';
const nodemailer = require('nodemailer');
const db = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const UtilityClass = require('./UtilityClass');
const CompanySettings = require('./CompanySettings');
const CustomEncriptionAndDecription = require('./CustomEncriptionAndDecription');

const DB = 'shopping';
const LOGIN = ['Plid', 'Pmid', 'Smdid', 'LoginID', 'UserName', 'Name', 'EmailId', 'Cid', 'DID', 'SecretCode'];
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const T = (s) => { if (s === null || s === undefined) throw NRE(); return String(s).trim(); };
const outv = (row, name) => {
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k !== undefined ? row[k] : undefined;
};
const outStr = (row, name) => { const v = outv(row, name); if (v === null || v === undefined) throw NRE(); return String(v); };
const toInt32 = (s) => {
  const t = String(s).trim();
  if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  const n = parseInt(t, 10);
  if (n > 2147483647 || n < -2147483648) throw new Error('Value was either too large or too small for an Int32.');
  return n;
};
const toDouble = (s) => {
  const t = String(s).trim();
  if (t === '' || Number.isNaN(Number(t))) throw new Error('Input string was not in a correct format.');
  return Number(t);
};
const rep = (s, k, v) => s.split(k).join(v === null || v === undefined ? '' : String(v));
const setTempPLID = (req, TempPLID) => {
  if (!req) return;
  require('../../modules/portal/_shared/portal-session').sessionSet(req, 'TempPLID', TempPLID);
};
const fire = (fn) => { Promise.resolve().then(fn).catch((e) => console.error('[background task]', e && e.message)); };

async function Login_Check(LoginID, Password, ip, DistributorID = 0) {
  const p = (pwd) => ({ username: LoginID, password: pwd, ipaddress: ip, did: DistributorID });
  const ObjLogin = await db.procOne(DB, 'usp_portallogin_m_customer', p(Password));
  if (ObjLogin === null) {
    const ObjLoginNew = await db.procOne(DB, 'usp_portallogin_m_customer', p(await UtilityClass.Encryptword(Password)));
    return ObjLoginNew === null ? null : mapRow(ObjLoginNew, LOGIN);
  }
  return mapRow(ObjLogin, LOGIN);
}

// eslint-disable-next-line no-unused-vars
function validate(email, username, password) {
  if (T(email) !== '') {
    const isEmail = /^(?:[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)$/.test(T(email));
    if (!isEmail) {
      return 'Email-Id Is Not In Correct Format!';
    }
  }
  return 'ok';
}

async function checkedDOC_Status(email, username) {
  let ResultStatus = 0;
  const row = await db.procOne(DB, 'usp_checking_visitorrequest_status', { loginid: T(email), username: T(username), password: '' });
  ResultStatus = toInt32(outStr(row, 'intresult'));
  if (ResultStatus > 0) {
    if (ResultStatus === 1) {
      return 'registered';
    } else if (ResultStatus === 3) {
      return 'request exist';
    } else if (ResultStatus === 4) {
      return 'user exist';
    }
  }
  return 'ok';
}

async function memberJoin(procName, Referrelcode, Email, password, currency, country, username, ip_address, MobileNo, distributionid, Ref_Username, Ref_Regno,
  Address, Statename, cityname, Pincode, req) {
  if (Referrelcode === null || Referrelcode === undefined) Referrelcode = '';
  let IntOutPutResult = '';
  const row = await db.procOne(DB, procName, {
    loginid: T(Email),
    password,
    username,
    mode: '0',
    qpayregno: '0',
    currencysymbol: currency,
    country,
    referrelcode: Referrelcode,
    ipaddress: ip_address,
    mobileno: MobileNo,
    distributerid: distributionid,
    ref_username: Ref_Username,
    ref_regno: Ref_Regno,
    address: Address,
    statename: Statename,
    ctname: cityname,
    pincode: Pincode,
  });
  IntOutPutResult = outStr(row, 'intresult');
  if (IntOutPutResult === '1') {
    const TempPLID = toDouble(outStr(row, 'plid'));
    setTempPLID(req, TempPLID);
  }
  return IntOutPutResult;
}

async function Registration(Referrelcode, Email, password, currency, country, username, ip_address, MobileNo, distributionid = 0, Ref_Username = '',
  Ref_Regno = 0, Address = '', Statename = '', cityname = '', Pincode = '', req) {
  return memberJoin('usp_memberjoin_temp', Referrelcode, Email, password, currency, country, username, ip_address, MobileNo, distributionid, Ref_Username,
    Ref_Regno, Address, Statename, cityname, Pincode, req);
}

async function VisitiorRegistration(currency, FName, LName, TitleId, DOB, CID, Email, MobileNo, LoginPassword, ip_address, req) {
  const distributionid = 1;
  const Ref_Regno = 0;
  const Referrelcode = '';
  const Ref_Username = '';
  const Address = '';
  const Statename = '';
  const cityname = '';
  const Pincode = '';
  let IntOutPutResult = '';
  const row = await db.procOne(DB, 'usp_visitor_checkout_signup_temp_member', {
    loginid: T(Email),
    password: LoginPassword,
    username: '',
    mode: 0,
    qpayregno: 0,
    currencysymbol: currency,
    country: '',
    referrelcode: Referrelcode,
    ipaddress: ip_address,
    mobileno: MobileNo,
    distributerid: distributionid,
    ref_username: Ref_Username,
    ref_regno: Ref_Regno,
    address: Address,
    statename: Statename,
    ctname: cityname,
    pincode: Pincode,
    sponsorids: '',
    placementids: '',
    side: 0,
    title: TitleId,
    firstname: FName,
    lastname: LName,
    desigantion: '',
    imagename: '',
    modeforjoining: '',
    cid: CID,
    dob: DOB,
  });
  IntOutPutResult = outStr(row, 'intresult');
  if (IntOutPutResult === '1') {
    const TempPLID = toDouble(outStr(row, 'plid'));
    setTempPLID(req, TempPLID);
  }
  return IntOutPutResult;
}

async function CheckOutRegistration(Referrelcode, Email, password, currency, country, username, ip_address, MobileNo, distributionid = 0, Ref_Username = '',
  Ref_Regno = 0, Address = '', Statename = '', cityname = '', Pincode = '', req) {
  return memberJoin('usp_visitor_checkout_signup_temp_member', Referrelcode, Email, password, currency, country, username, ip_address, MobileNo,
    distributionid, Ref_Username, Ref_Regno, Address, Statename, cityname, Pincode, req);
}

async function AddNewCommunity(Referrelcode, email, password, currency, country, username, ip_address, MobileNo, SponsorIDs, PlacementIDs, Side, Title,
  FirstName, LastName, Desigantion, ImageName) {
  let IntOutPutResult = 0;
  try {
    const row = await db.procOne(DB, 'usp_visitor_signup_temp', {
      loginid: T(email),
      password,
      username,
      mode: '0',
      qpayregno: '0',
      currencysymbol: currency,
      country,
      referrelcode: Referrelcode,
      ipaddress: ip_address,
      mobileno: MobileNo,
      sponsorids: SponsorIDs,
      placementids: PlacementIDs,
      side: Side,
      title: Title,
      firstname: FirstName,
      lastname: LastName,
      desigantion: Desigantion,
      imagename: ImageName,
      modeforjoining: '1',
    });
    IntOutPutResult = toInt32(outStr(row, 'intresult'));
    if (IntOutPutResult === 1) {
      const TempPLID = toDouble(outStr(row, 'plid'));
      const plid = Math.round(TempPLID); // Convert.ToInt32(double) (banker's rounding irrelevant for integral ids)
      const MobileNoNoForSendSms = MobileNo;
      const Message = 'Dear ' + username + ',\r\nyour account has been created successfully! Login Link: www.' + CompanySettings.CompanyURL + '/merchant-login \r\nUsername: '
        + username + '\r\n Reg. Email: ' + email + '\r\nPassword: ' + password + ',\r\nThank you.\r\nThe ' + CompanySettings.CompanyName + ' Team';
      let success = 0; // eslint-disable-line no-unused-vars
      fire(async () => {
        await SendMail(plid, email, '', password, username, MobileNo, FirstName);
        success = await UtilityClass.SendMsgOnMobile(MobileNoNoForSendSms, Message);
      });
    }
  } catch (e) {
    IntOutPutResult = 0;
  }
  return IntOutPutResult;
}

// eslint-disable-next-line no-unused-vars
async function SendMail(matplid, emailid, HtmlMailPath, password, username, MobileNo, Name) {
  const loginid = emailid;
  try {
    // legacy also built an unused SMS text ("... www.cryptokaka.com/merchant-login ... The CRYPTOKAKA Team")
    let myString = `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>
  <div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>
    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
    <table cellpadding='0' cellspacing='0' style='margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>
        <tbody>

      <tr>
        <td><table style='width:100%;'>
            <tbody>
              <tr>
                <td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='http://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>
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
              <td align='center'><strong style='font-size: 20px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> REFERRAL PROGRAM
                </p>
                </strong>
                <div style='text-align:left;'>
                  <h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42; text-align:center'>Welcome </h1>
                  <h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px

15px; color: #3f3f42;'>Dear $$lblName$$, </h1>
                  <strong style='font-size: 14px;font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #3f3f42;'>We welcome you to our Referral Program. <br/> <br/>

     Please note, <u>submission</u> of your KYC documents is must to run this program (check my profile on your panel). We request you to submit your KYC documents as soon as possible or <a href='http://$$CompanyURL$$/merchant-login' target='_blank' style='color:#00a0a8;'>www.$$CompanyURL$$/customer-login  </a> to submit now.
                  </strong>
                  <div style='font-size: 15px; color: #333;'>
                    <p style='font-size:14px; font-weight:bold;  margin-top:20px; margin-bottom:0;'>Your account information: </p>
                    <p style='font-size:14px; font-weight:bold; margin:5px; margin-left:0; '> User Name: $$lblName$$ </p>
                    <p style='font-size:14px; font-weight:bold; margin:5px; margin-left:0;'> Registered Email: $$lblLoginId$$ </p>
                    <p style='font-size:14px; font-weight:bold;  margin:5px; margin-left:0;'> Your Password: $$lblPassword$$ </p>
                  </div>
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

                                                   <a href = 'https://www.facebook.com/ATCShoppingServices/' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

                                                              <a href = 'https://twitter.com/ATCShoppingServices' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

                                                                         <a href = 'https://plus.google.com/+ATCShoppingIn' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

                                                                                    <a href = 'https://www.linkedin.com/company/ATCShopping' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

                                                                                                <a href = 'https://pinterest.com/ATCShoppingServices/' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>

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
  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>
</div>`;
    myString = rep(myString, '$$lblName$$', username);
    myString = rep(myString, '$$lblLoginId$$', loginid);
    myString = rep(myString, '$$lblEmail$$', emailid);
    myString = rep(myString, '$$lblPassword$$', password);
    myString = rep(myString, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    myString = rep(myString, '$$CompanyURL$$', CompanySettings.CompanyURL);
    myString = rep(myString, '$$CompanyName$$', CompanySettings.CompanyName);
    myString = rep(myString, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
    const transporter = nodemailer.createTransport({
      host: '' + CompanySettings.CompanyMailServer, port: 25, secure: false, ignoreTLS: true,
      auth: { user: '' + CompanySettings.CompanyInfoEmailId, pass: '' + CompanySettings.CompanyMailPassword },
    });
    await transporter.sendMail({
      from: '' + CompanySettings.CompanyInfoEmailId,
      to: emailid,
      subject: 'Welcome To ' + CompanySettings.CompanyName + '',
      html: myString,
    });
  } catch (e) {
    // legacy: empty catch
  }
}

function EncryptFunction(number) {
  const p = new CustomEncriptionAndDecription();
  return p.encryption(number);
}

async function VerifyDuplicateUser(email, username, MobileNo) {
  const row = await db.procOne(DB, 'usp_validateuser', { loginid: T(email), username, mobileno: MobileNo });
  return toInt32(outStr(row, 'intresult'));
}

async function SocialRegistration(Email, FNAME, LNAME, password, ip_address, distributionid, LoginID, Country) {
  let IntOutPutResult = '';
  try {
    const row = await db.procOne(DB, 'usp_customer_socialregistration', {
      emailid: Email, fname: FNAME, lname: LNAME, did: distributionid, password, ip: ip_address, loginid: LoginID, counrty: Country,
    });
    IntOutPutResult = outStr(row, 'intresult');
    return IntOutPutResult;
  } catch (Ex) {
    return IntOutPutResult;
  }
}

async function SocialLoginCheck(Email, DID) {
  const ObjLogin = await db.procOne(DB, 'usp_social_logincheck', { emailid: Email, did: DID });
  return ObjLogin === null ? null : mapRow(ObjLogin, LOGIN);
}

async function GET_FAQTPOIC() {
  return mapRows(await db.proc(DB, 'usp_get_faq_topic', { mode: 1 }), ['FTID', 'TOPICNAME']);
}

async function FAQDetails(ID) {
  return mapRows(await db.proc(DB, 'usp_get_faq', { fqid: ID }), ['FTID', 'FAQQUE', 'FAQANS']);
}

module.exports = {
  Login_Check, validate, checkedDOC_Status, Registration, VisitiorRegistration, CheckOutRegistration, AddNewCommunity, SendMail, EncryptFunction,
  VerifyDuplicateUser, SocialRegistration, SocialLoginCheck, GET_FAQTPOIC, FAQDetails,
};
