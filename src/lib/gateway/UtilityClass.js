/** Exports (Payment Gateway Models/UtilityClass.cs; object = { ...src/lib/merchant/UtilityClass, ...gateway overrides/ports }):
 *  Database: 'shopping' (gateway Web.config DataBaseContext / ConnectionString = Db_Shopping). Async unless marked [sync].
 *  fields/enums: SpecialCharsForLoginID[], MessageType, SelectBranchType, RoleUserType, SeclectUserType, SelectAddressType (merchant/shared, identical)
 *    ImageMode {Thumbnail:0, Original:1, Both:2}  (GATEWAY enum - differs from the merchant {Thumbnail,SemiLarge,Original,Both})
 *  classes: DatabaseDate, EwalletDetails, UserTypes, Kyc_Record (shared/merchant, identical) ; apidata {SAID, Prom_API, Tran_APIV} ; Mobile (private in C#)
 *  --- shared from src/lib/merchant/UtilityClass (C# identical): RandomNumberStringByLength(length) [sync] ; GetCurrentDate() [sync] ; ExchangeRateFromAPI() | (amount, firstCcode, lastCcode)
 *    Generatehash512(text) ; GetDataSet(strSql) ; Generatetxnid() ; DecimalToWords(d) [sync] ; Decryptword(DecryptText) [sync] ; Encryptword(Encryptval) [sync]
 *    GenerateRandomNumber() [sync] ; Getimageformate(imgBuffer) [sync] ; GetRandom(min, max) [sync] ; getRandomName() [sync] ; GridNumbersPerPage() [sync] ; GridPageSize() [sync]
 *    NumberToText(number, isUK) [sync] ; NumberToWords(number) [sync] ; RandomString(length) [sync] ; saveImage(imgecode, titlename, FolderName) ; CreateImage(base64String, fullpathpath, imagename)
 *    ValidateInt(Input) [sync] ; ValidateInt64(Input) [sync] ; removeSpacesAndSpecialChars(stringvalue) [sync] ; SendMsgToMobileWithSelfAccount(Api) : int ; ToOrdinal(value) [sync]
 *    RandomDigits(length) [sync] ; GetDataSetSPNamed(arrParam, strSPName, tblName) ; SizeSuffix(value) [sync]
 *  --- shared from src/lib/UtilityClass (ClusterOfferAPI port; same tables in Db_Affiliate as the gateway's explicit [db_affiliate].[DBO] prefix):
 *    SendSMSWithAPI(mobileNo, message, ApiType="0") : "SMS Sent Successfully" | "SMS Sending Fail" ; SaveSMSHistory(mobile, message, status) : int
 *  --- shared from src/lib/franchise/UtilityClass (C# identical, no DB):
 *    SendEmailByApiSetting(user, password, hostname, FromEmailId, BCC_EmailId, CC_EmailId, ToEmailId, Subject, BodyMessage, fileUploader{originalname,buffer}|null, SenderId="", SenderName="") : string
 *    SendMsgOnEmail(FromEmailId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage, SenderId="", SenderName="") : string
 *  --- gateway overrides / ports:
 *    RandomStringByLength(length) [sync] (A-Z0-9) ; sessioncheck(Session_id, Plid) : int
 *    ImageUploadMasterMethodEComm(ImageBase64Code, OriginalImage, ThumbNailImage, IMode, IdForAppend) : string
 *    ImageUploadMasterMethod(ImageBase64Code, Orginial_Folder_Name, Thumb_Folder_Name, IMode, IdForAppend) : string
 *    UploadImageFromExtractProcess(ByteArray:Buffer, Orginial_Folder_Path, Thumb_Folder_Path, IMode, RealImageName) : string
 *    ResizeImage(FullName, scaleFactor, filesize(KB), fromstream:Buffer, Folder) : void
 *    CreateCustomPagging_ServerSide(ControllerWithAction, QueryString, TotalRecord, PageSize, NumbersPerPage, CurrentPageIndex) : string [sync]
 *    CheckAndSendMsgOnEmail(UserId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage, SenderId="", SenderName="", FromEmailId="") : string
 *    CheckAndSendMsgOnMobile(UserId, MobileNo, Message) : string ; Decryptword(id:int) overload => throws NotImplementedException (string arg => shared)
 *  NOTE: merchant-only members not in the gateway C# (ImageUploadMasterMethodECommNew, CallBackAddress, Auto_Mail, ...) stay reachable through the spread; the
 *        gateway controllers do not call them.
 *  PORT-NOTE: Server.MapPath(x) => config.uploadDir/<x without leading ~ / ./ ../ and slashes> (same as the merchant port).
 *  PORT-NOTE: System.Drawing => `sharp` (lazily required). Without it images are written unchanged.
 *  PORT-NOTE: background Thread (CheckAndSendMsgOnMobile) => fire-and-forget promise (error logged instead of crashing the process).
 *  Config keys: CompanyInfoEmailId, CompanyMailPassword, CompanyMailServer (CheckAndSendMsgOnEmail) ; SmsJustPassword (CheckAndSendMsgOnMobile) ; uploadDir.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const config = require('../../config');
const { proc } = require('../../db');
const { fire } = require('../_libhelpers');
const { mailAddress, smtpSend } = require('../franchise/_mailhelpers');
const Base = require('../merchant/UtilityClass');
const Shared = require('../UtilityClass');
const Franchise = require('../franchise/UtilityClass');

const DB = 'shopping';

// ---------------------------------------------------------------- enums / classes that differ from the merchant port
const ImageMode = { Thumbnail: 0, Original: 1, Both: 2, 0: 'Thumbnail', 1: 'Original', 2: 'Both' };

class apidata { constructor(init) { this.SAID = 0; this.Prom_API = null; this.Tran_APIV = null; Object.assign(this, init); } }
// private class Mobile in the C# (unused) - kept for completeness
class Mobile { constructor(init) { this.DailyReturn = 0; this.LoginId = null; this.mobile = null; this.totalIncome = 0; Object.assign(this, init); } }

// ---------------------------------------------------------------- private helpers (same semantics as the merchant port's internal helpers)
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const s_ = (v) => (v === null || v === undefined ? '' : String(v));
const rep = (s, k, v) => String(s).split(k).join(v === null || v === undefined ? '' : String(v));
// Convert.ToInt32(double): banker's rounding
function bankers(x) {
  const f = Math.floor(x); const d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}
// Server.MapPath
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
// Convert.FromBase64String
function csFromBase64(s) {
  const t = s.replace(/[ \t\r\n]/g, '');
  if (t.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(t)) throw new Error('The input is not a valid Base-64 string as it contains a non-base 64 character, more than two padding characters, or an illegal character among the padding characters.');
  return Buffer.from(t, 'base64');
}
function sniffFormat(b) { // System.Drawing decoders: bmp, gif, jpeg, png, tiff
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length > 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length > 4 && b.slice(0, 4).toString('latin1') === 'GIF8') return 'gif';
  if (b.length > 2 && b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  if (b.length > 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a))) return 'tiff';
  return null;
}
// Image.FromStream throws "Parameter is not valid." for non-images
function assertImage(b) { if (!sniffFormat(b)) throw new Error('Parameter is not valid.'); }
let _sharp;
function sharp() { // lazy dependency
  if (_sharp === undefined) { try { _sharp = require('sharp'); } catch (e) { _sharp = null; } }
  return _sharp;
}
function writeFile(file, buf) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf); }
function rmIfExists(file) { if (fs.existsSync(file)) fs.unlinkSync(file); }
// Generator.Next(100000, 1000000) + the legacy sanitising
function newImageNumber() {
  let Image = String(crypto.randomInt(100000, 1000000));
  Image = Image.trim();
  Image = rep(Image, '&amp;', 'And');
  Image = rep(Image, '&', ' And ');
  Image = Image.replace(/[^\w\d]/g, '');
  Image = rep(Image, ' ', '-');
  return Image;
}
// data-URI parsing exactly like the C# (IndexOf("/"), IndexOf(";"), IndexOf(","))
function parseDataUri(Base64String) {
  const IndexNo = Base64String.indexOf('/') + 1;
  const lastIndexNo = Base64String.indexOf(';');
  const ImageExt = csSubstring(Base64String, IndexNo, lastIndexNo - IndexNo);
  const IndexNo1 = Base64String.indexOf(',') + 1;
  const Pathlength1 = Base64String.length;
  const b64 = csSubstring(Base64String, IndexNo1, Pathlength1 - IndexNo1);
  return { ImageExt, bytes: csFromBase64(b64) };
}
// System.Uri escaping of a raw concatenated URL (spaces, CR/LF, non-ASCII...; existing %xx kept)
const uriEscape = (u) => s_(u).replace(/[^A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]/gu, (c) => encodeURIComponent(c));
// HttpWebRequest.GetResponse (throws on non-2xx; body ignored)
async function httpGet(url) {
  await axios.get(uriEscape(url), { responseType: 'text', transformResponse: [(d) => d], maxRedirects: 50, timeout: 100000 });
}
const EMAIL_RE = /^([\w.\-]+)@([\w\-]+)((\.(\w){2,3})+)$/;
function validAddrs(csv) { // MailAddressCollection.Add(item) for items matching the legacy regex after TrimStart().TrimEnd()
  const out = [];
  for (const a of csv.split(',')) {
    if (EMAIL_RE.test(a.trim()) && a !== '') out.push(mailAddress(a));
  }
  return out;
}
function applyRecipients(msg, ToEmailId, CC_EmailId, BCC_EmailId) {
  if (ToEmailId !== '') { const l = validAddrs(ToEmailId); if (l.length) msg.to = l; }
  if (CC_EmailId !== '') { const l = validAddrs(CC_EmailId); if (l.length) msg.cc = l; }
  if (BCC_EmailId !== '') { const l = validAddrs(BCC_EmailId); if (l.length) msg.bcc = l; }
}

// ---------------------------------------------------------------- gateway methods
// chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" (the merchant/shared versions differ or do not exist)
function RandomStringByLength(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let r = '';
  for (let i = 0; i < length; i++) r += chars[crypto.randomInt(0, chars.length)];
  return r;
}

// legacy: db.Database.SqlQuery<Int32>("USP_SESSIONSERVICESFORANROID @SESSIONID,@STATUS,@ACTIVE,@MODE,@INTRESULT OUT,@PLID", ...).FirstOrDefault()
// PORT-NOTE: the T-SQL call passes the arguments by POSITION; in Db_Shopping the 6th parameter is @CLID (not @PLID), so Plid is bound to `clid`.
//            @INTRESULT is an OUT parameter and is not sent. Mode 2 returns "SELECT 1" rows => 1, no row => 0 (FirstOrDefault).
async function sessioncheck(Session_id, Plid) {
  if (Session_id === null || Session_id === undefined) throw NRE(); // Session_id.ToString()
  const rows = await proc(DB, 'usp_sessionservicesforanroid', { sessionid: String(Session_id), status: '1', active: '1', mode: '2', clid: Plid });
  const r = rows[0];
  if (!r) return 0;
  const keys = Object.keys(r);
  const k = keys.find((x) => x !== 'intresult');
  if (k === undefined) return 0; // only the OUT parameter came back => the procedure produced no result set
  const v = r[k];
  if (v === null || v === undefined) throw new Error("The cast to value type 'System.Int32' failed because the materialized value is null. Either the result type's generic parameter or the query must use a nullable type.");
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error('Specified cast is not valid.');
  return n;
}

// private static void GetImageName(...): newWidth/newHeight computed (radio = int/int => DivideByZeroException when newHeight == 0), then Img.Save(path)
async function GetImageName(StrValidFull_NameAndPath, bytes, scaleFactor) {
  const sh = sharp();
  if (sh) {
    const meta = await sh(bytes).metadata();
    const newHeight = Math.trunc(meta.height * scaleFactor);
    if (newHeight === 0) throw new Error('Attempted to divide by zero.');
  }
  writeFile(StrValidFull_NameAndPath, bytes); // Img.Save(path): same image, same (raw) format
}

// public static void ResizeImage(...) - GATEWAY version: > 6 KB => scale by scaleFactor; "ThumbNail" => JPEG thumbnail; else source format.
// PORT-NOTE: the legacy code juggled MemoryStreams (for non-thumbnail folders it appended the re-encoded bitmap to the original, non-expandable
//            MemoryStream and re-read it). That is approximated as: the image scaled to (int)(w*scaleFactor) x (int)(h*scaleFactor) is written to
//            FullName, JPEG for "ThumbNail", otherwise in the source format (BMP sources, which sharp cannot write, are written as PNG).
//            Whether the legacy non-thumbnail branch actually threw "Memory stream is not expandable." depends on GDI+ stream positioning
//            and is NOT reproduced.
async function ResizeImage(FullName, scaleFactor, filesize, fromstream, Folder) {
  assertImage(fromstream); // Image image = Image.FromStream(fromstream);
  if (filesize > 6) {
    const sh = sharp();
    if (!sh) { writeFile(FullName, fromstream); return; } // PORT-NOTE: sharp unavailable - bytes saved unchanged
    const meta = await sh(fromstream).metadata();
    const newWidth = Math.trunc(meta.width * scaleFactor);
    const newHeight = Math.trunc(meta.height * scaleFactor);
    if (newWidth <= 0 || newHeight <= 0) throw new Error('Parameter is not valid.'); // new Bitmap(0, h)
    let pipeline = sh(fromstream).resize(newWidth, newHeight, { fit: 'fill' });
    if (Folder === 'ThumbNail') {
      pipeline = pipeline.flatten({ background: '#000000' }).jpeg(); // thumb.Save(tomemorystream, ImageFormat.Jpeg)
    } else {
      const fmt = sniffFormat(fromstream); // image.RawFormat
      pipeline = fmt === 'bmp' ? pipeline.png() : pipeline.toFormat(fmt);
    }
    writeFile(FullName, await pipeline.toBuffer()); // Imgnew.Save(FullName)
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
      let filesize = bytes.length;
      filesize = filesize / 1024;
      let scaleFactor = 0;
      assertImage(bytes); // Image imgs = Image.FromStream(ms)
      if (IMode === ImageMode.Original || IMode === ImageMode.Both) {
        scaleFactor = 1;
        const StrValidFull_NameAndPath = Orginial_Folder_Path + '/' + RealImageName;
        rmIfExists(StrValidFull_NameAndPath);
        await ResizeImage(StrValidFull_NameAndPath, scaleFactor, filesize, bytes, 'FullImage');
      }
      if (IMode === ImageMode.Thumbnail || IMode === ImageMode.Both) {
        scaleFactor = 0.25;
        const StrValidThumbnail_NameAndPath = Thumb_Folder_Path + '/' + RealImageName;
        rmIfExists(StrValidThumbnail_NameAndPath);
        await ResizeImage(StrValidThumbnail_NameAndPath, scaleFactor, filesize, bytes, 'ThumbNail');
      }
    } else {
      RealImageName = ImageBase64Code.replace(/^\/+/, '');
    }
  } else if (ImageBase64Code.trim() !== '' && !ImageBase64Code.includes('base64,')) {
    RealImageName = path.win32.basename(ImageBase64Code.trim());
  }
  return RealImageName;
}

// Master Method For Upload Image (gateway: Original scale 1, Thumbnail scale 0.25, both through GetImageName; no try/catch => exceptions propagate)
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
      assertImage(bytes); // System.Drawing.Image.FromStream(ms)
      let filesize = bytes.length;
      filesize = filesize / 1024;
      const StrValidFull_NameAndPath = mapPath(Orginial_Folder_Name) + '/' + RealImageName;
      const StrValidThumbnail_NameAndPath = mapPath(Thumb_Folder_Name) + '/' + RealImageName;
      rmIfExists(StrValidFull_NameAndPath);
      rmIfExists(StrValidThumbnail_NameAndPath);
      let scaleFactor = 0;
      if (IMode === ImageMode.Original || IMode === ImageMode.Both) {
        scaleFactor = 1;
        await GetImageName(StrValidFull_NameAndPath, bytes, scaleFactor);
      }
      if (IMode === ImageMode.Thumbnail || IMode === ImageMode.Both) {
        scaleFactor = 0.25;
        await GetImageName(StrValidThumbnail_NameAndPath, bytes, scaleFactor);
      }
    } else {
      RealImageName = ImageBase64Code.replace(/^\/+/, '');
    }
  }
  return RealImageName;
}

// C# body identical to the merchant one, but it uses the GATEWAY ImageMode enum and the GATEWAY ResizeImage => ported here.
// Orginial_Folder_Path / Thumb_Folder_Path are physical folders (callers already mapped them).
async function UploadImageFromExtractProcess(ByteArray, Orginial_Folder_Path, Thumb_Folder_Path, IMode, RealImageName) {
  let filesize = ByteArray.length;
  filesize = filesize / 1024;
  let scaleFactor = 0;
  assertImage(ByteArray); // Image imgs = Image.FromStream(ms)
  if (IMode === ImageMode.Original || IMode === ImageMode.Both) {
    scaleFactor = 1;
    const StrValidFull_NameAndPath = Orginial_Folder_Path + '/' + RealImageName;
    rmIfExists(StrValidFull_NameAndPath);
    await ResizeImage(StrValidFull_NameAndPath, scaleFactor, filesize, ByteArray, 'FullImage');
  }
  if (IMode === ImageMode.Thumbnail || IMode === ImageMode.Both) {
    scaleFactor = 0.25;
    const StrValidThumbnail_NameAndPath = Thumb_Folder_Path + '/' + RealImageName;
    rmIfExists(StrValidThumbnail_NameAndPath);
    await ResizeImage(StrValidThumbnail_NameAndPath, scaleFactor, filesize, ByteArray, 'ThumbNail');
  }
  return RealImageName;
}

// GATEWAY pager: "&&page=" when the URL already has "?", First/Last links, and ' => " (then "s => 's) on the final HTML.
function CreateCustomPagging_ServerSide(ControllerWithAction, QueryString, TotalRecord, PageSize, NumbersPerPage, CurrentPageIndex) {
  let hrefFirst = ''; let hrefLast = '';
  let href = '';
  ControllerWithAction = '/' + ControllerWithAction;
  let LoopCount = NumbersPerPage;
  const TotalPageCount = TotalRecord / PageSize;
  if (!Number.isFinite(TotalPageCount)) throw new RangeError('Value was either too large or too small for an Int32.'); // Convert.ToInt32(NaN/Infinity)
  const TotalPages = bankers(Math.ceil(TotalPageCount));
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
  const hasQ = () => ControllerWithAction.includes('?');
  const hasQs = QueryString !== '' && QueryString !== null && QueryString !== undefined;
  if (CurrentPageIndex === 1) prevClass = 'disabledli';
  if (hasQs) {
    if (hasQ()) {
      href = ControllerWithAction + '&&page=' + PrePageNo;
      hrefFirst = ControllerWithAction + '&&page=' + 1;
    } else {
      href = ControllerWithAction + '?page=' + PrePageNo + '&&' + QueryString;
      hrefFirst = ControllerWithAction + '?page=' + 1 + '&&' + QueryString;
    }
  } else if (hasQ()) {
    href = ControllerWithAction + '&&page=' + PrePageNo;
    hrefFirst = ControllerWithAction + '&&page=' + 1 + '&&' + s_(QueryString);
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
    ActiveIndex = CurrentPageIndex === CurrentPageNo ? 'pageActive' : '';
    if (hasQs) {
      if (hasQ()) href = ControllerWithAction + '&&page=' + CurrentPageNo;
      else href = ControllerWithAction + '?page=' + CurrentPageNo + '&&' + QueryString;
    } else if (hasQ()) {
      href = ControllerWithAction + '&&page=' + CurrentPageNo;
    } else {
      href = ControllerWithAction + '?page=' + CurrentPageNo;
    }
    MyPagingDiv += "<li class='" + ActiveIndex + "'><a id='" + 'liNav' + String(NumbersPerPage - LoopCount + 1)
      + "' class='" + ActiveIndex + "'  "
      + "href='" + href + "'"
      + '>' + String(CurrentPageNo) + '</a></li>';
    LoopCount -= 1;
    CurrentPageNo += 1;
    if (CurrentPageNo > TotalPages) LoopCount = 0;
  }
  if (CurrentPageNo >= TotalPages) NextClass = 'disabledli';
  if (hasQs) {
    href = ControllerWithAction + '?page=' + CurrentPageNo + '&&' + QueryString;
    hrefLast = ControllerWithAction + '?page=' + TotalPages + '&&' + QueryString;
  } else if (hasQ()) {
    href = ControllerWithAction + '&&page=' + CurrentPageNo;
    hrefLast = ControllerWithAction + '&&page=' + TotalPages + '&&' + s_(QueryString);
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
  const MyPagingDivstr = MyPagingDiv.split("'").join('"');
  const MyPagingDivme = MyPagingDivstr.split('"s').join("'s");
  return MyPagingDivme;
}

// GATEWAY: credentials/from from AppSettings (CompanyInfoEmailId / CompanyMailPassword / CompanyMailServer), SmtpClient(host) => port 25.
// MailAddress errors are thrown (outside the legacy try); only Send() errors are returned as the message.
async function CheckAndSendMsgOnEmail(UserId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage, SenderId = '', SenderName = '', FromEmailId = '') {
  const username = config.app.CompanyInfoEmailId || '';
  const pass = config.app.CompanyMailPassword || '';
  const host = config.app.CompanyMailServer || '';
  FromEmailId = config.app.CompanyInfoEmailId || '';
  const msg = { subject: Subject, html: BodyMessage }; // IsBodyHtml = true
  msg.from = (SenderId === '' || SenderName === '') ? mailAddress(FromEmailId) : mailAddress(SenderId, SenderName);
  applyRecipients(msg, ToEmailId, CC_EmailId, BCC_EmailId);
  if (SenderId === '' || SenderName === '') mailAddress(FromEmailId); else mailAddress(SenderId, SenderName); // unused MailAddress ad
  return await smtpSend({ host, port: 25, user: username, pass, message: msg });
}

// The SMS is sent on a background thread; "1" is returned immediately.
// PORT-NOTE: the legacy URL hard-coded the smsjust.com account password; it is read from config.app.SmsJustPassword (username/sender kept literal).
async function CheckAndSendMsgOnMobile(UserId, MobileNo, Message) {
  let result = '';
  result = '1'; // UpdateMessageCount(UserId, UtilityClass.MessageType.MobileSMS) is commented out in the C#
  if (result === '1' || result === '2') {
    try {
      fire(async () => {
        const Baseurl = 'http://www.smsjust.com/sms/user/urlsms.php?username=Eblaa&password=' + (config.app.SmsJustPassword || '')
          + '&type=TEXT&sender=Eblaaa&mobile=' + MobileNo + '&message=' + Message + '';
        await httpGet(Baseurl);
        result = '1';
      });
    } catch (ex) {
      result = String(ex.message);
    }
  }
  return result;
}

// C# overloads: Decryptword(string) (shared) and internal Decryptword(int id) => throw new NotImplementedException()
function Decryptword(DecryptText) {
  if (typeof DecryptText === 'number') {
    const e = new Error('The method or operation is not implemented.');
    e.name = 'NotImplementedException';
    throw e;
  }
  return Base.Decryptword(DecryptText);
}

const UtilityClass = {
  ...Base,
  // shared from the API port (identical logic, Db_Affiliate like the gateway's [db_affiliate].[DBO] prefix)
  SendSMSWithAPI: Shared.SendSMSWithAPI,
  SaveSMSHistory: Shared.SaveSMSHistory,
  // shared from the franchise port (identical C#, no DB)
  SendEmailByApiSetting: Franchise.SendEmailByApiSetting,
  SendMsgOnEmail: Franchise.SendMsgOnEmail,
  // gateway enums / classes
  ImageMode, apidata, Mobile,
  // gateway overrides / ports
  RandomStringByLength, sessioncheck, ResizeImage, ImageUploadMasterMethodEComm, ImageUploadMasterMethod, UploadImageFromExtractProcess,
  CreateCustomPagging_ServerSide, CheckAndSendMsgOnEmail, CheckAndSendMsgOnMobile, Decryptword,
};

module.exports = UtilityClass;
