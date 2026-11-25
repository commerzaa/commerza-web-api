/** Exports (C# Models/UtilityClass.cs `public class UtilityClass`, MLM Admin, database 'affiliate'; every method is available BOTH as static
 *  `UtilityClass.X()` and as instance `new UtilityClass().X()`; await every call, [sync] ones are plain functions):
 *   fields: SpecialCharsForLoginID[] ; enums: ImageMode {Thumbnail:0,Original:1,Both:2}, SeclectUserType, SelectAddressType, SelectBranchType
 *   ImageUploadMasterMethod(ImageBase64Code, Orginial_Folder_Name, Thumb_Folder_Name, IMode, IdForAppend) : string   [admin port]
 *   GetCurrentDate() [sync] ; GetDatabaseDate() : Date ; GetRandom(minDigits, maxDigits) [sync] ; RandomDigits(length) [sync]          [member]
 *   GetRegNoFromLoginId(loginID) : Int64 ; ValidateTransPassword(RegNo, Password) : bool ; RandomStringByLength(length) [sync]        [admin port]
 *   GetUserType(Regno) : string ; GetTransCondition(Type) : string [member] ; checkUserDetailsByPLID(EmpId, Password) : int           [admin port]
 *   GetEwalletCurrentBalace(RegNo) : decimal ; GridPageSize() [sync] ; GridNumbersPerPage() [sync]                                     [member]
 *   ResizeImage(FullName, scaleFactor, filesize, fromstream:Buffer, Folder) : void   (= member ResizeImages, identical C# body)
 *   CreateCustomPagging_ServerSide(ControllerWithAction, QueryString, TotalRecord, PageSize, NumbersPerPage, CurrentPageIndex) : string [sync, admin port]
 *   SendBulkOrSingleEmailDynamic(from, Password, HostName, to, cc, bcc, subject, body) : string ("s" | error message)                [admin port]
 *   SaveEMAILHistory(from, to, subject, message, status) : int [member] ; Send(from, to, cc, bcc, subject, body) : string (invalid-function message)
 *   SendMsgOnMobile(mobileno, Message) : void (empty) ; SendSMSWithAPI(mobileNo, message, ApiType="0") : string ; SaveSMSHistory(mobile, message, status) : int [member]
 *   SendEmailByApiSetting(user, password, hostname, FromEmailId, BCC_EmailId, CC_EmailId, ToEmailId, Subject, BodyMessage, fileUploader=null, SenderId="", SenderName="") : string
 *   FindingSmsContentWithUserIdPassword(empname, msg, userid, password, mode, Plid=0, Toplid=0, SponsorUserName="", MemberName="", DebitAmt=0, CreditAmt=0, TransactionPass="", PasswordType="") : string
 *   FindingEmailContentWithUserIdPassword(UserName, Msg, Email, Password, Mode, TransactionPass, SponsorUserName="", plid=0, Amount=0, IFSC="", MemberName="", Toplid=0, DebitAmt=0, CreditAmt=0, passwordType="") : string [member]
 *   SendMsgToMobile(mobileno, Message) : int (0) ; ValidateInt(Input) [sync] ; ValidateInt64(Input) [sync] ; Encryptword(Encryptval) [sync] ; Decryptword(DecryptText) [sync]
 *   GenerateGrowthPayout() : void (background) ; SendGrowthInMobile(Message) : void ; Create_Repurchase_AutoPayout() : void (background)
 *   CheckAndSendMsgOnMobile(UserId, MobileNo, Message) : string ("1") ; CheckAndSendMsgOnEmail(UserId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage) : string
 *   SendMsgOnEmail(FromEmailId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage) : string ("s" | error message) ; CreateAutoRoyalityManager() : void (background)
 *   removeSpacesAndSpecialChars(stringvalue) [sync] ; NumberToWords(number) [sync] ; NumberToText(number, isUK) [sync] ; DecimalToWords(d) [sync]                  [member]
 *   UpdateAdminMenu(EmpId) : Admin_User_Menu[] ; UpdateAdminUserSession(loginID) : Employee_Master | null                                                       [admin port]
 *   GenerateRandomNumber() [sync] ; RandomNumberStringByLength(length) [sync] ; GetTimestamp(value) [sync]                                                     [member]
 *   GetLocalIP(req) : string   (C# read HttpContext.Current => pass the Express req) ; GetDataSetSPNamed(arrParam, strSPName, tblName) : {[tblName]: rows} [member]
 *  [member] = reused from ../member/UtilityClass because the Admin and Member C# bodies are identical (same database 'affiliate').
 *  Config keys: GridPageSize, GridNoPerPage (via member), Currency (read, unused like the C#),
 *    CryptoInboxMailUser / CryptoInboxMailPassword / CryptoInboxMailHost / CryptoInboxMailFrom (CheckAndSendMsgOnEmail, were hard-coded),
 *    TextMailUser / TextMailPassword / TextMailHost / TextMailFrom (SendMsgOnEmail, were hard-coded).
 * PORT-NOTE: hard-coded SMTP credentials of CheckAndSendMsgOnEmail / SendMsgOnEmail moved to the config keys above (empty by default).
 * PORT-NOTE: Server.MapPath(x) => config.uploadDir/<x without ~ and leading slashes>. Image resizing uses sharp (lazy); without it the original bytes are written.
 * PORT-NOTE: `new Thread(...).Start()` => fire-and-forget promise (errors only logged). CheckAndSendMsgOnEmail returned before its send thread could set result => "".
 * PORT-NOTE: legacy SQL built by string concatenation (GetUserType, checkUserDetailsByPLID) is parameterised; C# null concatenated as "" is kept (Password ?? '').
 * PORT-NOTE: classes UserType, DatabaseDate, EwalletDetails, Mobile are property bags (not ported). mDataCom / mDa / DataSet connection properties are kept as plain fields.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const nodemailer = require('nodemailer');
const config = require('../../config');
const { query, queryOne, scalar, exec, proc, procOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const { Encryptword: _Encryptword, Decryptword: _Decryptword } = require('../../utils/crypto');
const { fire } = require('../_libhelpers');
const { mailAddress } = require('../franchise/_mailhelpers');
const M = require('../member/UtilityClass');
const { errorInsert } = require('./_helpers');

const DB = 'affiliate';

const SpecialCharsForLoginID = '!#$%^&*();,?+~`\''.split('');
const ImageMode = { Thumbnail: 0, Original: 1, Both: 2 };
const SeclectUserType = { Branch: 0, Merchant: 1, Franchise: 2, Employee: 3, Vendor: 4, Customer: 5 };
const SelectAddressType = { PermanentAddress: 0, PresentAddress: 1, ResidentialAddress: 2, OfficeAddress: 3, HomeAddress: 4, BillingAddress: 5, ShippingAddress: 6 };
const SelectBranchType = { Dump_Warehouse: 0, Branch_Store: 1, Franchise: 2, Merchant: 3 };

/** Models/Employee_Master.cs (incl. [NotMapped] LoginAs / IsStore) */
const EMPLOYEE_MASTER_PROPS = ['Emp_ID', 'Emp_Code', 'Emp_LoginID', 'Emp_Password', 'Emp_Name', 'Current_Balance', 'Emp_Email', 'Emp_Mobile',
  'Emp_PanNo', 'Emp_Image', 'TotalRoles', 'CreateDate', 'Emp_LastLogin', 'Active', 'isDelete', 'WHITELIST_IP', 'LOGINAVALIABLE_FROMTIME',
  'LOGINAVALIABLE_TOTIME', 'LOGINAVALIABLE_ALLWAYS', 'LoginAs', 'IsStore'];
