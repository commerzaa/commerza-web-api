'use strict';
/**
 * Exports (static, async): Login_Check(string LoginID, string Password, string ip, int Loginfrom = 1): Login|null;
 *   validate(string email, string username, string password): string;
 *   Registration(string SponsorID, string Email, string password, string currency, string country, string username, string ip_address, string MobileNo,
 *     string link, int Country, int State, string Cityname, string FullName, string side, int chkreffval, string ParentID, int Gender, string DOB, string pancard,
 *     int Ctid = 0, string Lastname = "", string StateName = "", string Pincode = "", string CouponCode = "", string BtcAddress = "", string FacebookLink = "",
 *     string Address = "", string MaritalStatus = "", int IsMobileSelfVerified = 0, int Title = 0, int noofjoin = 1, int type = 1): string;
 *   EncryptFunction(string number): string; checkUserGAStatus(int PLId): int; checkUserDetailsByPLID(int PLID, string Password): int;
 *   UpdateMemberEmailStatus(int PLID): string; InsertGAKeyinTable(int PLID, string GAKey, string FACode, string RandomNo): string;
 *   CheckGoogleAuhenticationKey(double Plid): string; ValidPasswordCheck(double Plid): string; CheckRandomNo(double Plid): string;
 *   DisbaleGoogleAuthentication(double Plid): string
 * Login object keys: Plid, Pmid, Smdid, LoginID, UserName, Name, Cid, MOBILE, EMAILID, SecretCode
 * PORT-NOTE: legacy fire-and-forget Threads (mail/SMS) are background promises; errors are only logged.
 * PORT-NOTE: OUTPUT parameters (@RESULT, @RETURNREGNO, @INTRESULT) are read from the result row of the PostgreSQL function.
 * PORT-NOTE: the legacy ErrorInsert blocks placed after a `return` are unreachable and therefore omitted.
 * PORT-NOTE: InsertGAKeyinTable keeps the legacy "yyyy-MM-ddThh:mm:ss" (12-hour clock) date text; IP comes from GetIP.GetLocalIP() (no HTTP context => "No Ip Fetched.").
 */
const db = require('../db');
const { mapRow } = require('../utils/shape');
const UtilityClass = require('./UtilityClass');
const CustomEncriptionAndDecription = require('./CustomEncriptionAndDecription');
const { out, fire } = require('./_libhelpers');

const Login = ['Plid', 'Pmid', 'Smdid', 'LoginID', 'UserName', 'Name', 'Cid', 'MOBILE', 'EMAILID', 'SecretCode'];

const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const pad = (n) => String(n).padStart(2, '0');

/// This Is Method Which Is Basically Used For Login
/// When Loginfrom is 0 then login from admin when 1 then from member
/// this is for admin can login blocked member
async function Login_Check(LoginID, Password, ip, Loginfrom = 1) {
  try {
    let ObjLogin = null;
    if (Loginfrom === 1) {
      ObjLogin = await db.procOne('affiliate', 'usp_portallogin_m', { username: LoginID, password: Password, ipaddress: ip });
    } else {
      ObjLogin = await db.procOne('affiliate', 'usp_portallogin_m', { username: LoginID, password: Password, ipaddress: ip });
    }
    return mapRow(ObjLogin, Login);
  } catch (Exp) {
    return null;
  }
}

