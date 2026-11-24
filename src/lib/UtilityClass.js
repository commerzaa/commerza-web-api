'use strict';
/**
 * Exports (static class UtilityClass):
 *   responsemessage (static field), ImageMode {Thumbnail:0,Original:1,Both:2}, SeclectUserType, SelectAddressType
 *   Encryptword(Encryptval):string                Decryptword(DecryptText):string          (sync, delegate to utils/crypto)
 *   async FindingEmailContentWithUserIdPassword(UserName, Msg, Email, Password, Mode, TransactionPass="", SponsorUserName="", plid=0, Amount=0, IFSC="", MemberName="", Toplid=0, DebitAmt=0, CreditAmt=0, passwordType=""):string
 *   RandomNumberStringByLength(length):string
 *   async SendSMSWithAPI(mobileNo, message, ApiType="0"):string   OR   (mobileNo, message, tempid:int, ApiType="0"):string  (overload by 3rd arg type)
 *   async SendSMSWithAPIRegistration(mobileNo, message, ApiType="0"):string
 *   async SendSMSWithAPIG(mobileNo, message, tempid:int, ApiType="0"):string
 *   async SendMsgOnMobile(MobileNo, Message):int      OR   (MobileNo, Message, SMSAPI):int  (overload by arg count)
 *   async CheckAndSendMsgOnEmail(UserId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage, SenderId="", SenderName="", FromEmailId="", DID=0):string
 *   async SendEmail(from, to, cc, bcc, subject, body, Type=""):string
 *   async ImageUploadMasterMethod(ImageBase64Code, Orginial_Folder_Name, Thumb_Folder_Name, IMode, IdForAppend):string
 *   async TrackCustomersEmails(emailId, mailBody, process):void   async TrackCustomersMessages(mobileNo, Message, process):void
 *   async SendSMSOnMobile(MobileNo, Message, type=""):int
 *   async SaveSMSHistory(mobile, message, status):int            async SaveEMAILHistory(from, to, subject, message, status):int
 *   async TrackOTP(mobileNo, OTP, process):void
 *   GetTimestamp(value:Date):string
 *   async FindingSmsContentWithUserIdPassword(empname, msg, userid, password, mode, SponsorUserName="", MemberName="", CreditAmt=0, DebitAmt=0, Plid=0, Toplid=0, TransactionPass="", PasswordType=""):string
 *   async GetDatabaseDate():Date
 *   async SendEmailByApiSetting(user, password, hostname, FromEmailId, BCC_EmailId, CC_EmailId, ToEmailId, Subject, BodyMessage, fileUploader=null (multer file), SenderId="", SenderName=""):string
 *   async Generatetxnid():string   async Generatehash512(text):string   GenerateOrderId():string
 *   async WithdrawalByPayunie(plid:int):object
 *   async CallBackAddress(ToEmailId, Subject, EmailContent):string
 *   GridNumbersPerPage():int   GridPageSize():int
 *   async ImageUploadMasterMethodECommNew(ImageBase64Code, OriginalImage, IdForAppend):string
 *   async ResizeImage(FullName, scaleFactor, filesize, fromstream:Buffer, Folder):void
 *   async GetDataSetSPNamed(arrParam, strSPName, tblName):{[tblName]: rows[]}
 *   classes: DatabaseDate, EmailParam, EmailAuthentication
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const nodemailer = require('nodemailer');
const config = require('../config');
const { query, queryOne, scalar, procOne, exec, proc } = require('../db');
const { Encryptword: _Encryptword, Decryptword: _Decryptword } = require('../utils/crypto');
const DataUtility = require('./DataUtility');

/** ConfigurationManager.AppSettings[key] (config.app first, then ENV var; undefined if absent) */
function appSetting(key, envName) {
  const v = config.app[key];
  if (v !== undefined && v !== '') return v;
  if (process.env[envName || key] !== undefined) return process.env[envName || key];
  return v;
}

const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const replaceAll = (s, a, b) => String(s).split(a).join(b === null || b === undefined ? '' : b);
const EMAIL_REGEX = /^([\w.\-]+)@([\w\-]+)((\.(\w){2,3})+)$/;
const isInt = (s) => /^\s*[+-]?\d+\s*$/.test(String(s));

// HttpWebRequest GET + GetResponse (throws on non-2xx, follows redirects)
async function httpGet(url) {
  return await axios.get(url, { timeout: 100000 });
}

/** Filters a comma list with the legacy e-mail regex */
function validEmails(list) {
  const out = [];
  for (const item of list.split(',')) {
    if (EMAIL_REGEX.test(item.trim()) && item !== '') out.push(item.trim());
  }
  return out;
}

