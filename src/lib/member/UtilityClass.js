/** Exports (C# `public class UtilityClass`, Member app, database 'affiliate'; every method is available BOTH as static `UtilityClass.X()` and as instance `new UtilityClass().X()`; await every call, sync ones noted):
 *   fields: SpecialCharsForLoginID[], responsemessage, SizeSuffixes ; enums: MessageType, SelectBranchType, RoleUserType, SeclectUserType, SelectAddressType, ImageMode {Thumbnail:0,Original:1,Both:2}
 *   ExchangeRateFromAPI() | ExchangeRateFromAPI(amount, firstCcode, lastCcode) : decimal ; dollarToBitcoinConvertor(amount) : decimal
 *   ImageUploadMasterMethod(ImageBase64Code, Orginial_Folder_Name, Thumb_Folder_Name, IMode, IdForAppend) : string ; ImageUploadMasterMethodECommNew(ImageBase64Code, OriginalImage, IdForAppend) : string
 *   UploadImageFromExtractProcess(ByteArray:Buffer, Orginial_Folder_Path, Thumb_Folder_Path, IMode, RealImageName) : string ; ResizeImage(FullName, scaleFactor, filesize, fromstream:Buffer, Folder) ; ResizeImages(same)
 *   Generatehash512(text) [sync] ; Generatetxnid() [sync] ; GetDataSet(strSql) : {Table: rows} ; GetDataSetSPNamed(arrParam, strSPName, tblName) : {[tblName]: rows} ; GetDatabaseDate() : Date
 *   CreateAutoWithdrawal() ; CreateAutoWithdrawal_ROI() ; CreateCustomPagging_ServerSide(ControllerWithAction, QueryString, TotalRecord, PageSize, NumbersPerPage, CurrentPageIndex) : string [sync]
 *   DecimalToWords(d) [sync] ; Decryptword(DecryptText) [sync] ; Encryptword(Encryptval) [sync] ; GenerateRandomNumber() [sync] ; RandomStringByLength(length) [sync] ; RandomNumberStringByLength(length) [sync]
 *   GetCurrentDate() [sync] ; Getimageformate(imgBuffer) [sync] ; GetRandom(min, max) [sync] ; getRandomName() [sync] ; GridNumbersPerPage() [sync] ; GridPageSize() [sync] ; NumberToText(number, isUK) [sync] ; NumberToWords(number) [sync]
 *   RandomString(length) [sync] ; RandomDigits(length) [sync] ; saveImage(imgecode, titlename, FolderName) : string ; CreateImage(base64String, fullpathpath, imagename) : string ; ValidateInt(Input) [sync] ; ValidateInt64(Input) [sync]
 *   GetEwalletCurrentBalace(RegNo) : decimal ; GetTransCondition(Type) : string ; Maintain_Manipulation(Emp_Code, BrCode, created_remark) : string ; Send(from, to, cc, bcc, subject, body) : string ("s" | error message)
 *   removeSpacesAndSpecialChars(stringvalue) [sync] ; SendGrowthInMobile(Message) ; UpdateGrowthByGlobal() ; CallBackAddress(ToEmailId, Subject, EmailContent) : string
 *   SendEmailByApiSetting(user, password, hostname, FromEmailId, BCC_EmailId, CC_EmailId, ToEmailId, Subject, BodyMessage, fileUploader=null, SenderId="", SenderName="") : string ; SaveEMAILHistory(from, to, subject, message, status) : int
 *   SendMsgOnEmail(...) : string [invalid-function message] ; SendSMSWithAPI(mobileNo, message, ApiType="0") ; SendSMSWithAPIz(...) ; SendSMSWithAPINew(...) : string ; SaveSMSHistory(mobile, message, status) : int
 *   SendMsgOnMobile(MobileNo, Message) : int (0) ; FindingSmsContentWithUserIdPassword(empname, msg, userid, password, mode, SponsorUserName="", MemberName="", CreditAmt=0, DebitAmt=0, Plid=0, Toplid=0, TransactionPass="", PasswordType="") : string
 *   FindingEmailContentWithUserIdPassword(UserName, Msg, Email, Password, Mode, TransactionPass="", SponsorUserName="", plid=0, Amount=0, IFSC="", MemberName="", Toplid=0, DebitAmt=0, CreditAmt=0, passwordType="") : string
 *   SendMsgToMobileWithSelfAccount(Api) : int (0) ; CheckAndSendMsgOnEmail(...) : string [invalid-function message] ; CheckAndSendMsgOnMobile(UserId, MobileNo, Message) : "0" ; ToOrdinal(value) [sync] ; BlastCampaign() ; SizeSuffix(value) [sync]
 *   sessioncheck(Session_id, Plid) : int ; GetTimestamp(value) [sync] ; WithdrawalByPayunie(plid) : object ; GenerateOrderId() [sync]
 *  Reused from existing ports (same C# logic, same database 'affiliate'): ../UtilityClass.js (ClusterOfferAPI) for GetDatabaseDate, SendEmailByApiSetting, SaveEMAILHistory, SaveSMSHistory, CallBackAddress, FindingEmailContent..., ResizeImage,
 *   ImageUploadMasterMethodECommNew, WithdrawalByPayunie, GetTimestamp, GenerateOrderId ; ../franchise/UtilityClass.js for the pure helpers (number/word/random/validation/image-format helpers, CreateImage).
 * PORT-NOTE: Server.MapPath(x) => config.uploadDir/<x without ~ and leading slashes>. sharp (optional npm package, required lazily) is used for System.Drawing resizing; without it the original image bytes are written unchanged.
 * PORT-NOTE: Send() hard-coded SMTP credentials/host/from-address (testmail@..., webmail....); now config.app.UtilityMailUser / UtilityMailPassword / UtilityMailHost / UtilityMailFrom (empty by default).
 * PORT-NOTE: Decryptword/Encryptword swallow errors like the C# catch blocks (log through DataUtility.ErrorInsert, return "").
 * PORT-NOTE: SendGrowthInMobile read Session["CURRENCYCODE"] into an unused local: dropped. dbo.fun_GetCurrentDate() => (now() at time zone 'Asia/Kolkata').
 * PORT-NOTE: classes DatabaseDate / EwalletDetails / UserTypes / Mobile / apidata / apidataz / Kyc_Record / EmailParam are plain property bags and are not ported (callers use plain objects).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const config = require('../../config');
const { query, scalar, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { Encryptword: _Encryptword } = require('../../utils/crypto');
const { fire } = require('../_libhelpers');
const { mailAddress, addrList, smtpSend } = require('../franchise/_mailhelpers');
const API = require('../UtilityClass');
const F = require('../franchise/UtilityClass');

const DB = 'affiliate';

const SpecialCharsForLoginID = '!#$%^&*();,?+~`\''.split('');
const SizeSuffixes = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
const MessageType = { MobileSMS: 0, WebEmail: 1 };
const SelectBranchType = { Dump_Warehouse: 0, Branch_Store: 1, Franchise: 2, Merchant: 3 };
const RoleUserType = { Admin: 0, Merchant: 1 };
const SeclectUserType = { Branch: 0, Merchant: 1, Franchise: 2, Employee: 3, Vendor: 4, Customer: 5 };
const SelectAddressType = { PermanentAddress: 0, PresentAddress: 1, ResidentialAddress: 2, OfficeAddress: 3, HomeAddress: 4, BillingAddress: 5, ShippingAddress: 6 };
const ImageMode = { Thumbnail: 0, Original: 1, Both: 2 };

// ---------------------------------------------------------------- helpers
const s_ = (v) => (v === null || v === undefined ? '' : String(v));
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const replaceAll = (s, a, b) => String(s).split(a).join(b === null || b === undefined ? '' : b);

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
function sniffFormat(b) { // System.Drawing decoders: bmp, gif, jpeg, png, tiff
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length > 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length > 4 && b.slice(0, 4).toString('latin1') === 'GIF8') return 'gif';
  if (b.length > 2 && b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  if (b.length > 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a))) return 'tiff';
  return null;
}
function assertImage(b) { // Image.FromStream throws "Parameter is not valid." for non-images
  if (!sniffFormat(b)) throw new Error('Parameter is not valid.');
}
let _sharp;
function sharp() {
  if (_sharp === undefined) { try { _sharp = require('sharp'); } catch (e) { _sharp = null; } }
  return _sharp;
}
function writeFile(file, buf) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf); }
function rmIfExists(file) { if (fs.existsSync(file)) fs.unlinkSync(file); }
function bankers(x) { // Convert.ToInt32(double)
  const f = Math.floor(x); const d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

/** Legacy catch block: DataUtility.ErrorInsert(code, message, procedure, line, "Models/UtilityClass"); never throws. */
async function errorInsert(PROCEDURENAME, err) {
  try {
    const DataUtility = require('./DataUtility');
    await new DataUtility().ErrorInsert(0, err && err.message ? err.message : String(err), PROCEDURENAME, 0, 'Models/UtilityClass');
  } catch (e) {
    console.error('[errorInsert]', e && e.message);
  }
}