/** Models/Admin_User_Menu.cs */
const ADMIN_USER_MENU_PROPS = ['mid', 'mainMenuTitle', 'mainhref', 'aiClass', 'bClass', 'sid', 'subMenuTitle', 'subhref', 'isEdit', 'HeaderClass',
  'isDelete', 'Active', 'rid', 'MAINACTUALTITLE', 'SUBACTUALTITLE', 'MCID', 'CATGORYNAME'];

// ---------------------------------------------------------------- helpers
const s_ = (v) => (v === null || v === undefined ? '' : String(v)); // C# string concatenation of null => ""
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const replaceAll = (s, a, b) => String(s).split(a).join(b === null || b === undefined ? '' : b);
const EMAIL_REGEX = /^([\w.\-]+)@([\w\-]+)((\.(\w){2,3})+)$/;

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
function assertImage(b) { // System.Drawing.Image.FromStream: bmp/gif/jpeg/png/tiff only
  const ok = (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ||
    (b.length > 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) ||
    (b.length > 4 && b.slice(0, 4).toString('latin1') === 'GIF8') ||
    (b.length > 2 && b[0] === 0x42 && b[1] === 0x4d) ||
    (b.length > 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a)));
  if (!ok) throw new Error('Parameter is not valid.');
}
let _sharp;
function sharp() {
  if (_sharp === undefined) { try { _sharp = require('sharp'); } catch (e) { _sharp = null; } }
  return _sharp;
}
function writeFile(file, buf) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf); }
function rmIfExists(file) { if (fs.existsSync(file)) fs.unlinkSync(file); }
function roundAway(x) { return x < 0 ? -Math.round(-x) : Math.round(x); } // decimal.ToString("0") (MidpointRounding.AwayFromZero)

/** System.Net.Mail.SmtpClient.Send: throws on failure (callers keep the legacy try/catch placement). */
async function smtpSend(host, port, user, pass, message, timeout) {
  if (!host) throw new Error('The SMTP host was not specified.');
  const opts = { host, port, secure: port === 465, auth: { user, pass } };
  if (timeout) { opts.connectionTimeout = timeout; opts.socketTimeout = timeout; }
  await nodemailer.createTransport(opts).sendMail(message);
}

