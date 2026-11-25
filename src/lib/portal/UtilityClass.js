/** Exports (Shopping Portal Models/UtilityClass.cs). Database: 'shopping' (Portal Web.config DataBaseContext = Db_Shopping); [db_affiliate] cross-db calls use 'affiliate'.
 *  Exported as a class whose members exist both statically and on the prototype: `UtilityClass.X()` and `new UtilityClass().X()` both work.
 *  Async unless marked [sync].
 *  fields/enums: SpecialCharsForLoginID[], MessageType, ReferralStatus {Buy:1,proceed:2,Payment:3}, SelectBranchType, RoleUserType, SeclectUserType, SelectAddressType,
 *    ImageMode {Thumbnail:0, Original:1, Both:2}  (PORTAL enum - differs from the Merchant one)
 *  classes: DatabaseDate, EwalletDetails, UserTypes, Kyc_Record, apidata, EmailAuthentication
 *  --- C# identical to the Merchant Panel (taken from ../merchant/UtilityClass):
 *    RandomNumberStringByLength(length)[sync] ; GetCurrentDate()[sync] ; ExchangeRateFromAPI() | ExchangeRateFromAPI(amount, firstCcode, lastCcode) ; Generatehash512(text) ;
 *    GetDataSet(strSql) ; Generatetxnid() ; CreateAutoWithdrawal() ; CreateAutoWithdrawal_ROI() ; DecimalToWords(d)[sync] ; Encryptword(Encryptval)[sync] ;
 *    GenerateRandomNumber()[sync] ; Getimageformate(img)[sync] ; GetRandom(minDigits, maxDigits)[sync] ; getRandomName()[sync] ; GridNumbersPerPage()[sync] ;
 *    GridPageSize()[sync] ; NumberToText(number, isUK)[sync] ; NumberToWords(number)[sync] ; RandomString(length)[sync] ; saveImage(imgecode, titlename, FolderName) ;
 *    CreateImage(base64String, fullpathpath, imagename) ; ValidateInt(Input)[sync] ; ValidateInt64(Input)[sync] ; GetDatabaseDate() ; GetEwalletCurrentBalace(RegNo) ;
 *    GetTransCondition(Type) ; Maintain_Manipulation(Emp_Code, BrCode, created_remark) ; removeSpacesAndSpecialChars(stringvalue)[sync] ;
 *    SendMsgToMobileWithSelfAccount(Api) ; ToOrdinal(value)[sync] ; GetColorcode(ColorName) ; RandomDigits(length)[sync] ; BlastCampaign() ;
 *    GetDataSetSPNamed(arrParam, strSPName, tblName) ; SizeSuffix(value)[sync]
 *  --- portal ports:
 *    RandomStringByLength(length)[sync] ; sessioncheck(Session_id, Plid) : int
 *    ImageUploadMasterMethodEComm(ImageBase64Code, OriginalImage, ThumbNailImage, IMode, IdForAppend) : string
 *    ImageUploadMasterMethod(ImageBase64Code, Orginial_Folder_Name, Thumb_Folder_Name, IMode, IdForAppend) : string
 *    UploadImageFromExtractProcess(ByteArray:Buffer, Orginial_Folder_Path, Thumb_Folder_Path, IMode, RealImageName) : string
 *    ResizeImage(FullName, scaleFactor, filesize(KB), fromstream:Buffer, Folder)
 *    CreateCustomPagging_ServerSide(ControllerWithAction, QueryString, TotalRecord, PageSize, NumbersPerPage, CurrentPageIndex) : string [sync]
 *    Decryptword(DecryptText) : string [sync]  (Decryptword(int) overload => throws NotImplemented)
 *    Send(from, to, cc, bcc, subject, body) : "s" | error message
 *    SendGrowthInMobile(Message, req?) ; UpdateGrowthByGlobal(req?)   (optional trailing Express req: Session["CURRENCYCODE"] via portal-session)
 *    TrackCustomersMessages(mobileNo, Message, process) ; TrackCustomersEmails(emailId, mailBody, process) ; TrackError(ErrorMsg) ; TrackOTP(mobileNo, OTP, process)
 *    SendEmailByApiSetting(user, password, hostname, FromEmailId, BCC_EmailId, CC_EmailId, ToEmailId, Subject, BodyMessage, fileUploader{originalname,buffer}|null, SenderId="", SenderName="") : string
 *    SendMsgOnEmail(FromEmailId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage, SenderId="", SenderName="") : string
 *    SendMsgOnMobile(MobileNo, Message) : int
 *    CheckAndSendMsgOnEmail(UserId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage, SenderId="", SenderName="", FromEmailId="", DID=0) : string
 *    Auto_Mail() ; BusinessKYC_Auto_Mail()
 *    SendEmail(from, to, cc, bcc, subject, body, Type="") : string ; SendSMSOnMobile(MobileNo, Message, type="") : int
 *    SendSMSWithAPI(mobileNo, message, tempid:int, ApiType="0") : string
 *    FindingSmsContentWithUserIdPassword(empname, msg, userid, password, mode, SponsorUserName="", MemberName="", CreditAmt=0, DebitAmt=0, Plid=0, Toplid=0, TransactionPass="", PasswordType="") : string
 *    GetBaseUrl(req) : string [sync]  (Express req instead of HttpContext)
 *  PORT-NOTE: Server.MapPath(x) => config.uploadDir/<x without leading ~ / ./ ../>.
 *  PORT-NOTE: System.Drawing resize uses the optional `sharp` package (lazily required, NOT installed); without it the decoded bytes are written unchanged.
 *  PORT-NOTE: background Threads => fire-and-forget promises (errors logged only).
 *  PORT-NOTE: concatenated T-SQL (TrackError/TrackOTP/TrackCustomersMessages/GetColorcode/SendSMSWithAPI) is parameterised.
 *  CompanySettings / SendMail are the portal libs (./CompanySettings, ./SendMail) required lazily.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const config = require('../../config');
const { query, queryOne, scalar, exec, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { Decryptword: _Decryptword } = require('../../utils/crypto');
const { outValue } = require('../_http');
const { fire } = require('../_libhelpers');
const { mailAddress, addrList, smtpSend } = require('../franchise/_mailhelpers');
const M = require('../merchant/UtilityClass');

const DB = 'shopping';
const CS = () => require('./CompanySettings');
const SendMailLib = () => require('./SendMail');

// ---------------------------------------------------------------- fields / enums
const SpecialCharsForLoginID = '!#$%^&*();,?+~`\''.split('');
const MessageType = { MobileSMS: 0, WebEmail: 1, 0: 'MobileSMS', 1: 'WebEmail' };
const ReferralStatus = { Buy: 1, proceed: 2, Payment: 3, 1: 'Buy', 2: 'proceed', 3: 'Payment' };
const SelectBranchType = { Dump_Warehouse: 0, Branch_Store: 1, Franchise: 2, Merchant: 3, 0: 'Dump_Warehouse', 1: 'Branch_Store', 2: 'Franchise', 3: 'Merchant' };
const RoleUserType = { Admin: 0, Merchant: 1, 0: 'Admin', 1: 'Merchant' };
const SeclectUserType = { Branch: 0, Merchant: 1, Franchise: 2, Employee: 3, Vendor: 4, Customer: 5, 0: 'Branch', 1: 'Merchant', 2: 'Franchise', 3: 'Employee', 4: 'Vendor', 5: 'Customer' };
const SelectAddressType = {
  PermanentAddress: 0, PresentAddress: 1, ResidentialAddress: 2, OfficeAddress: 3, HomeAddress: 4, BillingAddress: 5, ShippingAddress: 6,
  0: 'PermanentAddress', 1: 'PresentAddress', 2: 'ResidentialAddress', 3: 'OfficeAddress', 4: 'HomeAddress', 5: 'BillingAddress', 6: 'ShippingAddress',
};
const ImageMode = { Thumbnail: 0, Original: 1, Both: 2, 0: 'Thumbnail', 1: 'Original', 2: 'Both' };

// e-mail templates (Auto_Mail / BusinessKYC_Auto_Mail, verbatim from the portal C#)
const TPL = require('./_utility_templates');

// ---------------------------------------------------------------- private helpers
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const s_ = (v) => (v === null || v === undefined ? '' : String(v));
const rep = (s, k, v) => String(s).split(k).join(v === null || v === undefined ? '' : String(v));
function toInt32(v, convertNull) {
  if ((v === null || v === undefined) && convertNull) return 0;
  const t = s_(v).trim();
  if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return parseInt(t, 10);
}
function bankers(x) {
  const f = Math.floor(x); const d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}
function mapPath(folder) {
  let f = s_(folder).replace(/\\/g, '/');
  f = f.replace(/^~/, '');
  while (/^(\.{1,2}\/|\/)/.test(f)) f = f.replace(/^(\.{1,2}\/|\/)/, '');
  return path.join(config.uploadDir, f);
}
function csSubstring(s, start, length) {
  if (start < 0 || length < 0 || start + length > s.length) throw new RangeError('Index and length must refer to a location within the string.');
  return s.substr(start, length);
}
function csFromBase64(s) {
  const t = s.replace(/[ \t\r\n]/g, '');
  if (t.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(t)) throw new Error('The input is not a valid Base-64 string as it contains a non-base 64 character, more than two padding characters, or an illegal character among the padding characters.');
  return Buffer.from(t, 'base64');
}
function sniffFormat(b) {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length > 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length > 4 && b.slice(0, 4).toString('latin1') === 'GIF8') return 'gif';
  if (b.length > 2 && b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  if (b.length > 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a))) return 'tiff';
  return null;
}
function assertImage(b) { if (!sniffFormat(b)) throw new Error('Parameter is not valid.'); } // Image.FromStream
let _sharp;
function sharp() {
  if (_sharp === undefined) { try { _sharp = require('sharp'); } catch (e) { _sharp = null; } }
  return _sharp;
}
function writeFile(file, buf) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf); }
function rmIfExists(file) { if (fs.existsSync(file)) fs.unlinkSync(file); }
function newImageNumber() { // Generator.Next(100000, 1000000) + legacy sanitising
  let Image = String(crypto.randomInt(100000, 1000000));
  Image = Image.trim();
  Image = rep(Image, '&amp;', 'And');
  Image = rep(Image, '&', ' And ');
  Image = Image.replace(/[^\w\d]/g, '');
  Image = rep(Image, ' ', '-');
  return Image;
}
function parseDataUri(Base64String) {
  const IndexNo = Base64String.indexOf('/') + 1;
  const lastIndexNo = Base64String.indexOf(';');
  const ImageExt = csSubstring(Base64String, IndexNo, lastIndexNo - IndexNo);
  const IndexNo1 = Base64String.indexOf(',') + 1;
  const b64 = csSubstring(Base64String, IndexNo1, Base64String.length - IndexNo1);
  return { ImageExt, bytes: csFromBase64(b64) };
}
const uriEscape = (u) => s_(u).replace(/[^A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]/gu, (c) => encodeURIComponent(c));
async function httpGet(url) { // HttpWebRequest.GetResponse (throws on non-2xx / invalid URI)
  new URL(uriEscape(url)); // WebRequest.Create => UriFormatException
  await axios.get(uriEscape(url), { responseType: 'text', transformResponse: [(d) => d], maxRedirects: 50, timeout: 100000 });
}
const EMAIL_RE = /^([\w.\-]+)@([\w\-]+)((\.(\w){2,3})+)$/;
function validAddrs(csv) {
  const out = [];
  for (const a of csv.split(',')) if (EMAIL_RE.test(a.trim()) && a !== '') out.push(mailAddress(a));
  return out;
}
function applyRecipients(msg, ToEmailId, CC_EmailId, BCC_EmailId) {
  if (ToEmailId !== '') { const l = validAddrs(ToEmailId); if (l.length) msg.to = l; }
  if (CC_EmailId !== '') { const l = validAddrs(CC_EmailId); if (l.length) msg.cc = l; }
  if (BCC_EmailId !== '') { const l = validAddrs(BCC_EmailId); if (l.length) msg.bcc = l; }
}
// new SmtpClient(host, port): ArgumentOutOfRangeException for port <= 0 / > 65535
function checkPort(port) { if (port <= 0 || port > 65535) throw new RangeError('Specified argument was out of the range of valid values.\r\nParameter name: port'); }
// MailAddressCollection.Add per comma item (to/cc/bcc, unfiltered)
function plainRecipients(msg, to, cc, bcc) {
  if (to !== '') msg.to = addrList(to);
  if (cc !== '') msg.cc = addrList(cc);
  if (bcc !== '') msg.bcc = addrList(bcc);
}
async function companyMailRow() { // Select COMPANYINFOEMAILID,COMPANYMAILSERVER,COMPANYMAILPASSOWRD from tbl_companySettings Where PMID=1 (foreach => last row wins)
  const rows = await query(DB, 'select companyinfoemailid, companymailserver, companymailpassowrd from tbl_companysettings where pmid=1');
  return rows.length ? rows[rows.length - 1] : null;
}

// ---------------------------------------------------------------- misc
function RandomStringByLength(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let r = '';
  for (let i = 0; i < length; i++) r += chars[crypto.randomInt(0, chars.length)];
  return r;
}

// USP_SESSIONSERVICESFORANROID @SESSIONID,@STATUS,@ACTIVE,@MODE,@INTRESULT OUT,@PLID  (SqlQuery<Int32>.FirstOrDefault)
// PORT-NOTE: positional call - the 6th proc parameter is named @CLID in the schema, so Plid is bound to clid; @INTRESULT was sent as an input "0".
async function sessioncheck(Session_id, Plid) {
  const rows = await proc(DB, 'usp_sessionservicesforanroid', { sessionid: String(Session_id), status: '1', active: '1', mode: '2', intresult: '0', clid: Plid });
  if (!rows.length) return 0;
  const v = rows[0][Object.keys(rows[0])[0]];
  if (v === null || v === undefined) throw NRE();
  return Number(v);
}

// C# overloads: Decryptword(string) and internal Decryptword(int) (NotImplementedException)
function Decryptword(DecryptText) {
  if (typeof DecryptText === 'number') throw new Error('The method or operation is not implemented.');
  let ret = '';
  try {
    let t = String(DecryptText);
    t = rep(t, '_plus_', '+');
    t = rep(t, '_space_', ' ');
    t = rep(t, '_slash_', '/');
    t = rep(t, '_modulo_', '%');
    t = rep(t, '_tild_', '~');
    t = rep(t, '_dot_', '.');
    t = rep(t, '%3d', '=');
    ret = _Decryptword(t);
  } catch (e) { /* swallowed */ }
  return ret;
}