async function validate(email, username, password) {
  try {
    const validateemail = await db.queryOne('affiliate', 'select validationactive, status from tbl_detailspagemasterforregistration where tdpmfrid = 5 limit 1');
    if (validateemail === null) throw NRE();
    const validateEmail = validateemail.validationactive;
    const validateEstatus = validateemail.status;

    if (validateEmail === 1 && validateEstatus === 1) {
      if (email.trim() === '') {
        return 'Email Id should not be empty.';
      }
      const isEmail = /^(?:[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)$/.test(email.trim().toLowerCase());
      if (!isEmail) {
        return 'Invalid Email-Id.';
      }
    }
    if (password.trim() === '') {
      return 'Password should not be empty.';
    }
    return 'ok';
  } catch (ExpObj) {
    return ExpObj.message;
  }
}

async function Registration(SponsorID, Email, password, currency, country, username, ip_address, MobileNo, link, Country, State, Cityname, FullName, side, chkreffval, ParentID, Gender, DOB, pancard, Ctid = 0, Lastname = '', StateName = '', Pincode = '', CouponCode = '', BtcAddress = '', FacebookLink = '', Address = '', MaritalStatus = '', IsMobileSelfVerified = 0, Title = 0, noofjoin = 1, type = 1) {
  try {
    let MailContent = '', SponsorName = '', SponsorEmail = '', SponsorMobile = '', SponsorUsername = '', TransactionPass = '';
    if (SponsorID === null || SponsorID === undefined) { SponsorID = ''; }
    let IntOutPutResult = '';
    if (!username) { username = ''; }
    if (!Email) { Email = ''; }
    if (!ParentID) { ParentID = ''; }
    if (!Lastname) { Lastname = ''; }
    if (!Cityname) { Cityname = ''; }
    if (!StateName) { StateName = ''; }
    if (!CouponCode) { CouponCode = ''; }
    if (!Address) { Address = ''; }
    if (!pancard) { pancard = ''; }
    if (!MaritalStatus) { MaritalStatus = ''; }
    if (!DOB) { DOB = ''; }

    const row = await db.procOne('affiliate', 'usp_membermaster', {
      email: Email.trim().toString().toLowerCase(),
      password: password.trim().toString(),
      username: username.trim().toString(),
      sponsor: SponsorID.trim().toString(),
      ipaddress: ip_address,
      mobile: MobileNo.trim().toString(),
      parentid: ParentID.trim().toString(),
      side,
      fname: FullName.trim().toString(),
      lname: Lastname.trim().toString(),
      cid: Country,
      sid: State,
      ctid: Ctid,
      cityname: Cityname.trim().toString(),
      statename: StateName.trim().toString(),
      forrederral: chkreffval,
      gender: Gender,
      dob: DOB,
      noofjoin,
      pincode: Pincode,
      epinnumber: CouponCode.trim().toString(),
      address: Address,
      panno: pancard,
      title: Title,
      maritalstaus: MaritalStatus,
    });
    const resultVal = out(row, 'result');
    if (resultVal === null || resultVal === undefined) throw NRE();
    IntOutPutResult = String(resultVal);

    if (IntOutPutResult === 'Mobile No. Allready Exists !') {
      return IntOutPutResult;
    } else if (IntOutPutResult === 'Email ID Allready Exists !') {
      return IntOutPutResult;
    } else if (IntOutPutResult === 'Pan No. Allready Exists !') {
      return IntOutPutResult;
    } else {
      const regnoVal = out(row, 'returnregno');
      if (regnoVal === null || regnoVal === undefined) throw NRE();
      const Regno = Math.trunc(Number(regnoVal));
      // Regno != 0 || Regno != null  (always true)
      const ObjMemberDetails = await db.procOne('affiliate', 'usp_scalerdata', { mode: 4, identity: '', uniqueid: Regno });
      if (ObjMemberDetails !== null) {
        MobileNo = ObjMemberDetails.mobile;
        username = ObjMemberDetails.username;
        Email = ObjMemberDetails.emailid;
        password = ObjMemberDetails.password;
        password = await UtilityClass.Decryptword(password);

        SponsorName = ObjMemberDetails.sponsorfname;
        SponsorEmail = ObjMemberDetails.sponsoremail;
        SponsorMobile = ObjMemberDetails.sponsormobile;
        SponsorUsername = ObjMemberDetails.sponsorusername;
      }
      const WelcomeEmail = await db.queryOne('affiliate', 'select email_content, email_send_status, email_subject from tbl_emailaction where eid = 1 limit 1');
      const IsEmailVerification = await db.queryOne('affiliate', 'select email_content, email_send_status, email_subject from tbl_emailaction where eid = 2 limit 1');
      const MailToSponsor = await db.queryOne('affiliate', 'select email_content, email_send_status, email_subject from tbl_emailaction where eid = 8 limit 1');
      const EmailVerificationSMS = await db.queryOne('affiliate', 'select sms_content, sms_send_status from tbl_smsaction where id = 1058 limit 1');
      const mode = 1;
      if (IntOutPutResult.toLowerCase() === 'success') {
        // EMAIL
        if (IsEmailVerification === null) throw NRE();
        if (IsEmailVerification.email_send_status === 1) {
          MailContent = '';
          MailContent = IsEmailVerification.email_content;
          const DynamicMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(username, MailContent, Email, password, 6, TransactionPass, '', Regno);
          const toMail = Email, subj = IsEmailVerification.email_subject;
          fire(async () => {
            await UtilityClass.CallBackAddress(toMail.toLowerCase(), subj, DynamicMsg);
          });
        } else {
          if (WelcomeEmail === null) throw NRE();
          if (WelcomeEmail.email_send_status === 1) {
            MailContent = '';
            MailContent = WelcomeEmail.email_content;

            const DynamicMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(username, MailContent, Email, password, 1, TransactionPass, '', 0, 0, '', FullName);
            const toMail = Email, subj = WelcomeEmail.email_subject;
            fire(async () => {
              await UtilityClass.CallBackAddress(toMail.toLowerCase(), subj, DynamicMsg);
            });
          }

          if (MailToSponsor === null) throw NRE();
          if (MailToSponsor.email_send_status === 1) {
            const sponsorUser = SponsorUsername, sponsorMail = SponsorEmail, mailEmail = Email, mailPassword = password;
            const sponsorContent = MailToSponsor.email_content, sponsorSubject = MailToSponsor.email_subject;
            fire(async () => {
              const DynamicSponcerMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(sponsorUser + ',', sponsorContent, mailEmail, mailPassword, mode);
              await UtilityClass.CallBackAddress(sponsorMail.toLowerCase(), sponsorSubject, DynamicSponcerMsg);
            });
          }
        }

        /*******************************SMS SECTION START***********************************/
        if (EmailVerificationSMS === null) throw NRE();
        if (EmailVerificationSMS.sms_send_status === 1) {
          const ConfirmMess = await UtilityClass.FindingSmsContentWithUserIdPassword(username, EmailVerificationSMS.sms_content, Email.trim().toLowerCase(), password, 48, '', FullName);
          const mobile = MobileNo;
          fire(async () => {
            await UtilityClass.SendSMSWithAPI(mobile, ConfirmMess, '1');
          });
        }
        const WelcomeSMS = await db.queryOne('affiliate', 'select sms_content, sms_send_status from tbl_smsaction where id = 1 limit 1');
        if (WelcomeSMS === null) throw NRE();
        if (WelcomeSMS.sms_send_status === 1) {
          const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(username, WelcomeSMS.sms_content, TransactionPass, password, mode, '', FullName);
          const mobile = MobileNo;
          fire(async () => {
            await UtilityClass.SendSMSWithAPI(mobile, messg, '1');
          });
        }
        // var EmailVerificationFromSMS = tbl_smsaction where id = 2  (unused in legacy)
        await db.queryOne('affiliate', 'select id from tbl_smsaction where id = 2 limit 1');
        /*******************************SMS SECTION END***********************************/
      }
      return IntOutPutResult + '^' + Regno + '^' + username + '^' + password;
    }
  } catch (Exp) {
    return Exp.message;
  }
}

function EncryptFunction(number) {
  try {
    const p = new CustomEncriptionAndDecription();
    return p.encryption(number);
  } catch (ExpObj) {
    return ExpObj.message;
  }
}

async function checkUserGAStatus(PLId) {
  let checkResult = 0;
  try {
    if (PLId !== 0) {
      const v = await db.scalar('affiliate', 'select count(1) from tbl_gakeyauthorization_history where plid = @PLId and status = 1', { PLId });
      checkResult = v === null ? 0 : Number(v);
    }
    return checkResult;
  } catch (ExpObj) {
    return checkResult;
  }
}

async function checkUserDetailsByPLID(PLID, Password) {
  let checkResult = 0;
  let GetPassword = '';
  try {
    if (PLID !== 0 && Password !== '') {
      const rows = await db.proc('affiliate', 'usp_getpassworddetails', { mode: parseInt('1', 10), regno: PLID });
      const first = rows[0];
      GetPassword = first ? first[Object.keys(first)[0]] : null;
      if (GetPassword === null || GetPassword === undefined) throw NRE();
      if (GetPassword.trim() === Password.trim()) {
        checkResult = 1;
      }
    }
    return checkResult;
  } catch (ExpObj) {
    return checkResult;
  }
}

async function UpdateMemberEmailStatus(PLID) {
  try {
    let IntOutPutResult = '';
    const row = await db.procOne('affiliate', 'usp_update_memberemailstatus', { plid: PLID });
    const v = out(row, 'intresult');
    if (v === null || v === undefined) throw NRE();
    IntOutPutResult = String(v);
    return IntOutPutResult;
  } catch (Exp) {
    return Exp.message;
  }
}

async function InsertGAKeyinTable(PLID, GAKey, FACode, RandomNo) {
  try {
    const now = new Date();
    const h12 = now.getHours() % 12 === 0 ? 12 : now.getHours() % 12;
    const date = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + 'T' + pad(h12) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    let IP = 'No Ip Fetched.';
    try {
      const GetIP = require('./GetIP');
      IP = await GetIP.GetLocalIP();
    } catch (e) { /* no HTTP context available */ }
    const result = await db.exec('affiliate',
      'insert into tbl_gakeyauthorization_history (plid, gakey, facode, ipaddress, createddate, randomno, status) values (@PLID, @GAKey, @FACode, @IP, @date, @RandomNo, 1)',
      { PLID, GAKey, FACode, IP, date, RandomNo });
    if (result === 1) {
      return String(result);
    } else {
      return 'Invalid Details.!';
    }
  } catch (ExpObj) {
    return ExpObj.message;
  }
}

async function CheckGoogleAuhenticationKey(Plid) {
  let GetGAKEy = '';
  try {
    if (Plid !== 0) {
      const row = await db.queryOne('affiliate', 'select gakey from tbl_gakeyauthorization_history where plid = @Plid and status = 1 limit 1', { Plid });
      GetGAKEy = row === null ? null : row.gakey;
    }
    return GetGAKEy;
  } catch (ExpObj) {
    GetGAKEy = null;
    return GetGAKEy;
  }
}

async function ValidPasswordCheck(Plid) {
  let EncryptPassword = '', Password = '';
  try {
    if (Plid !== 0) {
      const row = await db.queryOne('affiliate', 'select password from portal_login where plid = @Plid limit 1', { Plid });
      EncryptPassword = row === null ? null : row.password;
      Password = await UtilityClass.Decryptword(EncryptPassword);
    }
    return Password;
  } catch (ExpObj) {
    Password = null;
    return Password;
  }
}

async function CheckRandomNo(Plid) {
  let GetFACode = '';
  try {
    if (Plid !== 0) {
      const row = await db.queryOne('affiliate', 'select randomno from tbl_gakeyauthorization_history where plid = @Plid and status = 1 limit 1', { Plid });
      GetFACode = row === null ? null : row.randomno;
    }
    return GetFACode;
  } catch (ExpObj) {
    GetFACode = null;
    return GetFACode;
  }
}

async function DisbaleGoogleAuthentication(Plid) {
  try {
    const DisblaleG = await db.exec('affiliate', 'update tbl_gakeyauthorization_history set status = 0 where plid = @Plid', { Plid });
    if (DisblaleG === 1) {
      return String(DisblaleG);
    } else {
      return 'Invalid Details.!';
    }
  } catch (ExpObj) {
    return ExpObj.message;
  }
}

module.exports = {
  Login_Check, validate, Registration, EncryptFunction, checkUserGAStatus, checkUserDetailsByPLID, UpdateMemberEmailStatus,
  InsertGAKeyinTable, CheckGoogleAuhenticationKey, ValidPasswordCheck, CheckRandomNo, DisbaleGoogleAuthentication,
};