// ---------------------------------------------------------------- UploadImageArea
// private static void GetImageName(ref ImageExt, StrValidFull_NameAndPath, Img, filesize, ref newWidth, ref newHeight, ref radio, scaleFactor)
async function GetImageName(StrValidFull_NameAndPath, Img, filesize, scaleFactor) {
  const sh = sharp();
  if (!sh) { // PORT-NOTE: no image library => original bytes saved unchanged
    writeFile(StrValidFull_NameAndPath, Img);
    return;
  }
  const meta = await sh(Img).metadata();
  const newWidth = Math.trunc(meta.width * scaleFactor);
  const newHeight = Math.trunc(meta.height * scaleFactor);
  if (newHeight === 0) throw new Error('Attempted to divide by zero.'); // radio = newWidth / newHeight (int division)
  if (filesize > 6) {
    // Img.GetThumbnailImage(newWidth, newHeight) saved as JPEG, base64 round-trip, then Imgnew.Save(path) (JPEG)
    if (newWidth <= 0) throw new Error('Parameter is not valid.');
    const bytes = await sh(Img).resize(newWidth, newHeight, { fit: 'fill' }).jpeg({ quality: 75 }).toBuffer();
    writeFile(StrValidFull_NameAndPath, bytes);
  } else {
    writeFile(StrValidFull_NameAndPath, Img); // Img.Save(path) in its raw format
  }
}

async function ImageUploadMasterMethod(ImageBase64Code, Orginial_Folder_Name, Thumb_Folder_Name, IMode, IdForAppend) {
  let RealImageName = '';
  try {
    if (ImageBase64Code.trim() !== '') {
      let Base64String = '';
      if (ImageBase64Code !== '') {
        Base64String = ImageBase64Code;
        let Image = String(crypto.randomInt(100000, 1000000));
        Image = Image.trim();
        Image = replaceAll(Image, '&amp;', 'And');
        Image = replaceAll(Image, '&', ' And ');
        Image = Image.replace(/[^\w\d]/g, '');
        Image = replaceAll(Image, ' ', '-');
        RealImageName = s_(IdForAppend) + '_' + Image + '.jpg';
      } else {
        RealImageName = ' ';
      }
      if (Base64String.includes('base64,')) {
        const IndexNo = Base64String.indexOf('/') + 1;
        const lastIndexNo = Base64String.indexOf(';');
        csSubstring(Base64String, IndexNo, lastIndexNo - IndexNo); // ImageExt
        const IndexNo1 = Base64String.indexOf(',') + 1;
        Base64String = csSubstring(Base64String, IndexNo1, Base64String.length - IndexNo1);
        const ByteArray = csFromBase64(Base64String);
        assertImage(ByteArray); // Image.FromStream(ms)
        let filesize = ByteArray.length;
        filesize = filesize / 1024;
        const StrValidFull_NameAndPath = mapPath(Orginial_Folder_Name) + '/' + RealImageName;
        const StrValidThumbnail_NameAndPath = path.join(mapPath(Thumb_Folder_Name) + '/' + RealImageName);
        rmIfExists(StrValidFull_NameAndPath);
        rmIfExists(StrValidThumbnail_NameAndPath);
        if (IMode === ImageMode.Original || IMode === ImageMode.Both) {
          await GetImageName(StrValidFull_NameAndPath, ByteArray, filesize, 1);
        }
        if (IMode === ImageMode.Thumbnail || IMode === ImageMode.Both) {
          await GetImageName(StrValidThumbnail_NameAndPath, ByteArray, filesize, 0.25);
        }
      } else {
        RealImageName = ImageBase64Code.replace(/^\/+/, '');
      }
    }
    return RealImageName;
  } catch (ex) {
    return RealImageName;
  }
}

// ---------------------------------------------------------------- members / employees
async function GetRegNoFromLoginId(loginID) {
  let Regno = 0;
  try {
    if (loginID !== '') {
      // db._Member_Master.Where(a => a.userName == loginID && a.status == true).FirstOrDefault()
      const row = await queryOne(DB, 'select regno from member_master where username is not distinct from @loginid::text and status::int = 1 limit 1', { loginid: loginID });
      if (row !== null) {
        Regno = Number(row.regno);
      }
    }
    return Regno;
  } catch (ex) {
    return Regno;
  }
}

async function ValidateTransPassword(RegNo, Password) {
  let Ret = false;
  try {
    if (RegNo > 0 && Password !== '') {
      // db._Member_login.Where(a => a.Regno == RegNo && a.Status == true && a.TPassword == Password).FirstOrDefault()
      const row = await queryOne(DB, 'select regno from member_login where regno = @regno and status::int = 1 and tpassword is not distinct from @password::text limit 1',
        { regno: RegNo, password: Password });
      if (row !== null) {
        Ret = true;
      }
    }
    return Ret;
  } catch (e) {
    return Ret;
  }
}

function RandomStringByLength(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%&*()^0123456789';
  let r = '';
  for (let i = 0; i < length; i++) r += chars[crypto.randomInt(0, chars.length)];
  return r;
}

async function GetUserType(Regno) {
  let usertype = '';
  try {
    const Row = await queryOne(DB, `select coalesce((case when M.FID=0 then 'Reseller Package: '||K.Title else K2.Title end),'Inactive Account') as UserTypeMem from member_master M
      left join kit_master K on M.kid=K.kid
      left join kit_master K2 on M.fid=K2.kid where M.regNo=@regno limit 1`, { regno: Regno });
    if (Row !== null) {
      usertype = Row.usertypemem;
    }
    return usertype;
  } catch (ex) {
    return usertype;
  }
}

async function checkUserDetailsByPLID(EmpId, Password) {
  let checkResult = 0;
  try {
    if (EmpId !== 0 && Password !== '') {
      const v = await scalar(DB, 'SELECT COUNT(1) FROM TBl_EMPLOYEE_MASTER WHERE Emp_ID=@empid AND Emp_Password=@password',
        { empid: EmpId, password: s_(Password) });
      checkResult = v === null || v === undefined ? 0 : Number(v);
    }
    return checkResult;
  } catch (ExpObj) {
    return checkResult; // the legacy ErrorInsert block after `return` is unreachable
  }
}