function CreateCustomPagging_ServerSide(ControllerWithAction, QueryString, TotalRecord, PageSize, NumbersPerPage, CurrentPageIndex) {
  let hrefFirst = ''; let hrefLast = '';
  let href = '';
  ControllerWithAction = '/' + ControllerWithAction;
  let LoopCount = NumbersPerPage;
  const TotalPageCount = TotalRecord / PageSize;
  if (!Number.isFinite(TotalPageCount)) throw new RangeError('Value was either too large or too small for an Int32.');
  const TotalPages = bankers(Math.ceil(TotalPageCount));
  let StartPageNo = 1; let Devision = 0; let Remainder = 0; let PrePageNo = 0;
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
  let prevClass = ''; let NextClass = ''; let ActiveIndex = '';
  if (CurrentPageIndex === 1) prevClass = 'disabledli';
  const hasQs = QueryString !== '' && QueryString !== null && QueryString !== undefined;
  const qs = s_(QueryString);
  const hasQ = () => ControllerWithAction.includes('?');
  if (hasQs) {
    if (hasQ()) { href = ControllerWithAction + '&&page=' + PrePageNo; hrefFirst = ControllerWithAction + '&&page=' + 1; }
    else { href = ControllerWithAction + '?page=' + PrePageNo + '&&' + qs; hrefFirst = ControllerWithAction + '?page=' + 1 + '&&' + qs; }
  } else if (hasQ()) {
    href = ControllerWithAction + '&&page=' + PrePageNo; hrefFirst = ControllerWithAction + '&&page=' + 1 + '&&' + qs;
  } else {
    href = ControllerWithAction + '?page=' + PrePageNo; hrefFirst = ControllerWithAction + '?page=' + 1 + '&&' + qs;
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
    ActiveIndex = CurrentPageIndex === CurrentPageNo ? 'pageActive' : '';
    if (hasQs) {
      if (hasQ()) href = ControllerWithAction + '&&page=' + CurrentPageNo;
      else href = ControllerWithAction + '?page=' + CurrentPageNo + '&&' + qs;
    } else if (hasQ()) {
      href = ControllerWithAction + '&&page=' + CurrentPageNo;
    } else {
      href = ControllerWithAction + '?page=' + CurrentPageNo;
    }
    MyPagingDiv += "<li class='" + ActiveIndex + "'><a id='" + 'liNav' + String(NumbersPerPage - LoopCount + 1)
      + "' class='" + ActiveIndex + "'  " + "href='" + href + "'" + '>' + String(CurrentPageNo) + '</a></li>';
    LoopCount -= 1;
    CurrentPageNo += 1;
    if (CurrentPageNo > TotalPages) LoopCount = 0;
  }
  if (CurrentPageNo >= TotalPages) NextClass = 'disabledli';
  if (hasQs) {
    href = ControllerWithAction + '?page=' + CurrentPageNo + '&&' + qs;
    hrefLast = ControllerWithAction + '?page=' + TotalPages + '&&' + qs;
  } else if (hasQ()) {
    href = ControllerWithAction + '&&page=' + CurrentPageNo;
    hrefLast = ControllerWithAction + '&&page=' + TotalPages + '&&' + qs;
  } else {
    href = ControllerWithAction + '?page=' + CurrentPageNo;
    hrefLast = ControllerWithAction + '?page=' + TotalPages + '&&' + qs;
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
  const MyPagingDivstr = rep(MyPagingDiv, "'", '"');
  const MyPagingDivme = rep(MyPagingDivstr, '"s', "'s");
  return MyPagingDivme;
}

// ---------------------------------------------------------------- images
// private GetImageName: newWidth/newHeight (radio = int/int => DivideByZero when newHeight == 0), then Img.Save(path) (raw format)
async function GetImageName(StrValidFull_NameAndPath, bytes, scaleFactor) {
  const sh = sharp();
  if (sh) {
    const meta = await sh(bytes).metadata();
    if (Math.trunc(meta.height * scaleFactor) === 0) throw new Error('Attempted to divide by zero.');
  }
  writeFile(StrValidFull_NameAndPath, bytes);
}

// PORT-NOTE: legacy (> 6 KB): ThumbNail => GetThumbnailImage(w*scale, h*scale) saved as JPEG; any other folder => the original stream is
// re-read and saved in its raw format (the drawn bitmap was only appended to the stream). Reproduced as: ThumbNail resized JPEG, else original bytes.
async function ResizeImage(FullName, scaleFactor, filesize, fromstream, Folder) {
  assertImage(fromstream);
  if (filesize > 6) {
    const sh = sharp();
    if (!sh) { writeFile(FullName, fromstream); return; } // PORT-NOTE: sharp not installed - bytes saved unchanged
    const meta = await sh(fromstream).metadata();
    const newWidth = Math.trunc(meta.width * scaleFactor);
    const newHeight = Math.trunc(meta.height * scaleFactor);
    if (newWidth <= 0 || newHeight <= 0) throw new Error('Parameter is not valid.'); // new Bitmap(0, h)
    if (Folder === 'ThumbNail') {
      writeFile(FullName, await sh(fromstream).resize(newWidth, newHeight, { fit: 'fill' }).jpeg().toBuffer());
    } else {
      writeFile(FullName, fromstream);
    }
  } else {
    writeFile(FullName, fromstream); // image.Save(FullName)
  }
}

async function ImageUploadMasterMethodEComm(ImageBase64Code, OriginalImage, ThumbNailImage, IMode, IdForAppend) {
  const Orginial_Folder_Path = mapPath(OriginalImage);
  const Thumb_Folder_Path = mapPath(ThumbNailImage);
  let RealImageName = '';
  if (ImageBase64Code.trim() !== '' && ImageBase64Code.includes('base64,')) {
    let Base64String = '';
    if (ImageBase64Code !== '') {
      Base64String = ImageBase64Code;
      RealImageName = IdForAppend + newImageNumber() + '.jpg';
    } else {
      RealImageName = ' ';
    }
    if (Base64String.includes('base64,')) {
      const { bytes } = parseDataUri(Base64String);
      const filesize = bytes.length / 1024;
      assertImage(bytes);
      if (IMode === ImageMode.Original || IMode === ImageMode.Both) {
        const StrValidFull_NameAndPath = Orginial_Folder_Path + '/' + RealImageName;
        rmIfExists(StrValidFull_NameAndPath);
        await ResizeImage(StrValidFull_NameAndPath, 1, filesize, bytes, 'FullImage');
      }
      if (IMode === ImageMode.Thumbnail || IMode === ImageMode.Both) {
        const StrValidThumbnail_NameAndPath = Thumb_Folder_Path + '/' + RealImageName;
        rmIfExists(StrValidThumbnail_NameAndPath);
        await ResizeImage(StrValidThumbnail_NameAndPath, 0.25, filesize, bytes, 'ThumbNail');
      }
    } else {
      RealImageName = ImageBase64Code.replace(/^\/+/, '');
    }
  } else if (ImageBase64Code.trim() !== '' && !ImageBase64Code.includes('base64,')) {
    RealImageName = path.win32.basename(ImageBase64Code.trim());
  }
  return RealImageName;
}

// Master Method For Upload Image (no try/catch - exceptions propagate)
async function ImageUploadMasterMethod(ImageBase64Code, Orginial_Folder_Name, Thumb_Folder_Name, IMode, IdForAppend) {
  let RealImageName = '';
  if (ImageBase64Code.trim() !== '') {
    let Base64String = '';
    if (ImageBase64Code !== '') {
      Base64String = ImageBase64Code;
      RealImageName = IdForAppend + '_' + newImageNumber() + '.jpg';
    } else {
      RealImageName = ' ';
    }
    if (Base64String.includes('base64,')) {
      const { bytes } = parseDataUri(Base64String);
      assertImage(bytes);
      const filesize = bytes.length / 1024; void filesize;
      const StrValidFull_NameAndPath = mapPath(Orginial_Folder_Name) + '/' + RealImageName;
      const StrValidThumbnail_NameAndPath = mapPath(Thumb_Folder_Name) + '/' + RealImageName;
      rmIfExists(StrValidFull_NameAndPath);
      rmIfExists(StrValidThumbnail_NameAndPath);
      if (IMode === ImageMode.Original || IMode === ImageMode.Both) await GetImageName(StrValidFull_NameAndPath, bytes, 1);
      if (IMode === ImageMode.Thumbnail || IMode === ImageMode.Both) await GetImageName(StrValidThumbnail_NameAndPath, bytes, 0.25);
    } else {
      RealImageName = ImageBase64Code.replace(/^\/+/, '');
    }
  }
  return RealImageName;
}

// Orginial_Folder_Path / Thumb_Folder_Path are physical folders (callers already mapped them)
async function UploadImageFromExtractProcess(ByteArray, Orginial_Folder_Path, Thumb_Folder_Path, IMode, RealImageName) {
  const filesize = ByteArray.length / 1024;
  assertImage(ByteArray);
  if (IMode === ImageMode.Original || IMode === ImageMode.Both) {
    const StrValidFull_NameAndPath = Orginial_Folder_Path + '/' + RealImageName;
    rmIfExists(StrValidFull_NameAndPath);
    await ResizeImage(StrValidFull_NameAndPath, 1, filesize, ByteArray, 'FullImage');
  }
  if (IMode === ImageMode.Thumbnail || IMode === ImageMode.Both) {
    const StrValidThumbnail_NameAndPath = Thumb_Folder_Path + '/' + RealImageName;
    rmIfExists(StrValidThumbnail_NameAndPath);
    await ResizeImage(StrValidThumbnail_NameAndPath, 0.25, filesize, ByteArray, 'ThumbNail');
  }
  return RealImageName;
}

// ---------------------------------------------------------------- mail
// SMTP: CompanyMailServer (port 25) with CompanyInfoEmailId / CompanyMailPassword. Recipient/From errors are not caught (like the C#).
async function Send(from, to, cc, bcc, subject, body) {
  const C = CS();
  const username = '' + s_(C.CompanyInfoEmailId) + '';
  const pass = '' + s_(C.CompanyMailPassword) + '';
  const host = '' + s_(C.CompanyMailServer) + '';
  from = '' + s_(C.CompanyInfoEmailId) + '';
  if (from === '') {
    const v = config.app.CompanyInfoEmailId;
    if (v === undefined || v === null) throw NRE();
    from = String(v);
  }
  const msg = { subject, html: body, from: mailAddress(from) };
  plainRecipients(msg, to, cc, bcc);
  mailAddress(from);
  return smtpSend({ host, port: 25, user: username, pass, message: msg });
}

// PORT-NOTE: SmtpClient.Timeout = int.MaxValue => nodemailer default timeouts.
async function SendEmailByApiSetting(user, password, hostname, FromEmailId, BCC_EmailId, CC_EmailId, ToEmailId, Subject, BodyMessage, fileUploader = null, SenderId = '', SenderName = '') {
  try {
    const msg = { subject: Subject, html: BodyMessage };
    if (fileUploader !== null && fileUploader !== undefined) {
      const fileName = path.win32.basename(fileUploader.originalname || fileUploader.filename || fileUploader.FileName || '');
      msg.attachments = [{ filename: fileName, content: fileUploader.buffer }];
    }
    msg.from = (SenderId === '' || SenderName === '') ? mailAddress(FromEmailId) : mailAddress(SenderId, SenderName);
    applyRecipients(msg, ToEmailId, CC_EmailId, BCC_EmailId);
    return await smtpSend({ host: s_(hostname), port: 25, user, pass: password, message: msg });
  } catch (ex) {
    return String(ex.message);
  }
}

// FromEmailId and host are blanked: without SenderId/SenderName `new MailAddress("")` throws (uncaught); otherwise "The SMTP host was not specified." is returned.
async function SendMsgOnEmail(FromEmailId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage, SenderId = '', SenderName = '') {
  const username = ''; const pass = ''; const host = '';
  FromEmailId = '';
  const msg = { subject: Subject, html: BodyMessage };
  msg.from = (SenderId === '' || SenderName === '') ? mailAddress(FromEmailId) : mailAddress(SenderId, SenderName);
  applyRecipients(msg, ToEmailId, CC_EmailId, BCC_EmailId);
  return smtpSend({ host, port: 25, user: username, pass, message: msg });
}

// Account from tbl_companySettings (PMID=1), port AppSettings["CompanyMailServerPort"].
async function CheckAndSendMsgOnEmail(UserId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage, SenderId = '', SenderName = '', FromEmailId = '', DID = 0) {
  let username = ''; let pass = ''; let host = '';
  FromEmailId = '';
  const smtp = config.app.CompanyMailServerPort;
  if (smtp === undefined || smtp === null) throw NRE(); // .ToString()
  const Consmtp = toInt32(smtp);
  const item = await companyMailRow();
  if (item) {
    username = item.companyinfoemailid; pass = item.companymailpassowrd; host = item.companymailserver; FromEmailId = item.companyinfoemailid;
  }
  const msg = { subject: Subject, html: BodyMessage };
  msg.from = (SenderId === '' || SenderName === '') ? mailAddress(FromEmailId) : mailAddress(SenderId, SenderName);
  applyRecipients(msg, ToEmailId, CC_EmailId, BCC_EmailId);
  checkPort(Consmtp);
  return smtpSend({ host: s_(host), port: Consmtp, user: s_(username), pass: s_(pass), message: msg });
}

// Cancel-order mail. Type set => tbl_companySettings account, otherwise CompanySettings. Port = Convert.ToInt32(AppSettings["CompanyMailServerPort"]) (null => 0 => throws).
async function SendEmail(from, to, cc, bcc, subject, body, Type = '') {
  let username = ''; let pass = ''; let host = '';
  from = '';
  const Consmtp = toInt32(config.app.CompanyMailServerPort, true);
  if (Type !== '' && Type !== null && Type !== undefined) {
    const item = await companyMailRow();
    if (item) {
      username = item.companyinfoemailid; pass = item.companymailpassowrd; host = item.companymailserver; from = item.companyinfoemailid;
    }
  } else {
    const C = CS();
    username = '' + s_(C.CompanyInfoEmailId) + '';
    pass = '' + s_(C.CompanyMailPassword) + '';
    host = '' + s_(C.CompanyMailServer) + '';
    from = '' + s_(C.CompanyInfoEmailId) + '';
  }
  const msg = { subject, html: body, from: mailAddress(from) };
  plainRecipients(msg, to, cc, bcc);
  mailAddress(from);
  checkPort(Consmtp);
  return smtpSend({ host: s_(host), port: Consmtp, user: s_(username), pass: s_(pass), message: msg });
}

// ---------------------------------------------------------------- SMS
// TBL_COMPANYSETTINGS(PMID=1).SMSAPI + MobileNo + "&msg=" + Message
async function SendMsgOnMobile(MobileNo, Message) {
  let res = 0;
  let CompanySMSAPI = ''; let Baseurl = '';
  try {
    CompanySMSAPI = await scalar(DB, "select coalesce(smsapi,'') from tbl_companysettings where pmid=1 limit 1");
    Baseurl = s_(CompanySMSAPI) + s_(MobileNo) + '&msg=' + s_(Message);
    await httpGet(Baseurl);
    res = 1;
  } catch (ex) {
    res = 0;
  }
  return res;
}

async function SendSMSOnMobile(MobileNo, Message, type = '') {
  let res = 0;
  let CompanySMSAPI = ''; let baseurl = '';
  try {
    if (type !== '' && type !== null && type !== undefined) {
      CompanySMSAPI = await scalar(DB, "select coalesce(smsapi,'') from tbl_companysettings where pmid=1 limit 1");
      baseurl = s_(CompanySMSAPI) + s_(MobileNo) + '&msg=' + s_(Message);
      await httpGet(baseurl);
      res = 1;
    } else {
      const need = (k) => { const v = config.app[k]; if (v === undefined || v === null) throw NRE(); return String(v); };
      CompanySMSAPI = need('CompanySMSAPI');
      const CompanySMSAPIUSERNAME = need('CompanySMSAPIUSERNAME');
      const CompanySMSAPIPASSWORD = need('CompanySMSAPIPASSWORD');
      const CompanySMSAPISENDERID = need('CompanySMSAPISENDERID');
      baseurl = CompanySMSAPI + 'username=' + CompanySMSAPIUSERNAME + '&pass=' + CompanySMSAPIPASSWORD + '&senderid=' + CompanySMSAPISENDERID + '&dest_mobileno=' + MobileNo + '&message=' + Message + '&response=Y';
      await httpGet(baseurl);
      res = 1;
    }
  } catch (e) {
    res = 0;
  }
  return res;
}

// [db_affiliate].[dbo].[TBL_SMSAPI] / [TBL_SMSACTION] (DB reads are outside the try, like the C#)
async function SendSMSWithAPI(mobileNo, message, tempid, ApiType = '0') {
  let API = '';
  const objapidata = mapRows(await query('affiliate', 'select said, prom_api, tran_api from tbl_smsapi'), ['SAID', 'Prom_API', 'Tran_API']);
  const PromoAPI = objapidata.length ? objapidata[0].Prom_API : null;
  const TranAPI = objapidata.length ? objapidata[0].Tran_API : null;
  const tempID = await scalar('affiliate', 'select templateid from tbl_smsaction where id=@id limit 1', { id: tempid });
  try {
    if (ApiType === '1') {
      if (TranAPI === null || TranAPI === undefined) throw NRE();
      API = rep(TranAPI, '1111111111', mobileNo);
      API = rep(API, 'DummyText', message);
      API = rep(API, '1707170954062540965', tempID);
      await httpGet(API);
    } else {
      if (PromoAPI === null || PromoAPI === undefined) throw NRE();
      API = rep(PromoAPI, '1111111111', mobileNo);
      API = rep(API, 'DummyText', message);
      await httpGet(API);
    }
    return 'SMS Sent Successfully';
  } catch (ExpObj) {
    return 'SMS Sending Fail';
  }
}

// [db_affiliate].[dbo].[Usp_SendDynamicSmsAction]
// PORT-NOTE: the legacy SQL text ended with ",PasswordType" (no "@"), so SQL Server received the literal string 'PasswordType'; reproduced.
async function FindingSmsContentWithUserIdPassword(empname, msg, userid, password, mode, SponsorUserName = '', MemberName = '', CreditAmt = 0, DebitAmt = 0, Plid = 0, Toplid = 0, TransactionPass = '', PasswordType = '') {
  const row = await procOne('affiliate', 'usp_senddynamicsmsaction', {
    plid: Plid, toplid: Toplid, mode, empname, message: msg, userid, password,
    sponsorusername: SponsorUserName, membername: MemberName, debitamount: DebitAmt, creditamount: CreditAmt, passwordtype: 'PasswordType',
  });
  return outValue(row, 'Result');
}

// ---------------------------------------------------------------- growth / tracking
// instance method. Session["CURRENCYCODE"] (unused local) is read through the portal session when `req` is given (SESSION.md 6).
async function SendGrowthInMobile(Message, req) {
  let Currency = '';
  if (req) { const v = require('../../modules/portal/_shared/portal-session').sessionGet(req, 'CURRENCYCODE'); Currency = s_(v); }
  void Currency;
  const Lim = mapRows(await query(DB, `select M.mobile,M.LoginId,MP.currentIncome as totalIncome,
       case  when G.Updated_DailyGrowth_Rate>G.DailyGrowth_Rate then Updated_DailyGrowth_Rate else DailyGrowth_Rate
       end as  DailyReturn from member_Master M,tbl_GrowthMaster G,tbl_DailyGrowthAccount D,Member_Performance MP where
        G.RegNo=M.regNo and D.GMID=G.GMID and fun_getCurrentDate()::date=d.toDate::date
        and MP.regno=M.regNo and M.mobile<>'' and M.Active::int=1  and G.CurrentReturn<G.MaxReturn  and MP.currentIncome>0`), ['mobile', 'LoginId', 'totalIncome', 'DailyReturn']);
  for (const Item of Lim) {
    const TodayGrowth = Number(Item.DailyReturn);
    const Msg = 'Dear user, your account ID ' + Item.LoginId + ' is credited by ' + (TodayGrowth < 0 ? '-' : '') + String(Math.round(Math.abs(TodayGrowth))) + 'points. ';
    await SendMsgOnMobile(Item.mobile, Msg);
  }
}

// instance method: Usp_UpdaetGrowth @RegNo,@strResult out
async function UpdateGrowthByGlobal(req) {
  const row = await procOne(DB, 'usp_updaetgrowth', { regno: '0' });
  const OutputResult = outValue(row, 'strResult');
  if (OutputResult === 'ok') {
    fire(async () => {
      await M.CreateAutoWithdrawal_ROI();
      await SendGrowthInMobile('ok', req);
    });
  }
}

async function TrackCustomersMessages(mobileNo, Message, process) {
  try {
    await exec(DB, 'insert into tbl_customers_messages (mobileno,otp,process) values (@m, @o, @p)', { m: mobileNo, o: Message, p: process });
  } catch (ex) { /* swallowed */ }
}

// DBO.USP_CUSTOMERS_REGISTRATION_EMAIL @EMAILID,@MAILBODY,@PROCESS,@STROUTPUT OUT (output unused)
async function TrackCustomersEmails(emailId, mailBody, process) {
  try {
    const row = await procOne(DB, 'usp_customers_registration_email', { emailid: emailId, mailbody: mailBody, process });
    const OutputResult = outValue(row, 'STROUTPUT'); void OutputResult;
  } catch (ex) { /* swallowed */ }
}

async function TrackError(ErrorMsg) {
  try {
    await exec(DB, 'insert into tbl_errorlog (description,errortime,status) values (@ErrorMsg, fun_getcurrentdate(), 1)', { ErrorMsg });
  } catch (ex) { /* swallowed */ }
}

async function TrackOTP(mobileNo, OTP, process) {
  try {
    await exec(DB, 'insert into tbl_customers_otp (mobileno,otp,process) values (@m, @o, @p)', { m: mobileNo, o: OTP, p: process });
  } catch (ex) { /* swallowed */ }
}

// ---------------------------------------------------------------- KYC reminder jobs (background threads)
// PORT-NOTE: EF `Db._kyc.Where(a => a.CLID == Regno ...)` maps to column KYC.CLID, which does not exist in the Db_Shopping dump
// (the table has Regno). Kept as `clid` like the C#: the query fails and the error is swallowed (Ret = ex.Message) exactly as the legacy job did.
function _kycReminderLoop(opts) {
  return async () => {
    let Ret = '';
    try {
      const C = CS();
      const ObjkycRecords = mapRows(await proc(DB, 'usp_auto_kyc', opts.procArgs), ['PLid', 'Fname']);
      for (let i = 0; i < ObjkycRecords.length; i++) {
        const Regno = ObjkycRecords[i].PLid;
        const row = await queryOne(DB, 'select * from kyc where clid=@Regno and kyctype=@kycType limit 1', { Regno, kycType: opts.kycType });
        if (row === null) {
          const row1 = await queryOne(DB, 'select * from portal_login where plid=@Regno limit 1', { Regno });
          if (row1 === null) throw NRE();
          const MemName = row1.fname;
          const msgForMobile = opts.mobileMsg(MemName, C);
          const username = row1.username;
          const Emailid = row1.emailid;
          const Mobile = row1.phone;
          let send = 0;
          try {
            const subject = '' + s_(C.CompanyName) + ' Support Center';
            if (send === 0) {
              let mailtxt = opts.template;
              mailtxt = rep(mailtxt, '$$lblName$$', username);
              mailtxt = rep(mailtxt, '$$CompanyDomain$$', C.CompanyDomain);
              mailtxt = rep(mailtxt, '$$CompanyURL$$', C.CompanyURL);
              mailtxt = rep(mailtxt, '$$CompanyName$$', C.CompanyName);
              mailtxt = rep(mailtxt, '$$CompanyResellerURL$$', C.CompanyResellerURL);
              mailtxt = rep(mailtxt, '$$CompanySupportEmailID$$', C.CompanySupportEmailId);
              const result = await SendMailLib().Send1('', Emailid, '', '', subject, mailtxt);
              if (result === 's') send = 1;
              else return;
              await SendMsgOnMobile(Mobile, msgForMobile);
            }
          } catch (exp) {
            Ret = exp.message;
          }
        }
      }
    } catch (ex) {
      Ret = ex.message;
    }
    void Ret;
  };
}

async function Auto_Mail() {
  fire(_kycReminderLoop({
    procArgs: { regno: 0 },
    kycType: 1,
    template: TPL.AUTOMAIL,
    mobileMsg: (MemName, C) => 'Dear ' + s_(MemName) + ',\r\nWe request you to submit your KYC documents as soon as possible Thank you.\r\n The ' + s_(C.CompanyName) + ' Team',
  }));
}

async function BusinessKYC_Auto_Mail() {
  fire(_kycReminderLoop({
    procArgs: { regno: 0, mode: 1 },
    kycType: 2,
    template: TPL.BIZMAIL,
    mobileMsg: (MemName, C) => 'Dear ' + s_(MemName) + ',\r\n We request you to submit your Business KYC documents as soon as possible Thank you.\r\n The ' + s_(C.CompanyName) + ' Team',
  }));
}

// HttpContext => Express req: "{scheme}://{authority}{ApplicationPath.TrimEnd('/')}/"  (application root = "/")
function GetBaseUrl(context) {
  const request = context.req || context;
  const baseUrl = request.protocol + '://' + request.get('host') + '' + '/';
  return baseUrl;
}

// ---------------------------------------------------------------- classes
class DatabaseDate { constructor(init) { this.CurrentDate = null; Object.assign(this, init); } }
class EwalletDetails { constructor(init) { Object.assign(this, init); } }
class UserTypes { constructor(init) { this.UserTypeMem = null; Object.assign(this, init); } }
class Kyc_Record { constructor(init) { this.PLid = 0; this.Fname = null; Object.assign(this, init); } }
class apidata { constructor(init) { this.SAID = 0; this.Prom_API = null; this.Tran_API = null; Object.assign(this, init); } }
class EmailAuthentication { constructor(init) { this.COMPANYINFOEMAILID = null; this.COMPANYMAILPASSOWRD = null; this.COMPANYMAILSERVER = null; Object.assign(this, init); } }

const members = {
  // fields / enums / classes
  SpecialCharsForLoginID, MessageType, ReferralStatus, SelectBranchType, RoleUserType, SeclectUserType, SelectAddressType, ImageMode,
  DatabaseDate, EwalletDetails, UserTypes, Kyc_Record, apidata, EmailAuthentication,
  // identical to the Merchant Panel C#
  RandomNumberStringByLength: M.RandomNumberStringByLength, GetCurrentDate: M.GetCurrentDate, ExchangeRateFromAPI: M.ExchangeRateFromAPI,
  Generatehash512: M.Generatehash512, GetDataSet: M.GetDataSet, Generatetxnid: M.Generatetxnid, CreateAutoWithdrawal: M.CreateAutoWithdrawal,
  CreateAutoWithdrawal_ROI: M.CreateAutoWithdrawal_ROI, DecimalToWords: M.DecimalToWords, Encryptword: M.Encryptword,
  GenerateRandomNumber: M.GenerateRandomNumber, Getimageformate: M.Getimageformate, GetRandom: M.GetRandom, getRandomName: M.getRandomName,
  GridNumbersPerPage: M.GridNumbersPerPage, GridPageSize: M.GridPageSize, NumberToText: M.NumberToText, NumberToWords: M.NumberToWords,
  RandomString: M.RandomString, saveImage: M.saveImage, CreateImage: M.CreateImage, ValidateInt: M.ValidateInt, ValidateInt64: M.ValidateInt64,
  GetDatabaseDate: M.GetDatabaseDate, GetEwalletCurrentBalace: M.GetEwalletCurrentBalace, GetTransCondition: M.GetTransCondition,
  Maintain_Manipulation: M.Maintain_Manipulation, removeSpacesAndSpecialChars: M.removeSpacesAndSpecialChars,
  SendMsgToMobileWithSelfAccount: M.SendMsgToMobileWithSelfAccount, ToOrdinal: M.ToOrdinal, GetColorcode: M.GetColorcode,
  RandomDigits: M.RandomDigits, BlastCampaign: M.BlastCampaign, GetDataSetSPNamed: M.GetDataSetSPNamed, SizeSuffix: M.SizeSuffix,
  // portal ports
  RandomStringByLength, sessioncheck, ImageUploadMasterMethodEComm, ImageUploadMasterMethod, UploadImageFromExtractProcess, ResizeImage,
  CreateCustomPagging_ServerSide, Decryptword, Send, SendGrowthInMobile, UpdateGrowthByGlobal, TrackCustomersMessages, TrackCustomersEmails,
  TrackError, TrackOTP, SendEmailByApiSetting, SendMsgOnEmail, SendMsgOnMobile, CheckAndSendMsgOnEmail, Auto_Mail, BusinessKYC_Auto_Mail,
  SendEmail, SendSMSOnMobile, SendSMSWithAPI, FindingSmsContentWithUserIdPassword, GetBaseUrl,
};

class UtilityClass {}
Object.assign(UtilityClass, members);
for (const [k, v] of Object.entries(members)) {
  if (typeof v === 'function' && !/^class\s/.test(Function.prototype.toString.call(v))) UtilityClass.prototype[k] = v;
}

module.exports = UtilityClass;