async function smtpSend(host, port, username, pass, msg, timeout) {
  // PORT-NOTE: System.Net.Mail without EnableSsl => plain/STARTTLS; implicit TLS only for port 465.
  const opts = { host, port, secure: port === 465, auth: { user: username, pass } };
  if (timeout) { opts.connectionTimeout = timeout; opts.socketTimeout = timeout; }
  const transporter = nodemailer.createTransport(opts);
  return await transporter.sendMail(msg);
}

function pad(n, l) { return String(n).padStart(l, '0'); }
function randInt(min, maxExclusive) { return crypto.randomInt(min, maxExclusive); }

// ---- image helpers ----
function mapPath(folder) {
  const f = String(folder).replace(/\\/g, '/').replace(/^~/, '').replace(/^\/+/, '');
  return path.join(config.uploadDir, f);
}
function csSubstring(s, start, length) {
  if (start < 0 || length < 0 || start + length > s.length) throw new RangeError('Index and length must refer to a location within the string.');
  return s.substr(start, length);
}
function csFromBase64(s) {
  const t = s.replace(/[ \t\r\n]/g, '');
  if (t.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(t)) throw new Error('The input is not a valid Base-64 string.');
  return Buffer.from(t, 'base64');
}
// System.Drawing.Image.FromStream accepts only bmp/gif/jpeg/png/tiff (others throw "Parameter is not valid.")
function assertImage(b) {
  const ok = (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ||
    (b.length > 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) ||
    (b.length > 4 && b.slice(0, 4).toString('latin1') === 'GIF8') ||
    (b.length > 2 && b[0] === 0x42 && b[1] === 0x4d) ||
    (b.length > 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a)));
  if (!ok) throw new Error('Parameter is not valid.');
}
function saveFile(full, buf) {
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buf);
}

function newImageNumber() {
  let Image = String(randInt(100000, 1000000));
  Image = Image.trim();
  Image = Image.split('&amp;').join('And');
  Image = Image.split('&').join(' And ');
  Image = Image.replace(/[^\w\d]/g, '');
  Image = Image.split(' ').join('-');
  return Image;
}