// ---------------------------------------------------------------- paging
function CreateCustomPagging_ServerSide(ControllerWithAction, QueryString, TotalRecord, PageSize, NumbersPerPage, CurrentPageIndex) {
  let hrefFirst = '', hrefLast = '';
  let href = '';
  ControllerWithAction = '/' + s_(ControllerWithAction);
  let Count = 0;
  let TotalPages = 0;
  let TotalPageCount = 0;
  let LoopCount = NumbersPerPage;
  if (TotalRecord === 0.0 && PageSize === 0.0) {
    TotalPageCount = 0.0;
  } else {
    TotalPageCount = TotalRecord / PageSize;
  }
  if (TotalPageCount === 0.0) {
    TotalPages = 0;
  } else {
    const c = Math.ceil(TotalPageCount); // Convert.ToInt32(Math.Ceiling(x))
    if (!Number.isFinite(c) || c > 2147483647 || c < -2147483648) throw new RangeError('Value was either too large or too small for an Int32.');
    TotalPages = c;
  }

  let StartPageNo = 1;
  let Devision = 0;
  let Remainder = 0;
  let PrePageNo = 0;
  if (CurrentPageIndex >= 1) {
    if (NumbersPerPage === 0) throw new Error('Attempted to divide by zero.');
    Devision = Math.trunc(CurrentPageIndex / NumbersPerPage);
    Remainder = CurrentPageIndex % NumbersPerPage;
    if (Remainder === 1) StartPageNo = Devision * NumbersPerPage + 1;
    if (Remainder === 0) StartPageNo = CurrentPageIndex - NumbersPerPage + 1;
    if (Remainder > 1) StartPageNo = Devision * NumbersPerPage + 1;
    if (Remainder === 0) PrePageNo = (Devision - 1) * NumbersPerPage;
    if (Remainder > 0) PrePageNo = Devision * NumbersPerPage;
  }

  let prevClass = '';
  let NextClass = '';
  let ActiveIndex = '';
  if (CurrentPageIndex === 1) prevClass = 'disabledli';

  const hasQs = QueryString !== '' && QueryString !== null && QueryString !== undefined;
  if (hasQs) {
    href = ControllerWithAction + '?page=' + PrePageNo + '&&' + QueryString;
    hrefFirst = ControllerWithAction + '?page=' + 1 + '&&' + QueryString;
  } else {
    href = ControllerWithAction + '?page=' + PrePageNo;
    hrefFirst = ControllerWithAction + '?page=' + 1 + '&&' + s_(QueryString);
  }

  let MyPagingDiv = '';
  MyPagingDiv += "<div class='pagination-container'>";
  MyPagingDiv += "<ul class='pagination'>";
  if (CurrentPageIndex > NumbersPerPage) {
    prevClass = 'enabledPrev';
    MyPagingDiv += "<li class='" + prevClass + "'><a href=" + hrefFirst + '>First</a><a  ' + "href='" + href + "'" + '>«</a></li>';
  } else {
    prevClass = 'disabledPrev';
    MyPagingDiv += "<li class='" + prevClass + "'><a>«</a></li>";
  }

  let CurrentPageNo = StartPageNo;
  while (LoopCount >= 1) {
    if (Count === 0) {
      // int FirstNo = Convert.ToInt32(CurrentPageNo); (unused)
    }
    Count = Count + 1;
    if (CurrentPageIndex === CurrentPageNo) ActiveIndex = 'pageActive';
    else ActiveIndex = '';

    if (hasQs) href = ControllerWithAction + '?page=' + CurrentPageNo + '&&' + QueryString;
    else href = ControllerWithAction + '?page=' + CurrentPageNo;

    MyPagingDiv += "<li class='" + ActiveIndex + "'><a id='" + 'liNav' + String(NumbersPerPage - LoopCount + 1)
      + "' class='" + ActiveIndex + "'  "
      + "href='" + href + "'" +
      '>' + String(CurrentPageNo) + '</a></li>';
    LoopCount = LoopCount - 1;
    CurrentPageNo = CurrentPageNo + 1;
    if (CurrentPageNo > TotalPages) LoopCount = 0;
  }
  if (CurrentPageNo >= TotalPages) NextClass = 'disabledli';

  if (hasQs) {
    href = ControllerWithAction + '?page=' + CurrentPageNo + '&&' + QueryString;
    hrefLast = ControllerWithAction + '?page=' + TotalPages + '&&' + QueryString;
  } else {
    href = ControllerWithAction + '?page=' + CurrentPageNo;
    hrefLast = ControllerWithAction + '?page=' + TotalPages + '&&' + s_(QueryString);
  }
  if (CurrentPageNo <= TotalPages) {
    NextClass = 'enabledNext';
    MyPagingDiv += "<li class='" + NextClass + "'><a " + "href='" + href + "'" + '>»</a><a href=' + hrefLast + '>Last</a></li>';
  } else {
    NextClass = 'disabledNext';
    MyPagingDiv += "<li class='" + NextClass + "'><a>»</a></li>";
  }

  MyPagingDiv += '</ul>';
  MyPagingDiv += "<div class='ReecordMsg'> Page " + String(CurrentPageIndex) + ' of ' + String(TotalPages) + ' (' + TotalRecord + ' Items' + ')</div>';
  MyPagingDiv += '</div>';
  return MyPagingDiv;
}