// ---------------------------------------------------------------- exchange rate / conversions
async function ExchangeRateFromAPI(amount, firstCcode, lastCcode) {
  try {
    if (arguments.length < 3) { firstCcode = 'INR'; lastCcode = 'USD'; }
    const url = 'https://finance.yahoo.com/d/quotes.csv?s=' + firstCcode + lastCcode + '=X&f=l1';
    const r = await axios.get(url, { responseType: 'text', transformResponse: [(d) => d], timeout: 100000 });
    const t = String(r.data).trim();
    const exchangeRate = Number(t);
    if (t === '' || Number.isNaN(exchangeRate)) throw new Error('Input string was not in a correct format.');
    return exchangeRate;
  } catch (ex) {
    return 0;
  }
}

async function dollarToBitcoinConvertor(amount) {
  try {
    const baseurl = 'https://blockchain.info/tobtc?currency=USD&value=' + amount + '';
    const r = await axios.get(baseurl, { responseType: 'text', transformResponse: [(d) => d], timeout: 100000 });
    const str = String(r.data).split(/\r?\n/)[0];
    const n = Number(str.trim());
    if (str.trim() === '' || Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
    return n;
  } catch (ex) {
    return 0;
  }
}

// ---------------------------------------------------------------- images
// private GetImageName: newWidth/newHeight computed (int division by zero is swallowed by the C# catch => nothing saved), then Img.Save(path)
async function GetImageName(StrValidFull_NameAndPath, bytes, scaleFactor) {
  try {
    const sh = sharp();
    if (sh) {
      const meta = await sh(bytes).metadata();
      const newWidth = Math.trunc(meta.width * scaleFactor);
      const newHeight = Math.trunc(meta.height * scaleFactor);
      if (newHeight === 0) throw new Error('Attempted to divide by zero.');
    }
    writeFile(StrValidFull_NameAndPath, bytes);
  } catch (ExpObj) { /* swallowed like the legacy empty catch */ }
}

async function ImageUploadMasterMethod(ImageBase64Code, Orginial_Folder_Name, Thumb_Folder_Name, IMode, IdForAppend) {
  try {
    let RealImageName = '';
    if (ImageBase64Code.trim() !== '') {
      let Base64String = '';
      if (ImageBase64Code !== '') {
        Base64String = ImageBase64Code;
        let Image = String(crypto.randomInt(100000, 1000000));
        Image = Image.trim();
        Image = Image.replace(/&amp;/g, 'And');
        Image = Image.replace(/&/g, ' And ');
        Image = Image.replace(/[^\w\d]/g, '');
        Image = Image.replace(/ /g, '-');
        RealImageName = s_(IdForAppend) + '_' + Image + '.jpg';
      } else {
        RealImageName = ' ';
      }
      if (Base64String.includes('base64,')) {
        const IndexNo = Base64String.indexOf('/') + 1;
        const lastIndexNo = Base64String.indexOf(';');
        csSubstring(Base64String, IndexNo, lastIndexNo - IndexNo); // ImageExt
        const IndexNo1 = Base64String.indexOf(',') + 1;
        const ByteArray = csFromBase64(Base64String.substring(IndexNo1));
        assertImage(ByteArray); // Image.FromStream
        const StrValidFull_NameAndPath = mapPath(Orginial_Folder_Name) + '/' + RealImageName;
        const StrValidThumbnail_NameAndPath = path.join(mapPath(Thumb_Folder_Name) + '/' + RealImageName);
        rmIfExists(StrValidFull_NameAndPath);
        rmIfExists(StrValidThumbnail_NameAndPath);
        if (IMode === ImageMode.Original || IMode === ImageMode.Both) {
          await GetImageName(StrValidFull_NameAndPath, ByteArray, 1);
        }
        if (IMode === ImageMode.Thumbnail || IMode === ImageMode.Both) {
          await GetImageName(StrValidThumbnail_NameAndPath, ByteArray, 0.25);
        }
      } else {
        RealImageName = ImageBase64Code.replace(/^\/+/, '');
      }
    }
    return RealImageName;
  } catch (ObjExp) {
    return '';
  }
}

async function UploadImageFromExtractProcess(ByteArray, Orginial_Folder_Path, Thumb_Folder_Path, IMode, RealImageName) {
  let filesize = ByteArray.length;
  filesize = filesize / 1024;
  assertImage(ByteArray);
  if (IMode === ImageMode.Original || IMode === ImageMode.Both) {
    const StrValidFull_NameAndPath = Orginial_Folder_Path + '/' + RealImageName;
    rmIfExists(StrValidFull_NameAndPath);
    await API.ResizeImage(StrValidFull_NameAndPath, 1, filesize, ByteArray, 'FullImage');
  }
  if (IMode === ImageMode.Thumbnail || IMode === ImageMode.Both) {
    const StrValidThumbnail_NameAndPath = Thumb_Folder_Path + '/' + RealImageName;
    rmIfExists(StrValidThumbnail_NameAndPath);
    await API.ResizeImage(StrValidThumbnail_NameAndPath, 0.25, filesize, ByteArray, 'ThumbNail');
  }
  return RealImageName;
}

async function ResizeImages(FullName, scaleFactor, filesize, fromstream, Folder) {
  assertImage(fromstream);
  if (filesize > 100) { // KB: skipped when the image is smaller than 100 KB
    const sh = sharp();
    if (sh) {
      const meta = await sh(fromstream).metadata();
      const originalWidth = meta.width; const originalHeight = meta.height;
      const maxWidth = 700; const maxHeight = 880; const quality = 70; // Folder "Kyc_Images" uses the same limits
      const ratioX = Math.fround(maxWidth / originalWidth);
      const ratioY = Math.fround(maxHeight / originalHeight);
      const ratio = Math.min(ratioX, ratioY);
      const newWidth = Math.trunc(originalWidth * ratio);
      const newHeight = Math.trunc(originalHeight * ratio);
      if (newWidth <= 0 || newHeight <= 0) throw new Error('Parameter is not valid.');
      writeFile(FullName, await sh(fromstream).resize(newWidth, newHeight, { fit: 'fill' }).jpeg({ quality }).toBuffer());
      return;
    }
    // PORT-NOTE: sharp not installed - original bytes saved unchanged
    writeFile(FullName, fromstream);
  } else {
    writeFile(FullName, fromstream);
  }
}

async function CreateImage(base64String, fullpathpath, imagename) {
  try {
    return await F.CreateImage(base64String, fullpathpath, imagename);
  } catch (ExpObj) {
    return '';
  }
}

async function saveImage(imgecode, titlename, FolderName) {
  try {
    titlename = titlename.replace(/[^0-9a-zA-Z]+/g, '');
    titlename = titlename.replace(/[\s+]/g, '');
    let returnfilename = '';
    if (titlename.length > 5) {
      titlename = titlename.substring(0, 4);
    }
    const getcolltionimage = imgecode.split('^');
    for (const items of getcolltionimage) {
      const filenames = titlename.trim() + F.getRandomName();
      if (items.trim() !== '' && items.includes('base64,')) {
        // NOTE: legacy argument order CreateImage(items, filenames, FolderName) = (base64String, fullpathpath, imagename) kept as is
        const getnewfilename = await CreateImage(items, filenames, FolderName);
        if (getnewfilename.trim() !== '') {
          if (returnfilename.trim() === '') returnfilename = getnewfilename;
          else returnfilename = returnfilename + '^' + getnewfilename;
        }
      } else if (items.trim() !== '' && !items.includes('base64,')) {
        if (returnfilename.trim() === '') returnfilename = path.win32.basename(items);
        else returnfilename = returnfilename + '^' + path.win32.basename(items);
      }
    }
    return returnfilename;
  } catch (ExpObj) {
    return '';
  }
}

// ---------------------------------------------------------------- data helpers
function Generatehash512(text) {
  try {
    return crypto.createHash('sha512').update(Buffer.from(String(text), 'utf8')).digest('hex');
  } catch (e) {
    return '';
  }
}

// PORT-NOTE: DataSet => { Table: rows[] }
async function GetDataSet(strSql) {
  const rows = await query(DB, strSql, {});
  return { Table: rows };
}

async function GetDataSetSPNamed(arrParam, strSPName, tblName) {
  const p = {};
  for (const a of arrParam) {
    if (a.Direction === 'Output' || a.Direction === 2) continue;
    p[String(a.ParameterName).replace(/^@/, '').trim()] = a.Value;
  }
  const ds = {};
  ds[tblName] = await proc(DB, String(strSPName).replace(/[\[\]]/g, ''), p);
  return ds;
}

function Generatetxnid() { return F.Generatetxnid(); }

async function CreateAutoWithdrawal() {
  // legacy: new Thread(...).Start()
  fire(async () => {
    await proc(DB, 'usp_member_auto_withdrawal', { regno: 0 });
  });
}

async function CreateAutoWithdrawal_ROI() {
  await proc(DB, 'usp_member_auto_withdrawal_for_growth', { regno: 0 });
}

// ---------------------------------------------------------------- paging
function CreateCustomPagging_ServerSide(ControllerWithAction, QueryString, TotalRecord, PageSize, NumbersPerPage, CurrentPageIndex) {
  let href = '';
  ControllerWithAction = '/' + ControllerWithAction;
  let Count = 0;
  let LoopCount = NumbersPerPage;
  const TotalPageCount = TotalRecord / PageSize;
  if (!Number.isFinite(TotalPageCount)) throw new RangeError('Value was either too large or too small for an Int32.');
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
  const hasQs = QueryString !== '' && QueryString !== null && QueryString !== undefined;
  const promo = () => ControllerWithAction.includes('promos-and-advertisement');
  const Enc = (n) => _Encryptword(String(n));
  if (CurrentPageIndex === 1) prevClass = 'disabledli';
  if (hasQs) {
    if (!promo()) href = ControllerWithAction + '?page=' + PrePageNo + '&' + QueryString;
    else href = ControllerWithAction + '?page=' + Enc(PrePageNo) + '&' + QueryString;
  } else if (!promo()) {
    href = ControllerWithAction + '?page=' + PrePageNo;
  } else {
    href = ControllerWithAction + '?page=' + Enc(PrePageNo);
  }

  let MyPagingDiv = '';
  MyPagingDiv += "<div class='pagination-container'>";
  MyPagingDiv += "<ul class='pagination'>";
  if (CurrentPageIndex > NumbersPerPage) {
    prevClass = 'enabledPrev';
    MyPagingDiv += "<li class='" + prevClass + "'><a  " + "href='" + href + "'" + '></a></li>'; // legacy prev link has no text
  } else {
    prevClass = 'disabledPrev';
    MyPagingDiv += "<li class='" + prevClass + "'><a>«</a></li>";
  }

  let CurrentPageNo = StartPageNo;
  while (LoopCount >= 1) {
    Count += 1;
    if (CurrentPageIndex === CurrentPageNo) ActiveIndex = 'pageActive';
    else ActiveIndex = '';
    if (hasQs) {
      if (!promo()) href = ControllerWithAction + '?page=' + CurrentPageNo + '&' + QueryString;
      else href = ControllerWithAction + '?page=' + Enc(CurrentPageNo) + '&' + QueryString;
    } else if (!promo()) {
      href = ControllerWithAction + '?page=' + CurrentPageNo;
    } else {
      href = ControllerWithAction + '?page=' + Enc(CurrentPageNo);
    }
    MyPagingDiv += "<li class='" + ActiveIndex + "'><a id='" + 'liNav' + String(NumbersPerPage - LoopCount + 1)
      + "' class='" + ActiveIndex + "'  "
      + "href='" + href + "'" +
      '>' + String(CurrentPageNo) + '</a></li>';
    LoopCount -= 1;
    CurrentPageNo += 1;
    if (CurrentPageNo > TotalPages) LoopCount = 0;
  }

  if (CurrentPageNo >= TotalPages) NextClass = 'disabledli';
  if (hasQs) {
    href = ControllerWithAction + '?page=' + CurrentPageNo + '&' + QueryString;
  } else {
    href = ControllerWithAction + '?page=' + CurrentPageNo;
  }
  if (CurrentPageNo <= TotalPages) {
    NextClass = 'enabledNext';
    MyPagingDiv += "<li class='" + NextClass + "'><a " + "href='" + href + "'" + '>»</a></li>';
  } else {
    NextClass = 'disabledNext';
    MyPagingDiv += "<li class='" + NextClass + "'><a>»</a></li>";
  }
  MyPagingDiv += '</ul>';
  MyPagingDiv += "<div class='ReecordMsg'> Page " + String(CurrentPageIndex) + ' of ' + String(TotalPages) + ' (' + TotalRecord + ' Items' + ')</div>';
  MyPagingDiv += '</div>';
  return MyPagingDiv;
}

// ---------------------------------------------------------------- crypto / random
// Member catch blocks log via ErrorInsert and fall through to `return ret` ("")
function Decryptword(DecryptText) {
  try {
    return F.Decryptword(DecryptText);
  } catch (ExpObj) {
    fire(() => errorInsert('Decryptword', ExpObj));
    return '';
  }
}

function Encryptword(Encryptval) {
  try {
    return _Encryptword(Encryptval);
  } catch (ExpObj) {
    fire(() => errorInsert('Encryptword', ExpObj));
    return '';
  }
}

function RandomStringByLength(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let r = '';
  for (let i = 0; i < length; i++) r += chars[crypto.randomInt(0, chars.length)];
  return r;
}

function RandomNumberStringByLength(length) {
  const chars = '0123456789';
  let r = '';
  for (let i = 0; i < length; i++) r += chars[crypto.randomInt(0, chars.length)];
  return r;
}

// ---------------------------------------------------------------- stored-procedure wrappers
function outCol(row, name) {
  if (!row) return null;
  const k = name.toLowerCase();
  if (k in row) return row[k];
  const keys = Object.keys(row);
  return keys.length === 1 ? row[keys[0]] : null;
}

async function GetEwalletCurrentBalace(RegNo) {
  const row = await procOne(DB, 'usp_getewalletdetails', { regno: RegNo });
  const v = outCol(row, 'CurrentBalance');
  if (v === null || v === undefined) throw NRE(); // spOutput.Value.ToString()
  const n = Number(v);
  if (String(v).trim() === '' || Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
}

async function GetTransCondition(Type) {
  try {
    const row = await procOne(DB, 'usp_checktransconditions', { type: Type });
    const v = outCol(row, 'strOut');
    if (v === null || v === undefined) throw NRE();
    return String(v);
  } catch (ExpObj) {
    return '';
  }
}

async function Maintain_Manipulation(Emp_Code, BrCode, created_remark) {
  let retValue = '';
  try {
    const row = await procOne(DB, 'usp_maintain_manipulations', { emp_code: Emp_Code, brcode: BrCode, created_remark });
    const v = outCol(row, 'strResult');
    if (v === null || v === undefined) throw NRE();
    retValue = String(v);
  } catch (ExpObj) {
    return '';
  }
  return retValue;
}

// Legacy used hard-coded credentials (see PORT-NOTE in the header); from-address forced to the configured one like the C#.
async function Send(from, to, cc, bcc, subject, body) {
  try {
    const username = config.app.UtilityMailUser || '';
    const pass = config.app.UtilityMailPassword || '';
    const host = config.app.UtilityMailHost || '';
    from = config.app.UtilityMailFrom || '';
    const message = { subject, html: body, from: mailAddress(from) };
    if (to !== '') message.to = addrList(to);
    if (cc !== '') message.cc = addrList(cc);
    if (bcc !== '') message.bcc = addrList(bcc);
    return await smtpSend({ host, port: 25, user: username, pass, message });
  } catch (ExpObj) {
    return '';
  }
}

async function SendGrowthInMobile(Message) {
  try {
    const Lim = mapRows(await query(DB, `select M.mobile,M.LoginId,MP.currentIncome as totalIncome,
       case  when G.Updated_DailyGrowth_Rate>G.DailyGrowth_Rate then Updated_DailyGrowth_Rate else DailyGrowth_Rate
       end as  DailyReturn from member_Master M,tbl_GrowthMaster G,tbl_DailyGrowthAccount D,Member_Performance MP where
        G.RegNo=M.regNo and D.GMID=G.GMID and (now() at time zone 'Asia/Kolkata')::date=d.toDate::date
        and MP.regno=M.regNo and M.mobile<>'' and M.Active::int=1  and G.CurrentReturn<G.MaxReturn  and MP.currentIncome>0`, {}),
    ['mobile', 'LoginId', 'totalIncome', 'DailyReturn']);
    for (const Item of Lim) {
      const MobileNoTemp = Item.mobile;
      const Loginid = Item.LoginId;
      const TodayGrowth = Number(Item.DailyReturn);
      const Msg = 'Dear user, your account ID ' + Loginid + ' is credited by ' + TodayGrowth.toFixed(0) + 'points. ';
      await fns.SendMsgOnMobile(MobileNoTemp, Msg);
    }
  } catch (ExpObj) {
    await errorInsert('Send', ExpObj);
  }
}

async function UpdateGrowthByGlobal() {
  const row = await procOne(DB, 'usp_updaetgrowth', { regno: '0' });
  const v = outCol(row, 'strResult');
  if (v === null || v === undefined) throw NRE();
  const OutputResult = String(v);
  if (OutputResult === 'ok') {
    fire(async () => {
      await CreateAutoWithdrawal_ROI();
      await SendGrowthInMobile('ok');
    });
  }
}

async function sessioncheck(Session_id, Plid) {
  // legacy: SqlQuery<Int32>("USP_SESSIONSERVICESFORANROID @SESSIONID,@STATUS,@ACTIVE,@MODE,@INTRESULT OUT,@PLID").FirstOrDefault()
  const rows = await proc(DB, 'usp_sessionservicesforanroid', { sessionid: String(Session_id), status: '1', active: '1', mode: '2', plid: Plid });
  const r = rows[0];
  if (!r) return 0;
  const k = Object.keys(r)[0];
  const n = parseInt(r[k], 10);
  return Number.isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------------- SMS (TBL_SMSAPI, Db_Affiliate)
async function sendSmsVia(sql, apiCol, promoCol, mobileNo, message, ApiType) {
  let API_ = '';
  const rows = await query(DB, sql, {});
  const PromoAPI = rows.length ? rows[0][promoCol] : null;
  const TranAPI = rows.length ? rows[0][apiCol] : null;
  try {
    if (ApiType === '1') {
      if (TranAPI === null || TranAPI === undefined) throw NRE();
      API_ = replaceAll(TranAPI, '1111111111', mobileNo);
      API_ = replaceAll(API_, 'DummyText', message);
      await axios.get(API_, { timeout: 100000 });
    } else {
      if (PromoAPI === null || PromoAPI === undefined) throw NRE();
      API_ = replaceAll(PromoAPI, '1111111111', mobileNo);
      API_ = replaceAll(API_, 'DummyText', message);
      await axios.get(API_, { timeout: 100000 });
    }
    await API.SaveSMSHistory(mobileNo, message, 1);
    return 'SMS Sent Successfully';
  } catch (ExpObj) {
    await API.SaveSMSHistory(mobileNo, message, 2);
    return 'SMS Sending Fail';
  }
}

const SendSMSWithAPI = (mobileNo, message, ApiType = '0') => sendSmsVia('SELECT SAID,Prom_API,Tran_API from TBL_SMSAPI', 'tran_api', 'prom_api', mobileNo, message, ApiType);
const SendSMSWithAPIz = (mobileNo, message, ApiType = '0') => sendSmsVia('SELECT SAID,Prom_API,Tran_APIV from TBL_SMSAPI', 'tran_apiv', 'prom_api', mobileNo, message, ApiType);
const SendSMSWithAPINew = (mobileNo, message, ApiType = '0') => sendSmsVia('SELECT SAID,Prom_API,Tran_API from TBL_SMSAPI where SAID=2', 'tran_api', 'prom_api', mobileNo, message, ApiType);

// Member C# differs from ClusterOfferAPI here: it passes empname / userid unchanged (API: IsNullOrEmpty(x) ? "" : x).
// A SqlParameter whose Value is C# null is "not supplied" to SQL Server, so the procedure default is used
// (@EmpName = 'ROOT', @UserId = ''); reproduced by omitting the argument (named notation => PostgreSQL default).
async function FindingSmsContentWithUserIdPassword(empname, msg, userid, password, mode, SponsorUserName = '', MemberName = '', CreditAmt = 0, DebitAmt = 0, Plid = 0, Toplid = 0, TransactionPass = '', PasswordType = '') {
  // PORT-NOTE: legacy SQL text ended with ",PasswordType" (missing "@"), so SQL Server received the literal string 'PasswordType'.
  const params = { plid: Plid, Toplid, Mode: mode };
  if (empname !== null && empname !== undefined) params.EmpName = empname;
  params.Message = msg;
  if (userid !== null && userid !== undefined) params.UserId = userid;
  Object.assign(params, { Password: password, SponsorUserName, MemberName, DebitAmount: DebitAmt, CreditAmount: CreditAmt, PasswordType: 'PasswordType' });
  const row = await procOne(DB, 'Usp_SendDynamicSmsAction', params);
  const v = outCol(row, 'Result');
  return v === null || v === undefined ? '' : String(v); // spOutput.Value.ToString() (DBNull => "")
}

// ---------------------------------------------------------------- the function table
const fns = {
  ExchangeRateFromAPI, dollarToBitcoinConvertor,
  ImageUploadMasterMethod, UploadImageFromExtractProcess, ResizeImages, CreateImage, saveImage,
  ImageUploadMasterMethodECommNew: (...a) => API.ImageUploadMasterMethodECommNew(...a),
  ResizeImage: (...a) => API.ResizeImage(...a),
  Generatehash512, Generatetxnid, GetDataSet, GetDataSetSPNamed,
  GetDatabaseDate: () => API.GetDatabaseDate(),
  CreateAutoWithdrawal, CreateAutoWithdrawal_ROI, CreateCustomPagging_ServerSide,
  DecimalToWords: (d) => F.DecimalToWords(d),
  Decryptword, Encryptword,
  GenerateRandomNumber: () => F.GenerateRandomNumber(),
  RandomStringByLength, RandomNumberStringByLength,
  GetCurrentDate: () => F.GetCurrentDate(),
  Getimageformate: (img) => F.Getimageformate(img),
  GetRandom: (a, b) => F.GetRandom(a, b),
  getRandomName: () => F.getRandomName(),
  GridNumbersPerPage: () => F.GridNumbersPerPage(),
  GridPageSize: () => F.GridPageSize(),
  NumberToText: (n, isUK) => F.NumberToText(n, isUK),
  NumberToWords: (n) => F.NumberToWords(n),
  RandomString: (l) => F.RandomString(l),
  RandomDigits: (l) => F.RandomDigits(l),
  ValidateInt: (v) => F.ValidateInt ? F.ValidateInt(v) : /^\s*[+-]?\d+\s*$/.test(String(v)) && Math.abs(parseInt(v, 10)) <= 2147483648,
  ValidateInt64: (v) => F.ValidateInt64 ? F.ValidateInt64(v) : /^\s*[+-]?\d+\s*$/.test(String(v)),
  GetEwalletCurrentBalace, GetTransCondition, Maintain_Manipulation, Send,
  removeSpacesAndSpecialChars: (v) => F.removeSpacesAndSpecialChars(v),
  SendGrowthInMobile, UpdateGrowthByGlobal,
  CallBackAddress: (...a) => API.CallBackAddress(...a),
  SendEmailByApiSetting: (...a) => API.SendEmailByApiSetting(...a),
  SaveEMAILHistory: (...a) => API.SaveEMAILHistory(...a),
  SendMsgOnEmail: async () => 'You Called Invalid Function Please Call SendEmailByApiSetting',
  SendSMSWithAPI, SendSMSWithAPIz, SendSMSWithAPINew,
  SaveSMSHistory: (...a) => API.SaveSMSHistory(...a),
  SendMsgOnMobile: async () => 0,
  FindingSmsContentWithUserIdPassword,
  FindingEmailContentWithUserIdPassword: (...a) => API.FindingEmailContentWithUserIdPassword(...a),
  SendMsgToMobileWithSelfAccount: async () => 0,
  CheckAndSendMsgOnEmail: async () => 'You Called Invalid Function Please Call SendEmailByApiSetting',
  CheckAndSendMsgOnMobile: async () => '0',
  ToOrdinal: (v) => F.ToOrdinal(v),
  BlastCampaign: async () => { fire(async () => { /* legacy thread body is empty */ }); },
  SizeSuffix: (v) => F.SizeSuffix(v),
  sessioncheck,
  GetTimestamp: (v) => API.GetTimestamp(v),
  WithdrawalByPayunie: async (plid) => {
    const r = await API.WithdrawalByPayunie(plid);
    UtilityClass.responsemessage = API.responsemessage;
    return r;
  },
  GenerateOrderId: () => API.GenerateOrderId(),
};

class UtilityClass {}
for (const [k, v] of Object.entries(fns)) {
  UtilityClass[k] = v;
  Object.defineProperty(UtilityClass.prototype, k, { value: v, writable: true, configurable: true });
}
Object.assign(UtilityClass, {
  SpecialCharsForLoginID, SizeSuffixes, responsemessage: '',
  MessageType, SelectBranchType, RoleUserType, SeclectUserType, SelectAddressType, ImageMode,
});

module.exports = UtilityClass;