const UtilityClass = {
  responsemessage: '',

  ImageMode: { Thumbnail: 0, Original: 1, Both: 2, 0: 'Thumbnail', 1: 'Original', 2: 'Both' },
  SeclectUserType: { Branch: 0, Merchant: 1, Franchise: 2, Employee: 3, Vendor: 4, Customer: 5 },
  SelectAddressType: { PermanentAddress: 0, PresentAddress: 1, ResidentialAddress: 2, OfficeAddress: 3, HomeAddress: 4, BillingAddress: 5, ShippingAddress: 6 },

  Encryptword(Encryptval) { return _Encryptword(Encryptval); },
  Decryptword(DecryptText) { return _Decryptword(DecryptText); },

  // Db_Affiliate, Usp_SendDynamicEmailAction (@Result is an OUT param => result column)
  async FindingEmailContentWithUserIdPassword(UserName, Msg, Email, Password, Mode, TransactionPass = '', SponsorUserName = '', plid = 0, Amount = 0, IFSC = '', MemberName = '', Toplid = 0, DebitAmt = 0, CreditAmt = 0, passwordType = '') {
    const row = await procOne('affiliate', 'Usp_SendDynamicEmailAction', {
      Mode, userName: UserName, Message: Msg, emailId: Email, Password,
      SponsorUserName, plid, Toplid, amount: Amount, IFSCcode: IFSC, MemberName,
      DebitAmount: DebitAmt, CreditAmount: CreditAmt, PasswordType: passwordType,
    });
    const v = row ? row.result : null;
    return v === null || v === undefined ? '' : String(v);
  },

  RandomNumberStringByLength(length) {
    const chars = '0123456789';
    let s = '';
    for (let i = 0; i < length; i++) s += chars[randInt(0, chars.length)];
    return s;
  },

  // C# overloads: (mobileNo, message, string ApiType="0") and (mobileNo, message, int tempid, string ApiType="0")
  async SendSMSWithAPI(mobileNo, message, third, fourth) {
    if (typeof third === 'number') {
      return await UtilityClass._SendSMSWithAPITemplate(mobileNo, message, third, fourth === undefined ? '0' : fourth);
    }
    return await UtilityClass._SendSMSWithAPIBasic(mobileNo, message, third === undefined ? '0' : third);
  },

  async _SendSMSWithAPIBasic(mobileNo, message, ApiType) {
    let API = '';
    const objapidata = await query('affiliate', 'SELECT SAID,Prom_API,Tran_APIV from tbl_smsapi');
    const PromoAPI = objapidata.length ? objapidata[0].prom_api : null;
    const TranAPI = objapidata.length ? objapidata[0].tran_apiv : null;
    try {
      if (ApiType === '1') {
        if (TranAPI === null || TranAPI === undefined) throw NRE();
        API = replaceAll(TranAPI, '1111111111', mobileNo);
        API = replaceAll(API, 'DummyText', message);
        await httpGet(API);
      } else {
        if (PromoAPI === null || PromoAPI === undefined) throw NRE();
        API = replaceAll(PromoAPI, '1111111111', mobileNo);
        API = replaceAll(API, 'DummyText', message);
        await httpGet(API);
      }
      await UtilityClass.SaveSMSHistory(mobileNo, message, 1);
      return 'SMS Sent Successfully';
    } catch (ExpObj) {
      await UtilityClass.SaveSMSHistory(mobileNo, message, 2);
      return 'SMS Sending Fail';
    }
  },

  async SendSMSWithAPIRegistration(mobileNo, message, ApiType = '0') {
    let API = '';
    const objapidata = await query('affiliate', 'SELECT SAID,Prom_API,Tran_API from tbl_smsapi');
    const PromoAPI = objapidata.length ? objapidata[0].prom_api : null;
    const TranAPI = objapidata.length ? objapidata[0].tran_api : null;
    try {
      if (ApiType === '1') {
        if (TranAPI === null || TranAPI === undefined) throw NRE();
        API = replaceAll(TranAPI, '1111111111', mobileNo);
        API = replaceAll(API, 'DummyText', message);
        await httpGet(API);
      } else {
        if (PromoAPI === null || PromoAPI === undefined) throw NRE();
        API = replaceAll(PromoAPI, '1111111111', mobileNo);
        API = replaceAll(API, 'DummyText', message);
        await httpGet(API);
      }
      await UtilityClass.SaveSMSHistory(mobileNo, message, 1);
      return 'SMS Sent Successfully';
    } catch (ExpObj) {
      await UtilityClass.SaveSMSHistory(mobileNo, message, 2);
      return 'SMS Sending Fail';
    }
  },

  // C# overloads: SendMsgOnMobile(MobileNo, Message) and SendMsgOnMobile(MobileNo, Message, SMSAPI)
  async SendMsgOnMobile(MobileNo, Message, SMSAPI) {
    if (arguments.length >= 3) {
      let res = 0;
      try {
        SMSAPI = replaceAll(SMSAPI, '1111111111', MobileNo);
        SMSAPI = replaceAll(SMSAPI, 'DummyText', Message);
        SMSAPI = SMSAPI + MobileNo + '&msg=' + Message;
        await httpGet(SMSAPI);
        res = 1;
      } catch (e) {
        res = 0;
      }
      return res;
    }
    let res = 0;
    let CompanySMSAPI = '';
    let Baseurl = '';
    try {
      CompanySMSAPI = await scalar('shopping', "SELECT coalesce(SMSAPI,'') FROM tbl_companysettings Where PMID=1 limit 1");
      Baseurl = CompanySMSAPI + MobileNo + '&msg=' + Message;
      await httpGet(Baseurl);
      res = 1;
    } catch (ex) {
      res = 0;
    }
    return res;
  },

  async CheckAndSendMsgOnEmail(UserId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage, SenderId = '', SenderName = '', FromEmailId = '', DID = 0) {
    let username = '';
    let pass = '';
    let host = '';
    let strret = '';
    FromEmailId = '';
    const smtp = String(appSetting('CompanyMailServerPort'));
    if (!isInt(smtp)) throw new Error('Input string was not in a correct format.');
    const Consmtp = parseInt(smtp, 10);

    const rows = await query('shopping', 'Select COMPANYINFOEMAILID,COMPANYMAILSERVER,COMPANYMAILPASSOWRD from tbl_companysettings Where PMID=1');
    for (const item of rows) {
      username = item.companyinfoemailid;
      pass = item.companymailpassowrd;
      host = item.companymailserver;
      strret = '';
      FromEmailId = item.companyinfoemailid;
    }

    const msg = {
      subject: Subject,
      html: BodyMessage,
      from: (SenderId === '' || SenderName === '') ? FromEmailId : { name: SenderName, address: SenderId },
    };
    if (ToEmailId !== '') { const l = validEmails(ToEmailId); if (l.length) msg.to = l; }
    if (CC_EmailId !== '') { const l = validEmails(CC_EmailId); if (l.length) msg.cc = l; }
    if (BCC_EmailId !== '') { const l = validEmails(BCC_EmailId); if (l.length) msg.bcc = l; }
    try {
      await smtpSend(host, Consmtp, username, pass, msg);
      strret = 's';
      return strret;
    } catch (ex) {
      strret = String(ex.message);
      return strret;
    }
  },

  async SendEmail(from, to, cc, bcc, subject, body, Type = '') {
    let username = '';
    let pass = '';
    let host = '';
    let strret = '';
    from = '';
    const smtp = String(appSetting('CompanyMailServerPort'));
    if (!isInt(smtp)) throw new Error('Input string was not in a correct format.');
    const Consmtp = parseInt(smtp, 10);
    if (Type !== '' && Type !== null && Type !== undefined) {
      const rows = await query('shopping', 'Select COMPANYINFOEMAILID,COMPANYMAILSERVER,COMPANYMAILPASSOWRD from tbl_companysettings Where PMID=1');
      for (const item of rows) {
        username = item.companyinfoemailid;
        pass = item.companymailpassowrd;
        host = item.companymailserver;
        strret = '';
        from = item.companyinfoemailid;
      }
    } else {
      username = '' + config.app.CompanyInfoEmailId + '';
      pass = '' + config.app.CompanyMailPassword + '';
      host = '' + config.app.CompanyMailServer + '';
      strret = '';
      from = '' + config.app.CompanyInfoEmailId + '';
    }
    const msg = { subject, html: body, from };
    if (to !== '') msg.to = to.split(',');
    if (cc !== '') msg.cc = cc.split(',');
    if (bcc !== '') msg.bcc = bcc.split(',');
    try {
      await smtpSend(host, Consmtp, username, pass, msg);
      strret = 's';
      return strret;
    } catch (ex) {
      strret = String(ex.message);
      return strret;
    }
  },

  // PORT-NOTE: Server.MapPath(folder) => config.uploadDir/<folder>. System.Drawing re-save (Img.Save) is reproduced by
  // writing the decoded bytes unchanged (the C# did not resize here: the thumbnail was saved at full size too).
  // Invalid image data throws inside and returns "" exactly like the legacy catch.
  async ImageUploadMasterMethod(ImageBase64Code, Orginial_Folder_Name, Thumb_Folder_Name, IMode, IdForAppend) {
    try {
      let RealImageName = '';
      if (ImageBase64Code.trim() !== '') {
        let Base64String = '';
        let ImageExt = '';
        if (ImageBase64Code !== '') {
          Base64String = ImageBase64Code;
          RealImageName = IdForAppend + '_' + newImageNumber() + '.jpg';
        } else {
          RealImageName = ' ';
        }

        if (Base64String.includes('base64,')) {
          const IndexNo = Base64String.indexOf('/') + 1;
          const lastIndexNo = Base64String.indexOf(';');
          ImageExt = csSubstring(Base64String, IndexNo, lastIndexNo - IndexNo);
          const IndexNo1 = Base64String.indexOf(',') + 1;
          const Pathlength1 = Base64String.length;
          Base64String = csSubstring(Base64String, IndexNo1, Pathlength1 - IndexNo1);
          const ByteArray = csFromBase64(Base64String);
          assertImage(ByteArray);

          const StrValidFull_NameAndPath = mapPath(Orginial_Folder_Name) + '/' + RealImageName;
          const StrValidThumbnail_NameAndPath = path.join(mapPath(Thumb_Folder_Name) + '/' + RealImageName);
          if (fs.existsSync(StrValidFull_NameAndPath)) fs.unlinkSync(StrValidFull_NameAndPath);
          if (fs.existsSync(StrValidThumbnail_NameAndPath)) fs.unlinkSync(StrValidThumbnail_NameAndPath);

          const M = UtilityClass.ImageMode;
          if (IMode === M.Original || IMode === M.Both) {
            // GetImageName(...) swallows its own exceptions
            try { saveFile(StrValidFull_NameAndPath, ByteArray); } catch (e) { /* ignored like legacy */ }
          }
          if (IMode === M.Thumbnail || IMode === M.Both) {
            try { saveFile(StrValidThumbnail_NameAndPath, ByteArray); } catch (e) { /* ignored like legacy */ }
          }
        } else {
          RealImageName = ImageBase64Code.replace(/^\/+/, '');
        }
      }
      return RealImageName;
    } catch (ObjExp) {
      return '';
    }
  },

  async TrackCustomersEmails(emailId, mailBody, process) {
    try {
      await proc('shopping', 'USP_CUSTOMERS_REGISTRATION_EMAIL', { EMAILID: emailId, MAILBODY: mailBody, PROCESS: process });
    } catch (ex) {
      // swallowed like legacy
    }
  },

  async TrackCustomersMessages(mobileNo, Message, process) {
    try {
      await exec('shopping', 'INSERT INTO tbl_customers_messages (MOBILENO,OTP,PROCESS) VALUES(@m, @o, @p)', { m: mobileNo, o: Message, p: process });
    } catch (ex) {
      // swallowed like legacy
    }
  },

  async SendSMSOnMobile(MobileNo, Message, type = '') {
    let res = 0;
    let CompanySMSAPI = '';
    let baseurl = '';
    try {
      if (type !== '' && type !== null && type !== undefined) {
        CompanySMSAPI = await scalar('shopping', "SELECT coalesce(SMSAPI,'') FROM tbl_companysettings Where PMID=1 limit 1");
        baseurl = CompanySMSAPI + MobileNo + '&msg=' + Message;
        await httpGet(baseurl);
        res = 1;
      } else {
        CompanySMSAPI = appSetting('CompanySMSAPI', 'COMPANY_SMS_API');
        const CompanySMSAPIUSERNAME = appSetting('CompanySMSAPIUSERNAME', 'COMPANY_SMS_API_USERNAME');
        const CompanySMSAPIPASSWORD = appSetting('CompanySMSAPIPASSWORD', 'COMPANY_SMS_API_PASSWORD');
        const CompanySMSAPISENDERID = appSetting('CompanySMSAPISENDERID', 'COMPANY_SMS_API_SENDERID');
        if ([CompanySMSAPI, CompanySMSAPIUSERNAME, CompanySMSAPIPASSWORD, CompanySMSAPISENDERID].some((x) => x === undefined)) throw NRE();
        baseurl = CompanySMSAPI + 'username=' + CompanySMSAPIUSERNAME + '&pass=' + CompanySMSAPIPASSWORD + '&senderid=' + CompanySMSAPISENDERID + '&dest_mobileno=' + MobileNo + '&message=' + Message + '&response=Y';
        await httpGet(baseurl);
        res = 1;
      }
    } catch (e) {
      res = 0;
    }
    return res;
  },

  // [USP_MANAGESMSHISTORY] @MOBILE,@MESSAGE,@STATUS,@INTRESULT out,@mode (Db_Affiliate)
  async SaveSMSHistory(mobile, message, status) {
    let result = 0;
    const mobiles = String(mobile).split(',');
    const objdut = new DataUtility();
    const messageWithStar = String(message).replace(/[0-9]/g, '*');
    for (let i = 0; i < mobiles.length; i++) {
      const param = [
        DataUtility.SqlParameter('@MOBILE', mobiles[i]),
        DataUtility.SqlParameter('@MESSAGE', messageWithStar),
        DataUtility.SqlParameter('@STATUS', status),
        DataUtility.SqlParameter('@INTRESULT', 0, 'Output'),
        DataUtility.SqlParameter('@mode', 1),
      ];
      result = await objdut.ExecuteSqlSP(param, '[USP_MANAGESMSHISTORY]');
    }
    return result;
  },

  async TrackOTP(mobileNo, OTP, process) {
    try {
      await exec('shopping', 'INSERT INTO tbl_customers_otp (MOBILENO,OTP,PROCESS) VALUES(@m, @o, @p)', { m: mobileNo, o: OTP, p: process });
    } catch (ex) {
      // swallowed like legacy
    }
  },

  // "yyyyMMddHHmmssffff" (ffff = 4 fractional digits; JS only has milliseconds)
  GetTimestamp(value) {
    const d = new Date(value);
    return d.getFullYear() + pad(d.getMonth() + 1, 2) + pad(d.getDate(), 2) + pad(d.getHours(), 2) +
      pad(d.getMinutes(), 2) + pad(d.getSeconds(), 2) + pad(d.getMilliseconds(), 3) + '0';
  },

  async FindingSmsContentWithUserIdPassword(empname, msg, userid, password, mode, SponsorUserName = '', MemberName = '', CreditAmt = 0, DebitAmt = 0, Plid = 0, Toplid = 0, TransactionPass = '', PasswordType = '') {
    // PORT-NOTE: legacy SQL text ended with ",PasswordType" (missing "@"), so SQL Server passed the literal string
    // 'PasswordType' as the last argument; reproduced exactly (the @PasswordType SqlParameter was never used).
    const row = await procOne('affiliate', 'Usp_SendDynamicSmsAction', {
      plid: Plid, Toplid, Mode: mode,
      EmpName: !empname ? '' : empname,
      Message: msg,
      UserId: !userid ? '' : userid,
      Password: password,
      SponsorUserName, MemberName, DebitAmount: DebitAmt, CreditAmount: CreditAmt,
      PasswordType: 'PasswordType',
    });
    const v = row ? row.result : null;
    return v === null || v === undefined ? '' : String(v);
  },

  // dbo.fun_GetCurrentDate() = SYSDATETIMEOFFSET() at +05:30 (IST) as a plain datetime
  // PORT-NOTE: computed in SQL as now() in Asia/Kolkata (no dependency on a migrated function).
  async GetDatabaseDate() {
    const row = await queryOne('affiliate', "Select (now() at time zone 'Asia/Kolkata') as CurrentDate");
    return row.currentdate;
  },

  async SendEmailByApiSetting(user, password, hostname, FromEmailId, BCC_EmailId, CC_EmailId, ToEmailId, Subject, BodyMessage, fileUploader = null, SenderId = '', SenderName = '') {
    let username = '';
    let pass = '';
    let host = '';
    let strret = '';
    let smptport = 0;
    try {
      if (username === '' || pass === '' || host === '') {
        const EmailAcctount = await queryOne('affiliate', 'select * from tbl_emailaccount where eaid = @eaid limit 1', { eaid: 1 });
        if (!EmailAcctount) throw NRE();
        FromEmailId = EmailAcctount.emailid;
        username = EmailAcctount.emailid;
        pass = EmailAcctount.password;
        host = EmailAcctount.hostname;
        smptport = parseInt(EmailAcctount.smtpport, 10);
        if (Number.isNaN(smptport)) throw new Error('Input string was not in a correct format.');
        if (SenderId === '' && SenderName === '') {
          SenderName = EmailAcctount.sendername;
          SenderId = EmailAcctount.senderemail;
        }
      }

      const msg = { subject: Subject, html: BodyMessage };
      if (fileUploader !== null && fileUploader !== undefined) {
        const fileName = path.basename(fileUploader.originalname || fileUploader.filename || fileUploader.FileName || 'attachment');
        msg.attachments = [{ filename: fileName, content: fileUploader.buffer }];
      }
      msg.from = (!SenderId || !SenderName) ? FromEmailId : { name: SenderName, address: SenderId };
      if (ToEmailId !== '') { const l = validEmails(ToEmailId); if (l.length) msg.to = l; }
      if (CC_EmailId !== '') { const l = validEmails(CC_EmailId); if (l.length) msg.cc = l; }
      if (BCC_EmailId !== '') { const l = validEmails(BCC_EmailId); if (l.length) msg.bcc = l; }
      try {
        // PORT-NOTE: legacy SmtpClient.Timeout = int.MaxValue; here 10 minutes.
        await smtpSend(host, smptport, username, pass, msg, 600000);
        await UtilityClass.SaveEMAILHistory(username, ToEmailId, Subject, BodyMessage, 1);
        strret = 's';
        return strret;
      } catch (ExpObj) {
        strret = String(ExpObj.message);
        await UtilityClass.SaveEMAILHistory(username, ToEmailId, Subject, BodyMessage, 2);
        return strret;
      }
    } catch (ExpObj) {
      await UtilityClass.SaveEMAILHistory(username, ToEmailId, Subject, BodyMessage, 2);
      return String(ExpObj.message);
    }
  },

  // [USP_MANAGEEMAILHISTORY] @FROMEMAILID,@TOEMAILD,@Subject,@MESSAGE,@STATUS,@INTRESULT out,@MODE (Db_Affiliate)
  async SaveEMAILHistory(from, to, subject, message, status) {
    let result = 0;
    const emailid = String(to).split(',');
    const objdut = new DataUtility();
    for (let i = 0; i < emailid.length; i++) {
      const param = [
        DataUtility.SqlParameter('@FROMEMAILID', from),
        DataUtility.SqlParameter('@TOEMAILD', emailid[i]),
        DataUtility.SqlParameter('@Subject', subject),
        DataUtility.SqlParameter('@MESSAGE', message),
        DataUtility.SqlParameter('@STATUS', status),
        DataUtility.SqlParameter('@INTRESULT', 0, 'Output'),
        DataUtility.SqlParameter('@MODE', 1),
      ];
      result = await objdut.ExecuteSqlSP(param, '[USP_MANAGEEMAILHISTORY]');
    }
    return result;
  },

  // PORT-NOTE: legacy hashed rnd.ToString()+DateTime.Now (constant text + seconds => collisions); random bytes added.
  async Generatetxnid() {
    const strHash = await UtilityClass.Generatehash512('System.Random' + new Date().toString() + crypto.randomBytes(8).toString('hex'));
    return String(strHash).substring(0, 20);
  },

  // legacy instance method of UtilityClass (SqlDataAdapter fill): runs a stored procedure, returns { [tblName]: rows }
  async GetDataSetSPNamed(arrParam, strSPName, tblName) {
    const args = {};
    for (const p of arrParam) {
      if (p.Direction === 'Output' || p.Direction === 2) continue;
      args[String(p.ParameterName).replace(/^@/, '').trim()] = p.Value;
    }
    const rows = await proc('affiliate', String(strSPName).replace(/[\[\]]/g, ''), args);
    return { [tblName]: rows };
  },

  // legacy: [db_affiliate].[dbo].[TBL_SMSAPI] / [TBL_SMSACTION]
  async SendSMSWithAPIG(mobileNo, message, tempid, ApiType = '0') {
    let API = '';
    const objapidata = await query('affiliate', 'SELECT SAID,Prom_API,Tran_API from tbl_smsapi');
    const PromoAPI = objapidata.length ? objapidata[0].prom_api : null;
    const TranAPI = objapidata.length ? objapidata[0].tran_api : null;
    const tempID = await scalar('affiliate', 'select TemplateID from tbl_smsaction where id=@id limit 1', { id: tempid });
    try {
      if (ApiType === '1') {
        if (TranAPI === null || TranAPI === undefined) throw NRE();
        API = replaceAll(TranAPI, '1111111111', mobileNo);
        API = replaceAll(API, 'DummyText', message);
        API = replaceAll(API, '1707170954062540965', tempID);
        await httpGet(API);
      } else {
        if (PromoAPI === null || PromoAPI === undefined) throw NRE();
        API = replaceAll(PromoAPI, '1111111111', mobileNo);
        API = replaceAll(API, 'DummyText', message);
        await httpGet(API);
      }
      return 'SMS Sent Successfully';
    } catch (ExpObj) {
      return 'SMS Sending Fail';
    }
  },

  // overload SendSMSWithAPI(mobileNo, message, int tempid, ApiType)
  async _SendSMSWithAPITemplate(mobileNo, message, tempid, ApiType = '0') {
    let API = '';
    // PORT-NOTE: legacy selected Tran_API but read apidata.Tran_APIV (never populated => null), so ApiType "1"
    // always ended in "SMS Sending Fail" (NullReference caught). Reproduced: the Tran_APIV column is not selected.
    const objapidata = await query('affiliate', 'SELECT SAID,Prom_API,Tran_API from tbl_smsapi');
    const PromoAPI = objapidata.length ? objapidata[0].prom_api : null;
    const TranAPI = objapidata.length ? objapidata[0].tran_apiv : null;
    const tempID = await scalar('affiliate', 'select TemplateID from tbl_smsaction where id=@id limit 1', { id: tempid });
    try {
      if (ApiType === '1') {
        if (TranAPI === null || TranAPI === undefined) throw NRE();
        API = replaceAll(TranAPI, '1111111111', mobileNo);
        API = replaceAll(API, 'DummyText', message);
        API = replaceAll(API, '1707169770510998236', tempID);
        await httpGet(API);
      } else {
        if (PromoAPI === null || PromoAPI === undefined) throw NRE();
        API = replaceAll(PromoAPI, '1111111111', mobileNo);
        API = replaceAll(API, 'DummyText', message);
        await httpGet(API);
      }
      return 'SMS Sent Successfully';
    } catch (ExpObj) {
      return 'SMS Sending Fail';
    }
  },

  async Generatehash512(text) {
    try {
      return crypto.createHash('sha512').update(Buffer.from(text, 'utf8')).digest('hex');
    } catch (ExpObj) {
      return '';
    }
  },

  GenerateOrderId() {
    return String(randInt(1000000, 9999999)).padStart(7, '0');
  },

  // PORT-NOTE: the unused `Bank_Accounts` raw SELECT (result never used) is dropped; decimal text uses JS number
  // formatting (e.g. "990" instead of "990.00000000").
  async WithdrawalByPayunie(plid) {
    const key = appSetting('payunie');
    const geography = String(config.app.latilongi).split(',');
    const data = await queryOne('affiliate', 'select * from tbl_withdrawals where plid = @plid and status = @st limit 1', { plid, st: 'Pending' });
    const bb = await queryOne('affiliate', 'select * from bank_accounts where regno = @plid and active = true limit 1', { plid });
    if (!data) throw NRE();
    const amount = Number(data.withdrawamount);
    if (amount <= 1000) data.withdrawamount = amount - 10;
    if (amount > 1000) data.withdrawamount = amount - 20;
    if (!bb) throw NRE();

    const innerrequest = {};
    innerrequest.key = key;
    innerrequest.HolderName = bb.accountholdername;
    innerrequest.BankName = bb.bankname;
    innerrequest.AccountNumber = bb.accountno;
    innerrequest.IFSC = bb.ifsccode;
    innerrequest.Amount = String(data.withdrawamount);
    innerrequest.TransactionID = data.orderid;
    innerrequest.PaymentMode = 'IMPS';
    innerrequest.Remark = 'Cluster Offer';
    innerrequest.latitude = geography[0];
    innerrequest.longitude = geography[1];
    const postData = JSON.stringify(innerrequest);
    const uri = 'https://payunie.com/api/v1/payout';
    try {
      const r = await axios.post(uri, postData, {
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        transformResponse: [(d) => d],
        responseType: 'text',
        timeout: 100000,
      });
      UtilityClass.responsemessage = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
    } catch (web) {
      if (web.response) {
        UtilityClass.responsemessage = typeof web.response.data === 'string' ? web.response.data : JSON.stringify(web.response.data);
      } else {
        // legacy: WebException without response => NullReferenceException from `res.GetResponseStream()`
        throw NRE();
      }
    }
    return JSON.parse(UtilityClass.responsemessage);
  },

  // PORT-NOTE: SendGrid APIKEY was hardcoded in C#; now read from SENDGRID_API_KEY / config.app.SendGridApiKey.
  async CallBackAddress(ToEmailId, Subject, EmailContent) {
    const CompanyName = config.app.CompanyName;
    const OBjGETDepositeAddress = new UtilityClass.EmailParam({
      ToEmailId,
      Subject,
      EmailContent,
      APIKEY: appSetting('SendGridApiKey', 'SENDGRID_API_KEY') || '',
      FromEmailId: 'noreply@clusteroffer.com',
      FromName: CompanyName,
    });
    const StrPostData = JSON.stringify(OBjGETDepositeAddress);
    try {
      await axios.post('http://email.mlmkabila.com/api/v1/send-grid-email', StrPostData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 100000,
      });
    } catch (objExp) {
      return objExp.message;
    }
    return 'success';
  },

  GridNumbersPerPage() {
    const value = appSetting('GridNoPerPage', 'GRID_NO_PER_PAGE');
    if (value !== undefined && isInt(value)) return parseInt(value, 10);
    return 5;
  },

  // PORT-NOTE: Server.MapPath(OriginalImage) => config.uploadDir/<OriginalImage>.
  async ImageUploadMasterMethodECommNew(ImageBase64Code, OriginalImage, IdForAppend) {
    const Orginial_Folder_Path = mapPath(OriginalImage);
    let RealImageName = '';
    const n = new Date();
    const datetime = pad(n.getSeconds(), 2) + pad(n.getMilliseconds(), 3) + '000'; // "ssffffff"
    if (ImageBase64Code.trim() !== '' && ImageBase64Code.includes('base64,')) {
      let Base64String = '';
      let ImageExt = '';
      if (ImageBase64Code !== '') {
        Base64String = ImageBase64Code;
        RealImageName = IdForAppend + newImageNumber() + datetime + '.jpg';
      } else {
        RealImageName = ' ';
      }

      if (Base64String.includes('base64,')) {
        const IndexNo = Base64String.indexOf('/') + 1;
        const lastIndexNo = Base64String.indexOf(';');
        ImageExt = csSubstring(Base64String, IndexNo, lastIndexNo - IndexNo);
        const IndexNo1 = Base64String.indexOf(',') + 1;
        const Pathlength1 = Base64String.length;
        Base64String = csSubstring(Base64String, IndexNo1, Pathlength1 - IndexNo1);
        const ByteArray = csFromBase64(Base64String);
        const filesize = ByteArray.length / 1024;

        assertImage(ByteArray);
        const scaleFactor = 0.25;
        const StrValidFull_NameAndPath = Orginial_Folder_Path + '/' + RealImageName;
        if (fs.existsSync(StrValidFull_NameAndPath)) fs.unlinkSync(StrValidFull_NameAndPath);
        await UtilityClass.ResizeImage(StrValidFull_NameAndPath, scaleFactor, filesize, ByteArray, 'FullImage');
      } else {
        RealImageName = ImageBase64Code.replace(/^\/+/, '');
      }
    } else if (ImageBase64Code.trim() !== '' && !ImageBase64Code.includes('base64,')) {
      RealImageName = path.basename(ImageBase64Code.trim());
    }
    return RealImageName;
  },

  // PORT-NOTE: System.Drawing resize (25% when > 6 KB) is performed with the optional `sharp` module if it is
  // installed (optional dependency: sharp). When it is not installed the original bytes are saved unchanged.
  async ResizeImage(FullName, scaleFactor, filesize, fromstream, Folder) {
    assertImage(fromstream);
    let out = fromstream;
    if (filesize > 6) {
      let sharp = null;
      try { sharp = require('sharp'); } catch (e) { sharp = null; }
      if (sharp) {
        const meta = await sharp(fromstream).metadata();
        const newWidth = Math.trunc(meta.width * scaleFactor);
        const newHeight = Math.trunc(meta.height * scaleFactor);
        if (newWidth <= 0 || newHeight <= 0) throw new Error('Parameter is not valid.');
        out = await sharp(fromstream).resize(newWidth, newHeight, { fit: 'fill' }).toBuffer();
      }
    }
    saveFile(FullName, out);
  },

  GridPageSize() {
    const value = appSetting('GridPageSize', 'GRID_PAGE_SIZE');
    if (value !== undefined && isInt(value)) return parseInt(value, 10);
    return 50;
  },

  DatabaseDate: class DatabaseDate { constructor(init) { this.CurrentDate = null; Object.assign(this, init); } },
  EmailParam: class EmailParam {
    constructor(init) {
      this.ToEmailId = null; this.Subject = null; this.EmailContent = null;
      this.APIKEY = null; this.FromEmailId = null; this.FromName = null;
      Object.assign(this, init);
    }
  },
  EmailAuthentication: class EmailAuthentication {
    constructor(init) { this.COMPANYINFOEMAILID = null; this.COMPANYMAILPASSOWRD = null; this.COMPANYMAILSERVER = null; Object.assign(this, init); }
  },
};

module.exports = UtilityClass;