// ---------------------------------------------------------------- e-mail
//Send Dynamic Email from Here in which you will get emailid, password and hostname from function.
async function SendBulkOrSingleEmailDynamic(from, Password, HostName, to, cc, bcc, subject, body) {
  let SenderName = '', SenderId = '';
  if (from === '' || Password === '' || HostName === '') {
    const EmailAcctount = await queryOne(DB, 'select * from tbl_emailaccount where eaid = @eaid limit 1', { eaid: 1 });
    if (!EmailAcctount) throw NRE();
    from = EmailAcctount.sendername; // legacy: From = SENDERNAME (sic)
    Password = EmailAcctount.password;
    HostName = EmailAcctount.hostname;
    SenderName = EmailAcctount.sendername;
    SenderId = EmailAcctount.senderemail;
  }
  let strret = '';
  // MailMessage construction happens outside the try: invalid addresses throw to the caller (legacy FormatException).
  const MyMailMessage = { subject, html: body };
  MyMailMessage.from = mailAddress(from);
  if (to !== '') MyMailMessage.to = String(to).split(',').map((x) => mailAddress(x));
  if (cc !== '') MyMailMessage.cc = String(cc).split(',').map((x) => mailAddress(x));
  if (bcc !== '') MyMailMessage.bcc = String(bcc).split(',').map((x) => mailAddress(x));
  if (SenderId === '' || SenderName === '') MyMailMessage.from = mailAddress(from);
  else MyMailMessage.from = mailAddress(SenderId, SenderName);
  mailAddress(from); // System.Net.Mail.MailAddress ad = new MailAddress(from);
  try {
    await smtpSend(HostName, 25, from, Password, MyMailMessage); // new SmtpClient(HostName) => port 25
    await M.SaveEMAILHistory(from, to, subject, body, 1);
    strret = 's';
    return strret;
  } catch (ex) {
    strret = String(ex.message);
    await M.SaveEMAILHistory(from, to, subject, body, 2);
    return strret;
  }
}

//Send Email From Here While Use Default Email ID which is static
async function Send(from, to, cc, bcc, subject, body) {
  return 'You Called Invalid Function Please Call SendBulkOrSingleEmailDynamic';
}

async function SendEmailByApiSetting(user, password, hostname, FromEmailId, BCC_EmailId, CC_EmailId, ToEmailId, Subject, BodyMessage, fileUploader = null, SenderId = '', SenderName = '') {
  let username = '';
  let pass = '';
  let host = '';
  let strret = '';
  let smptport = 0;
  try {
    if (username === '' || pass === '' || host === '') {
      let EAID = 1;
      if (FromEmailId !== '') {
        // db._TBL_EMAILACCOUNT.Where(a => a.EMAILID == FromEmailId).FirstOrDefault().EAID
        const EmailAcctountID = await queryOne(DB, 'select eaid from tbl_emailaccount where emailid is not distinct from @emailid::text limit 1', { emailid: FromEmailId });
        if (!EmailAcctountID) throw NRE();
        EAID = EmailAcctountID.eaid;
      }
      const EmailAcctount = await queryOne(DB, 'select * from tbl_emailaccount where eaid = @eaid limit 1', { eaid: EAID });
      if (!EmailAcctount) throw NRE();
      FromEmailId = EmailAcctount.emailid;
      username = EmailAcctount.emailid;
      pass = EmailAcctount.password;
      host = EmailAcctount.hostname;
      smptport = parseInt(s_(EmailAcctount.smtpport).trim(), 10);
      if (Number.isNaN(smptport)) throw new Error('Input string was not in a correct format.');
      if (SenderId === '' && SenderName === '') {
        SenderName = EmailAcctount.sendername;
        SenderId = EmailAcctount.senderemail;
      }
    }

    const MyMailMessage = { subject: Subject, html: BodyMessage };
    if (fileUploader !== null && fileUploader !== undefined) {
      const fileName = path.basename(fileUploader.originalname || fileUploader.FileName || fileUploader.filename || 'attachment');
      MyMailMessage.attachments = [{ filename: fileName, content: fileUploader.buffer }];
    }
    if (SenderId === '' || SenderName === '') MyMailMessage.from = mailAddress(FromEmailId);
    else MyMailMessage.from = mailAddress(SenderId, SenderName);
    const filterList = (csv) => {
      const out = [];
      for (const item of String(csv).split(',')) {
        if (EMAIL_REGEX.test(item.trim())) {
          if (item !== '') out.push(mailAddress(item));
        }
      }
      return out;
    };
    if (ToEmailId !== '') { const l = filterList(ToEmailId); if (l.length) MyMailMessage.to = l; }
    if (CC_EmailId !== '') { const l = filterList(CC_EmailId); if (l.length) MyMailMessage.cc = l; }
    if (BCC_EmailId !== '') { const l = filterList(BCC_EmailId); if (l.length) MyMailMessage.bcc = l; }
    if (SenderId === '' || SenderName === '') mailAddress(FromEmailId);
    else mailAddress(SenderId, SenderName);
    try {
      // PORT-NOTE: SmtpClient.Timeout = int.MaxValue => 10 minutes.
      await smtpSend(host, smptport, username, pass, MyMailMessage, 600000);
      await M.SaveEMAILHistory(username, ToEmailId, Subject, BodyMessage, 1);
      strret = 's';
      return strret;
    } catch (ExpObj) {
      strret = String(ExpObj.message);
      await M.SaveEMAILHistory(username, ToEmailId, Subject, BodyMessage, 2);
      return strret;
    }
  } catch (ExpObj) {
    await M.SaveEMAILHistory(username, ToEmailId, Subject, BodyMessage, 2);
    return String(ExpObj.message);
  }
}

async function CheckAndSendMsgOnEmail(UserId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage) {
  let result = '';
  const username = config.app.CryptoInboxMailUser || '';
  const pass = config.app.CryptoInboxMailPassword || '';
  const host = config.app.CryptoInboxMailHost || '';
  const FromEmailId = config.app.CryptoInboxMailFrom || '';
  const MyMailMessage = { subject: Subject, html: BodyMessage };
  MyMailMessage.from = mailAddress(FromEmailId);
  if (ToEmailId !== '') MyMailMessage.to = String(ToEmailId).split(',').map((x) => mailAddress(x));
  if (CC_EmailId !== '') MyMailMessage.cc = String(CC_EmailId).split(',').map((x) => mailAddress(x));
  if (BCC_EmailId !== '') MyMailMessage.bcc = String(BCC_EmailId).split(',').map((x) => mailAddress(x));
  MyMailMessage.replyTo = mailAddress(ToEmailId); // new MailAddress(ToEmailId)
  try {
    // Thread messageThread = new Thread(delegate { mailClient.Send(MyMailMessage); result = "1"; }); Start();
    fire(async () => {
      await smtpSend(host, 25, username, pass, MyMailMessage);
    });
  } catch (ex) {
    result = String(ex.message);
  }
  return result; // returned before the thread could set "1"
}

async function SendMsgOnEmail(FromEmailId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage) {
  const username = config.app.TextMailUser || '';
  const pass = config.app.TextMailPassword || '';
  const host = config.app.TextMailHost || '';
  let strret = '';
  FromEmailId = config.app.TextMailFrom || '';
  const MyMailMessage = { subject: Subject, html: BodyMessage };
  MyMailMessage.from = mailAddress(FromEmailId);
  if (ToEmailId !== '') MyMailMessage.to = String(ToEmailId).split(',').map((x) => mailAddress(x));
  if (CC_EmailId !== '') MyMailMessage.cc = String(CC_EmailId).split(',').map((x) => mailAddress(x));
  if (BCC_EmailId !== '') MyMailMessage.bcc = String(BCC_EmailId).split(',').map((x) => mailAddress(x));
  MyMailMessage.replyTo = mailAddress(FromEmailId);
  try {
    await smtpSend(host, 25, username, pass, MyMailMessage);
    strret = 's';
    return strret;
  } catch (ex) {
    strret = String(ex.message);
    return strret;
  }
}

// ---------------------------------------------------------------- SMS
async function SendMsgOnMobile(mobileno, Message) {
  try {
    // empty in legacy
  } catch (e) {
    // empty
  }
}

async function SendSMSWithAPI(mobileNo, message, ApiType = '0') {
  let TranAPI = '';
  const PromoAPI = ''; // never loaded in the admin C# (only Tran_API is read)
  let API = '';
  const objapidata = await query(DB, 'SELECT SAID,Prom_API,Tran_API from TBL_SMSAPI', {});
  TranAPI = objapidata.length ? objapidata[0].tran_api : null;
  try {
    if (ApiType === '1') {
      if (TranAPI === null || TranAPI === undefined) throw NRE();
      API = replaceAll(TranAPI, '1111111111', mobileNo);
      API = replaceAll(API, 'DummyText', message);
      new URL(API); // WebRequest.Create(API): UriFormatException on an invalid/empty URI
      await axios.get(API, { timeout: 100000 });
    } else {
      API = replaceAll(PromoAPI, '1111111111', mobileNo);
      API = replaceAll(API, 'DummyText', message);
      new URL(API); // empty => throws (legacy: "Invalid URI: The URI is empty.")
      await axios.get(API, { timeout: 100000 });
    }
    await M.SaveSMSHistory(mobileNo, message, 1);
    return 'SMS Sent Successfully';
  } catch (Ex) {
    await M.SaveSMSHistory(mobileNo, message, 2);
    return 'SMS Sending Fail';
  }
}

async function FindingSmsContentWithUserIdPassword(empname, msg, userid, password, mode, Plid = 0, Toplid = 0, SponsorUserName = '', MemberName = '', DebitAmt = 0, CreditAmt = 0, TransactionPass = '', PasswordType = '') {
  // Legacy: "Usp_SendDynamicSmsAction @plid,@Toplid, @Mode,@EmpName, @Message,@UserId,@Password,@Result out,@SponsorUserName,@MemberName,@DebitAmount,@CreditAmount,PasswordType"
  // PORT-NOTE: the last argument has no "@" => SQL Server received the literal string 'PasswordType' (the @PasswordType SqlParameter was unused); kept.
  // A SqlParameter whose value is C# null is "not supplied" (procedure default) => such arguments are omitted here.
  const all = [
    ['plid', Plid], ['Toplid', Toplid], ['Mode', mode], ['EmpName', empname], ['Message', msg], ['UserId', userid], ['Password', password],
    ['SponsorUserName', SponsorUserName], ['MemberName', MemberName], ['DebitAmount', DebitAmt], ['CreditAmount', CreditAmt], ['PasswordType', 'PasswordType'],
  ];
  const params = {};
  for (const [k, v] of all) if (v !== null && v !== undefined) params[k] = v;
  const row = await procOne(DB, 'Usp_SendDynamicSmsAction', params);
  const k = row ? Object.keys(row).find((x) => x.toLowerCase() === 'result') : undefined;
  const v = k !== undefined ? row[k] : null;
  return v === null || v === undefined ? '' : String(v);
}

async function SendMsgToMobile(mobileno, Message) {
  let success = 0;
  try {
    success = 0;
  } catch (e) {
    success = 0;
  }
  return success;
}

async function CheckAndSendMsgOnMobile(UserId, MobileNo, Message) {
  let result = '';
  result = '1'; // UpdateMessageCount(UserId, UtilityClass.MessageType.MobileSMS);
  if (result === '1' || result === '2') {
    try {
      fire(async () => { result = '1'; }); // thread body only sets result = "1"
    } catch (ex) {
      result = String(ex.message);
    }
  }
  return result;
}

// ---------------------------------------------------------------- crypto (admin catch blocks just swallow => "")
function Encryptword(Encryptval) {
  try { return _Encryptword(Encryptval); } catch (e) { return ''; }
}
function Decryptword(DecryptText) {
  try { return _Decryptword(DecryptText); } catch (e) { return ''; }
}

// ---------------------------------------------------------------- background jobs
async function GenerateGrowthPayout() {
  fire(async () => {
    await proc(DB, 'Usp_Growth_Payout', { regNo: 0, ToDate: '' });
  });
}

async function SendGrowthInMobile(Message) {
  let Currency = '';
  Currency = config.app.Currency; // read but unused (legacy)
  let MobileNoTemp = ''; let Loginid = ''; let Msg = '';
  let TotalIncome = 0; let TodayGrowth = 0;
  let Count = 0;
  let TotalCount = 0;
  const Lim = mapRows(await query(DB, `select M.mobile,M.LoginId,MP.currentIncome as totalIncome,
            case  when G.Updated_DailyGrowth_Rate>G.DailyGrowth_Rate then Updated_DailyGrowth_Rate else DailyGrowth_Rate
            end as  DailyReturn from member_Master M,tbl_GrowthMaster G,tbl_DailyGrowthAccount D,Member_Performance MP where
            G.RegNo=M.regNo and D.GMID=G.GMID and (now() at time zone 'Asia/Kolkata')::date=d.toDate::date
            and MP.regno=M.regNo and M.mobile<>'' and M.Active::int=1  and G.CurrentReturn<G.MaxReturn  and MP.currentIncome>0`, {}),
  ['mobile', 'LoginId', 'totalIncome', 'DailyReturn']);
  TotalCount = Lim.length;
  for (const Item of Lim) {
    Count++;
    if (Count === 1) {
      // SendMsgOnMobile("...", "Mocha club trigger start !"); (commented out in legacy)
    }
    if (Item.totalIncome === null || Item.DailyReturn === null) {
      throw new Error("The cast to value type 'System.Decimal' failed because the materialized value is null.");
    }
    MobileNoTemp = Item.mobile;
    Loginid = Item.LoginId;
    TotalIncome = Number(Item.totalIncome);
    TodayGrowth = Number(Item.DailyReturn);
    Msg = 'Dear user, your account ID ' + s_(Loginid) + ' is credited by ' + String(roundAway(TodayGrowth)) + 'points. ';
    await SendMsgOnMobile(MobileNoTemp, Msg);
  }
  void Currency; void TotalIncome; void TotalCount; void Message;
}

async function Create_Repurchase_AutoPayout() {
  fire(async () => {
    // SP_REPURCHASE_PAYOUT @FROMDATE,@TODATE,@STRRESULT OUT (CommandTimeout 120)
    await proc(DB, 'SP_REPURCHASE_PAYOUT', { FROMDATE: '', TODATE: '' });
  });
}

async function CreateAutoRoyalityManager() {
  fire(async () => {
    // [Usp_RoyalityManager] @INTRESULT OUT (CommandTimeout 120)
    await proc(DB, 'Usp_RoyalityManager', {});
    await GenerateGrowthPayout();
  });
}

// ---------------------------------------------------------------- admin session
async function UpdateAdminMenu(EmpId) {
  // Usp_PickAdminUserRights @EmpID .Where(aum => aum.Active == 1).Distinct()  (Distinct on class instances = reference equality => no-op)
  const objList = mapRows(await proc(DB, 'Usp_PickAdminUserRights', { EmpID: EmpId }), ADMIN_USER_MENU_PROPS)
    .filter((aum) => Number(aum.Active) === 1);
  return objList;
}

async function UpdateAdminUserSession(loginID) {
  const vRow = await queryOne(DB, 'select * from tbl_employee_master where emp_id = @id limit 1', { id: loginID });
  const v = vRow ? mapRow(vRow, EMPLOYEE_MASTER_PROPS) : null;
  if (v !== null) {
    v.LoginAs = null; // [NotMapped] defaults
    v.IsStore = false;
    const row = await queryOne(DB, 'select * from tbl_branch_master where active::int = 1 limit 1', {});
    if (row !== null) {
      const RowBranchType = await queryOne(DB, 'select * from tbl_branch_type where brtid = @brtid limit 1', { brtid: row.brtid });
      if (!RowBranchType) throw NRE();
      v.LoginAs = RowBranchType.brtype_name;
      v.IsStore = RowBranchType.isstore;
      v.Emp_LastLogin = M.GetCurrentDate();
      // db.SaveChanges(): only the mapped, modified property Emp_LastLogin is written
      await exec(DB, 'update tbl_employee_master set emp_lastlogin = @d where emp_id = @id', { d: v.Emp_LastLogin, id: v.Emp_ID });
      // var json = JsonConvert.SerializeObject(v); (unused)
      return v;
    }
  }
  return v;
}

// ---------------------------------------------------------------- IP
function GetLocalIP(req) {
  let _IP = '';
  try {
    const h = req.headers['x-forwarded-for'];
    _IP = Array.isArray(h) ? h.join(',') : h;
    if (_IP === undefined || _IP === null || _IP === '') {
      _IP = req.socket ? req.socket.remoteAddress : (req.connection ? req.connection.remoteAddress : undefined);
    }
    if (_IP.includes(',')) {
      const indexof = _IP.indexOf(',');
      _IP = _IP.substring(0, indexof);
    }
  } catch (ExpObj) {
    _IP = 'No Ip Fetched.';
    fire(() => errorInsert('GetLocalIP', 'Models/GetIP', ExpObj));
  }
  return _IP;
}

// ---------------------------------------------------------------- the function table
const fns = {
  ImageUploadMasterMethod,
  GetCurrentDate: () => M.GetCurrentDate(),
  GetDatabaseDate: () => M.GetDatabaseDate(),
  GetRandom: (minDigits, maxDigits) => M.GetRandom(minDigits, maxDigits),
  RandomDigits: (length) => M.RandomDigits(length),
  GetRegNoFromLoginId, ValidateTransPassword, RandomStringByLength, GetUserType,
  GetTransCondition: (Type) => M.GetTransCondition(Type),
  checkUserDetailsByPLID,
  GetEwalletCurrentBalace: (RegNo) => M.GetEwalletCurrentBalace(RegNo),
  GridPageSize: () => M.GridPageSize(),
  GridNumbersPerPage: () => M.GridNumbersPerPage(),
  ResizeImage: (FullName, scaleFactor, filesize, fromstream, Folder) => M.ResizeImages(FullName, scaleFactor, filesize, fromstream, Folder),
  CreateCustomPagging_ServerSide, SendBulkOrSingleEmailDynamic,
  SaveEMAILHistory: (from, to, subject, message, status) => M.SaveEMAILHistory(from, to, subject, message, status),
  Send, SendMsgOnMobile, SendSMSWithAPI,
  SaveSMSHistory: (mobile, message, status) => M.SaveSMSHistory(mobile, message, status),
  SendEmailByApiSetting, FindingSmsContentWithUserIdPassword,
  FindingEmailContentWithUserIdPassword: (...a) => M.FindingEmailContentWithUserIdPassword(...a),
  SendMsgToMobile,
  ValidateInt: (Input) => M.ValidateInt(Input),
  ValidateInt64: (Input) => M.ValidateInt64(Input),
  Encryptword, Decryptword, GenerateGrowthPayout, SendGrowthInMobile, Create_Repurchase_AutoPayout,
  CheckAndSendMsgOnMobile, CheckAndSendMsgOnEmail, SendMsgOnEmail, CreateAutoRoyalityManager,
  removeSpacesAndSpecialChars: (stringvalue) => M.removeSpacesAndSpecialChars(stringvalue),
  NumberToWords: (number) => M.NumberToWords(number),
  NumberToText: (number, isUK) => M.NumberToText(number, isUK),
  DecimalToWords: (d) => M.DecimalToWords(d),
  UpdateAdminMenu, UpdateAdminUserSession,
  GenerateRandomNumber: () => M.GenerateRandomNumber(),
  RandomNumberStringByLength: (length) => M.RandomNumberStringByLength(length),
  GetTimestamp: (value) => M.GetTimestamp(value),
  GetLocalIP,
  GetDataSetSPNamed: (arrParam, strSPName, tblName) => M.GetDataSetSPNamed(arrParam, strSPName, tblName),
};

class UtilityClass {
  constructor() {
    // legacy connection plumbing (SqlCommand / SqlDataAdapter / DataSet properties), unused
    this.mDataCom = null;
    this.mDa = null;
    this.DataSet = null;
  }
}
for (const [k, v] of Object.entries(fns)) {
  UtilityClass[k] = v;
  Object.defineProperty(UtilityClass.prototype, k, { value: v, writable: true, configurable: true });
}
Object.assign(UtilityClass, { SpecialCharsForLoginID, ImageMode, SeclectUserType, SelectAddressType, SelectBranchType });

module.exports = UtilityClass;
