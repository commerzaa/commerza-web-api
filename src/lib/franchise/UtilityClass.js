/** Exports (static class UtilityClass, Franchise version; async unless noted):
 *  fields: SpecialCharsForLoginID[] ; enums: MessageType, SelectBranchType, RoleUserType, SeclectUserType, SelectAddressType, ImageMode {Thumbnail:0,Original:1,Both:2}
 *  ExchangeRateFromAPI() | ExchangeRateFromAPI(amount, firstCcode, lastCcode) : decimal
 *  ImageUploadMasterMethodEComm(ImageBase64Code, OriginalImage, ThumbNailImage, IMode, IdForAppend) : string
 *  ImageUploadMasterMethod(ImageBase64Code, Orginial_Folder_Name, Thumb_Folder_Name, IMode, IdForAppend) : string
 *  ResizeImagekyc(FullName, scaleFactor, filesize, fromstream:Buffer, Folder) ; ResizeImage(FullName, scaleFactor, filesize, fromstream:Buffer, Folder) ; UploadImageFromExtractProcess(ByteArray:Buffer, Orginial_Folder_Path, Thumb_Folder_Path, IMode, RealImageName) : string
 *  GetColorcode(ColorName) ; Generatehash512(text) [sync] ; GetDataSet(strSql) ; GetDataSetSPNamed(arrParam, strSPName, tblName) ; Generatetxnid() [sync] ; CreateAutoWithdrawal() ; CreateAutoWithdrawal_ROI()
 *  CreateCustomPagging_ServerSide(ControllerWithAction, QueryString, TotalRecord, PageSize, NumbersPerPage, CurrentPageIndex) : string [sync]
 *  DecimalToWords(d) [sync] ; Decryptword(DecryptText) [sync, throws] ; Encryptword(Encryptval) [sync] ; GenerateRandomNumber() [sync] ; GetCurrentDate() [sync] ; Getimageformate(imgBuffer) [sync]
 *  GetRandom(minDigits, maxDigits) [sync] ; getRandomName() [sync] ; GridNumbersPerPage() [sync] ; GridPageSize() [sync] ; NumberToText(number, isUK) [sync] ; NumberToWords(number) [sync]
 *  RandomString(length) [sync] ; RandomDigits(length) [sync] ; saveImage(imgecode, titlename, FolderName) ; CreateImage(base64String, fullpathpath, imagename) ; ValidateInt(Input) [sync] ; ValidateInt64(Input) [sync]
 *  GetDatabaseDate() ; GetEwalletCurrentBalace(RegNo) ; GetTransCondition(Type) ; Maintain_Manipulation(Emp_Code, BrCode, created_remark) ; Send(from,to,cc,bcc,subject,body) ; removeSpacesAndSpecialChars(stringvalue) [sync]
 *  SendGrowthInMobile(Message) ; UpdateGrowthByGlobal() ; TrackError(ErrorMsg) ; Franchisee_Settlement() ; Auto_Update_Merchant_Order_Process() ; Auto_Update_Reseller_Comission_Process()
 *  SendEmailByApiSetting(user,password,hostname,FromEmailId,BCC_EmailId,CC_EmailId,ToEmailId,Subject,BodyMessage,fileUploader{originalname,buffer}|null,SenderId="",SenderName="") ; SendMsgOnEmail(FromEmailId,ToEmailId,CC_EmailId,BCC_EmailId,Subject,BodyMessage,SenderId="",SenderName="")
 *  SendMsgOnMobile(MobileNo, Message, type="", did=0) : int ; SendMsgToMobileWithSelfAccount(Api) : int
 *  TrackResellerMessages / TrackCustomersMessages / TrackMerchantsMessages(mobileNo, Message, process) ; TrackRegistrationEmail / TrackMerchantsEmails / TrackCustomersEmails(emailId, mailBody, process)
 *  CheckAndSendMsgOnEmail(UserId,ToEmailId,CC_EmailId,BCC_EmailId,Subject,BodyMessage,SenderId="",SenderName="",FromEmailId="") ; CheckAndSendMsgOnMobile(UserId, MobileNo, Message) ; ToOrdinal(value) [sync]
 *  BlastCampaign() ; Auto_Mail() ; BusinessKYC_Auto_Mail() ; SizeSuffix(value) [sync] ; updatemerchantkyc(plid) : int
 *  PORT-NOTE: sharp (optional npm package) is used for System.Drawing resize/re-encode; without it images are written unchanged (as in lib/UtilityClass.js).
 *  PORT-NOTE: Server.MapPath(x) => config.uploadDir/<x without ~ and leading slashes>.
 *  PORT-NOTE: Franchisee_Settlement read/credited [Db_Trebleu].[DBO] (another database); the PostgreSQL port uses the same 'shopping' database - adjust if the Trebleu wallet lives elsewhere.
 *  PORT-NOTE: HttpContext Session usage inside SendGrowthInMobile (unused local) dropped.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const config = require('../../config');
const { query, queryOne, scalar, exec, proc, procOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const { Encryptword: _Encryptword } = require('../../utils/crypto');
const { outValue, safeUrl } = require('../_http');
const { fire } = require('../_libhelpers');
const CompanySettings = require('./CompanySettings');
const SendMailLib = require('./SendMail');
const { mailAddress, addrList, smtpSend } = require('./_mailhelpers');

const TPL_AUTOMAIL = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; padding:15px 25px;'>\n    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\n    <table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; width: 100%'>\n        <tbody>\n      <tr>\n        <td><table style='width:100%;'>\n            <tbody>\n              <tr>\n                <td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\n              </tr>\n            </tbody>\n          </table></td>\n      </tr>\n        <tr>\n        <td>\n\n      <div>\n        <div class='clear'></div>\n        <table style='padding-bottom: 10px; width: 100%; '>\n          <tbody>\n            <tr>\n              <td>\n            <tr>\n              <td align='center'>\n\n         <strong style='font-size: 18px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> KYC Documents – Polite Reminder </p> </strong>\n\n         <div style='text-align:left;'>\n\n                                            <h1 style='font-size: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px\n\n15px; color: #3f3f42;'>Dear $$lblName$$, </h1>\n\n    <div style='font-size: 15px; color: #333;'>\n    \t\t\t\t<p style='font-size:14px; line-height:19px;  margin-top:20px; margin-bottom:0;'>We again remind you to submit your KYC documents within next 24hrs to benefit the use of our Referral Program system. </p>\n\n                </div>\n\n         </div>\n\n                <div style='clear: both'></div></td>\n            </tr>\n          <div style='margin: auto; padding-top: 0px; padding-bottom: 0px;display:none; margin-top: 0px; border-bottom:1px solid #00a0a8;'>\n            <center>\n              <img src='http://webwebmail.mlmkabila.com/imp/themes/default/graphics/spacer_red.png' htmlimgblocked='https://$$CompanyURL$$/images/divider.png'>\n            </center>\n          </div>\n          <div style='clear: both'></div>\n          <div style='clear: both'></div>\n            </td>\n\n            </tr>\n          <tr>\n            <td>\n\n                <table style='width:100%;'>\n                        <tbody>\n                          <tr>\n                            <td  colspan='2' align='center'><div style='margin-right: 7px; border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'> <font style='margin-right:0px; font-size: 16px; color:#000; font-family:  Arial, Helvetica, sans-serif; float: left; margin-top:2px; font-weight: normal; padding-top:3px'> </font>\n <a href='https://www.facebook.com/ATCShoppingServices/' style='color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target='8SE_b89lng5GVbx5a7NZME9'>   <img src='https://$$CompanyURL$$/images/mailer-facebook.png'  style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' > </a>\n <a href='https://twitter.com/ATCShoppingServices' style='color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='e3PP7S0O2rDcb5kT5Qxvkl9'>  <img src='https://$$CompanyURL$$/images/mailer-twitter.png' style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' ></a>\n <a href='https://plus.google.com/+ATCShoppingIn' style='color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='k_lu77WHdSxxe84MTtrgPlD'>  <img src='https://$$CompanyURL$$/images/mailer-gplus.png'  style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' > </a>\n <a href='https://www.linkedin.com/company/Eblaa' style='color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='1QtmtsX-zlkY3NH-RX8bXJB'>  <img src='https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' ></a>\n <a href='https://pinterest.com/ATCShoppingServices/' style='color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='FTivBEnhJ2wIlo_i9yYL1Xk'>  <img src='https://$$CompanyURL$$/images/mailer-pintrest.png'  style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' ></a> </div></td>\n                          </tr>\n                        </tbody>\n                      </table>\n\n         </td>\n          </tr>\n            </tbody>\n        </table>\n        <div class='clear'></div>\n      </div>\n        </td>\n\n        </tr>\n        </tbody>\n    </table>\n  </div>\n\n    <p style='font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>\n</div>";
const TPL_BIZMAIL = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; padding:15px 25px;'>\n    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\n    <table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; width: 100%'>\n        <tbody>\n\n      <tr>\n        <td><table style='width:100%;'>\n            <tbody>\n              <tr>\n                <td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='http://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\n              </tr>\n            </tbody>\n          </table></td>\n      </tr>\n        <tr>\n\n        <td>\n\n      <div>\n        <div class='clear'></div>\n        <table style='padding-bottom: 10px; width: 100%; '>\n          <tbody>\n            <tr>\n              <td>\n            <tr>\n              <td align='center'><strong style='font-size: 18px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Business KYC – Polite Reminder\n                </p>\n                </strong>\n                <div style='text-align:left;'>\n                  <h1 style='font-size: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px\n\n15px; color: #3f3f42;'>Dear $$lblName$$, </h1>\n                  <div style='font-size: 15px; color: #333;'>\n                    <p style='font-size:14px; line-height:19px;  margin-top:20px; margin-bottom:0;'>We are reminding you to submit your Business KYC documents within next 24 Hrs. to get the benefit of your Business Listing.</p>\n                  </div>\n                </div>\n                <div style='clear: both'></div>\n                <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\n                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>\n                          <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: 'Exo', sans-serif, Helvetica, sans-serif;  color: #000'> If you have any issues,\n            we will be happy to help you. You can contact us on <a href = 'mailto:$$CompanySupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$CompanySupportEmailId$$ </a></p>\n\n                                     </div>\n\n                                     </td>\n\n                                 </tr>\n\n                               <div style = 'clear: both'></div>\n\n                                <div style = 'clear: both'></div>\n\n                                   </td>\n\n                                   </tr>\n\n                                 <tr>\n\n                                   <td><table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>\n\n                                          <tbody>\n\n                                            <tr>\n\n                                            <td>\n\n                                                <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>\n\n                                                   <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5>\n\n                                                  </td>\n\n                                                    <td>\n\n                                                    <div style = 'margin-right: 7px; text-align:right'>\n\n                                                     <a href = 'https://www.facebook.com/ATCShoppingServices/' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'http://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n\n                                                                <a href = 'https://twitter.com/ATCShoppingServices' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'http://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n\n                                                                           <a href = 'https://plus.google.com/+ATCShoppingIn' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'http://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\n\n                                                                                      <a href = 'https://www.linkedin.com/company/Eblaa' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'http://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\n\n                                                                                                  <a href = 'https://pinterest.com/ATCShoppingServices/' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'http://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>\n\n                                                                                                             </div></td>\n\n                                                                                                          </tr>\n\n                                                                                                        </tbody>\n\n                                                                                                      </table></td>\n\n                                                                                                  </tr>\n\n                                                                                                    </tbody>\n\n                                                                                                </table>\n\n                                                                                                <div class='clear'></div>\n      </div>\n        </td>\n\n        </tr>\n\n        </tbody>\n\n    </table>\n  </div>\n  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>\n</div>";

const SpecialCharsForLoginID = '!#$%^&*();,?+~`\''.split('');
const SizeSuffixes = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

const MessageType = { MobileSMS: 0, WebEmail: 1 };
const SelectBranchType = { Dump_Warehouse: 0, Branch_Store: 1, Franchise: 2, Merchant: 3 };
const RoleUserType = { Admin: 0, Merchant: 1 };
const SeclectUserType = { Branch: 0, Merchant: 1, Franchise: 2, Employee: 3, Vendor: 4, Customer: 5 };
const SelectAddressType = { PermanentAddress: 0, PresentAddress: 1, ResidentialAddress: 2, OfficeAddress: 3, HomeAddress: 4, BillingAddress: 5, ShippingAddress: 6 };
const ImageMode = { Thumbnail: 0, Original: 1, Both: 2 };

// ---------------------------------------------------------------- helpers
const rep = (s, k, v) => s.split(k).join(v === null || v === undefined ? '' : String(v));
const s_ = (v) => (v === null || v === undefined ? '' : String(v));
const pad = (n) => String(n).padStart(2, '0');
const sleepless = () => undefined;
// Convert.ToInt32(double): banker's rounding
function bankers(x) {
  const f = Math.floor(x); const d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}
function toInt32(v) {
  const t = s_(v).trim();
  if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return parseInt(t, 10);
}
function toDecimal(v) {
  const t = s_(v).trim();
  const n = Number(t);
  if (t === '' || Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
}
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
function ensureDirFor(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
function writeFile(file, buf) { ensureDirFor(file); fs.writeFileSync(file, buf); }
function rmIfExists(file) { if (fs.existsSync(file)) fs.unlinkSync(file); }
function changeExtension(p, ext) { // Path.ChangeExtension(p, ext)
  const base = p.replace(/\.[^./\\]*$/, '');
  return ext ? base + '.' + ext.replace(/^\./, '') : base;
}
const GRID = (key, dflt) => {
  const value = config.app[key];
  return ValidateInt(value) ? parseInt(String(value).trim(), 10) : dflt;
};

// ---------------------------------------------------------------- exchange rate
async function ExchangeRateFromAPI(amount, firstCcode, lastCcode) {
  try {
    if (arguments.length < 3) { firstCcode = 'INR'; lastCcode = 'USD'; }
    const url = 'http://finance.yahoo.com/d/quotes.csv?s=' + firstCcode + lastCcode + '=X&f=l1';
    const r = await axios.get(safeUrl(url), { responseType: 'text', transformResponse: [(d) => d] });
    const t = String(r.data).trim().replace(/,/g, '');
    const exchangeRate = Number(t);
    if (t === '' || Number.isNaN(exchangeRate)) throw new Error('Input string was not in a correct format.');
    return exchangeRate;
  } catch (ex) {
    return 0;
  }
}

// ---------------------------------------------------------------- images
function parseDataUri(Base64String) {
  const IndexNo = Base64String.indexOf('/') + 1;
  const lastIndexNo = Base64String.indexOf(';');
  const ImageExt = csSubstring(Base64String, IndexNo, lastIndexNo - IndexNo);
  const IndexNo1 = Base64String.indexOf(',') + 1;
  const b64 = Base64String.substring(IndexNo1);
  return { ImageExt, bytes: csFromBase64(b64) };
}

async function ImageUploadMasterMethodEComm(ImageBase64Code, OriginalImage, ThumbNailImage, IMode, IdForAppend) {
  const Orginial_Folder_Path = mapPath(OriginalImage);
  const Thumb_Folder_Path = mapPath(ThumbNailImage);
  let RealImageName = '';
  if (ImageBase64Code.trim() !== '' && ImageBase64Code.includes('base64,')) {
    const Base64String = ImageBase64Code;
    if (ImageBase64Code !== '') {
      let Image = String(crypto.randomInt(100000, 1000000));
      Image = Image.trim();
      Image = Image.replace(/&amp;/g, 'And');
      Image = Image.replace(/&/g, ' And ');
      Image = Image.replace(/[^\w\d]/g, '');
      Image = Image.replace(/ /g, '-');
      RealImageName = IdForAppend + Image + '.jpg';
    } else {
      RealImageName = ' ';
    }
    if (Base64String.includes('base64,')) {
      const { bytes } = parseDataUri(Base64String);
      const filesize = bytes.length;
      assertImage(bytes); // Image.FromStream
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

async function ImageUploadMasterMethod(ImageBase64Code, Orginial_Folder_Name, Thumb_Folder_Name, IMode, IdForAppend) {
  let RealImageName = '';
  if (ImageBase64Code.trim() !== '') {
    const Base64String = ImageBase64Code;
    if (ImageBase64Code !== '') {
      let Image = String(crypto.randomInt(100000, 1000000));
      Image = Image.trim();
      Image = Image.replace(/&amp;/g, 'And');
      Image = Image.replace(/&/g, ' And ');
      Image = Image.replace(/[^\w\d]/g, '');
      Image = Image.replace(/ /g, '-');
      RealImageName = IdForAppend + '_' + Image + '.jpg';
    } else {
      RealImageName = ' ';
    }
    if (Base64String.includes('base64,')) {
      const { bytes } = parseDataUri(Base64String);
      assertImage(bytes);
      let filesize = bytes.length;
      filesize = filesize / 1024;
      const StrValidFull_NameAndPath = mapPath(Orginial_Folder_Name) + '/' + RealImageName;
      const StrValidThumbnail_NameAndPath = mapPath(Thumb_Folder_Name) + '/' + RealImageName;
      rmIfExists(StrValidFull_NameAndPath);
      rmIfExists(StrValidThumbnail_NameAndPath);
      let scaleFactor = 0;
      if (IMode === ImageMode.Original || IMode === ImageMode.Both) {
        scaleFactor = 0.25;
        await GetImageName(StrValidFull_NameAndPath, bytes, scaleFactor);
        await ResizeImagekyc(StrValidFull_NameAndPath, scaleFactor, filesize, bytes, 'Kyc_Images');
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

// private GetImageName: newWidth/newHeight computed, then Img.Save(path) (re-save of the same image)
async function GetImageName(StrValidFull_NameAndPath, bytes, scaleFactor) {
  const sh = sharp();
  if (sh) {
    const meta = await sh(bytes).metadata();
    const newWidth = Math.trunc(meta.width * scaleFactor);
    const newHeight = Math.trunc(meta.height * scaleFactor);
    if (newHeight === 0) throw new Error('Attempted to divide by zero.');
  }
  writeFile(StrValidFull_NameAndPath, bytes);
}

async function ResizeImagekyc(FullName, scaleFactor, filesize, fromstream, Folder) {
  const sh = sharp();
  if (filesize > 100) { // KB threshold: skipped when the image is small
    if (sh) {
      const meta = await sh(fromstream).metadata();
      const originalWidth = meta.width; const originalHeight = meta.height;
      let maxWidth = 515; let maxHeight = 832; const quality = 70;
      if (Folder !== '' && Folder === 'Kyc_Images') { maxWidth = 479; maxHeight = 612; }
      const ratioX = Math.fround(maxWidth / originalWidth);
      const ratioY = Math.fround(maxHeight / originalHeight);
      const ratio = Math.min(ratioX, ratioY);
      const newWidth = Math.trunc(originalWidth * ratio);
      const newHeight = Math.trunc(originalHeight * ratio);
      const out = await sh(fromstream).resize(newWidth, newHeight, { fit: 'fill' }).jpeg({ quality }).toBuffer();
      writeFile(FullName, out);
      return;
    }
    // PORT-NOTE: sharp not installed - original bytes saved unchanged
    writeFile(FullName, fromstream);
  } else {
    writeFile(FullName, fromstream);
  }
}

async function ResizeImage(FullName, scaleFactor, filesize, fromstream, Folder) {
  const sh = sharp();
  if (filesize > 800000) { // threshold on the size value passed by the caller
    if (Folder === 'ThumbNail' && sh) {
      writeFile(FullName, await sh(fromstream).jpeg().toBuffer());
    } else {
      // the legacy code re-draws the image at its own size (scale factor commented out) => same pixels
      writeFile(FullName, fromstream);
    }
  } else {
    writeFile(FullName, fromstream);
  }
}

async function UploadImageFromExtractProcess(ByteArray, Orginial_Folder_Path, Thumb_Folder_Path, IMode, RealImageName) {
  let filesize = ByteArray.length;
  filesize = filesize / 1024;
  assertImage(ByteArray);
  if (IMode === ImageMode.Original || IMode === ImageMode.Both) {
    const StrValidFull_NameAndPath = Orginial_Folder_Path + '/' + RealImageName;
    rmIfExists(StrValidFull_NameAndPath);
    await ResizeImage(StrValidFull_NameAndPath, 1, filesize, ByteArray, 'FullImage');
  }
  if (IMode === ImageMode.Thumbnail || IMode === ImageMode.Both) {
    const StrValidThumbnail_NameAndPath = Thumb_Folder_Path + '/' + RealImageName;
    rmIfExists(StrValidThumbnail_NameAndPath);
    await ResizeImage(StrValidThumbnail_NameAndPath, 0.25, filesize, ByteArray, 'FullImage');
  }
  return RealImageName;
}

function Getimageformate(img) {
  const f = sniffFormat(img);
  return f === null ? 'jpg' : f;
}

async function CreateImage(base64String, fullpathpath, imagename) {
  base64String = base64String.replace(/ /g, '+');
  if (base64String.includes('base64,')) {
    base64String = parseDataUriString(base64String);
  }
  const b = csFromBase64(base64String);
  assertImage(b);
  const extens = Getimageformate(b);
  let strValidFullName1 = mapPath(fullpathpath) + '/' + imagename;
  let strValidFullName2 = mapPath(fullpathpath) + '_Large/' + imagename;
  strValidFullName1 = changeExtension(strValidFullName1, extens);
  strValidFullName2 = changeExtension(strValidFullName2, extens);
  rmIfExists(strValidFullName1);
  rmIfExists(strValidFullName2);
  const sh = sharp();
  if (!sh) {
    // PORT-NOTE: sharp not installed - original bytes saved unchanged to both files
    writeFile(strValidFullName2, b);
    writeFile(strValidFullName1, b);
    return extens;
  }
  const meta = await sh(b).metadata();
  let filesize = b.length;
  filesize = filesize / 1024;
  const newWidth1 = meta.width;
  const newHeight1 = meta.height;
  const radio = newWidth1 / newHeight1;
  let iwidth = meta.width;
  let iheight = meta.height;
  let abc1 = 600; let abc2 = 600;
  if (iwidth > 600 || iheight > 400) {
    if (radio < 1) {
      abc1 = 600 * radio;
    } else if (radio > 1) {
      abc2 = 600 / radio;
    } else {
      abc1 = 600;
      abc2 = 400;
    }
    iwidth = bankers(abc1); iheight = bankers(abc2);
    if (radio < 1) {
      if (iwidth > 600 || iheight > 600) {
        iwidth = bankers(iwidth * radio);
        iheight = bankers(iheight * radio);
      }
    }
    if (radio > 1) {
      if (iwidth > 600 || iheight > 600) {
        iwidth = bankers(iwidth / radio);
        iheight = bankers(iheight / radio);
      }
    }
  }
  writeFile(strValidFullName2, await sh(b).resize(iwidth, iheight, { fit: 'fill' }).jpeg({ quality: 100 }).toBuffer());
  // ======================small
  if (filesize > 20 || (Math.trunc(newWidth1) > iwidth || Math.trunc(newHeight1) > iheight)) {
    iwidth = 225;
    iheight = 225;
  }
  writeFile(strValidFullName1, await sh(b).resize(iwidth, iheight, { fit: 'fill' }).jpeg({ quality: 100 }).toBuffer());
  return extens;
}
function parseDataUriString(base64String) {
  const IndexNo = base64String.indexOf('/') + 1;
  const lastIndexNo = base64String.indexOf(';');
  csSubstring(base64String, IndexNo, lastIndexNo - IndexNo); // ImageExt (validates like Substring)
  const IndexNo1 = base64String.indexOf(',') + 1;
  return base64String.substring(IndexNo1);
}

function getRandomName() { // Path.GetRandomFileName(): 8 chars + '.' + 3 chars of [a-z0-9]
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let r = '';
  for (let i = 0; i < 11; i++) { r += chars[crypto.randomInt(0, chars.length)]; if (i === 7) r += '.'; }
  return r;
}

// NOTE: the legacy call is CreateImage(Items, filenames, FolderName) while CreateImage's parameters are (base64String, fullpathpath, imagename):
// the generated file name is used as the folder and FolderName as the file name. Reproduced as is.
async function saveImage(imgecode, titlename, FolderName) {
  titlename = titlename.replace(/[^0-9a-zA-Z]+/g, '');
  titlename = titlename.replace(/[\s+]/g, '');
  let returnfilename = '';
  if (titlename.length > 5) {
    titlename = titlename.substring(0, 4);
  }
  const getcolltionimage = imgecode.split('^');
  for (const Items of getcolltionimage) {
    const filenames = titlename.trim() + getRandomName();
    if (Items.trim() !== '' && Items.includes('base64,')) {
      const getnewfilename = await CreateImage(Items, filenames, FolderName);
      if (getnewfilename.trim() !== '') {
        if (returnfilename.trim() === '') {
          returnfilename = getnewfilename;
        } else {
          returnfilename = returnfilename + '^' + getnewfilename;
        }
      }
    } else if (Items.trim() !== '' && !Items.includes('base64,')) {
      if (returnfilename.trim() === '') {
        returnfilename = path.win32.basename(Items);
      } else {
        returnfilename = returnfilename + '^' + path.win32.basename(Items);
      }
    }
  }
  return returnfilename;
}

// ---------------------------------------------------------------- misc data helpers
async function GetColorcode(ColorName) {
  const colorCode = await scalar('shopping', 'SELECT COLORCODE FROM TBL_HEXACOLRCODE WHERE COLORNAME=@ColorName AND STATUS::int=1 LIMIT 1', { ColorName });
  return colorCode;
}

function Generatehash512(text) {
  return crypto.createHash('sha512').update(Buffer.from(String(text), 'utf8')).digest('hex');
}

// DataSet => { Table: rows[] }
async function GetDataSet(strSql) {
  const rows = await query('shopping', strSql, {});
  return { Table: rows };
}

// arrParam: [{ParameterName:'@x', Value, Direction?}] (see lib/DataUtility.SqlParameter); output parameters are not sent
async function GetDataSetSPNamed(arrParam, strSPName, tblName) {
  const p = {};
  for (const a of arrParam) {
    if (a.Direction === 'Output') continue;
    p[String(a.ParameterName).replace(/^@/, '')] = a.Value;
  }
  const ds = {};
  ds[tblName] = await proc('shopping', strSPName, p);
  return ds;
}

// PORT-NOTE: the C# hashed rnd.ToString() ("System.Random") + DateTime.Now (second resolution); milliseconds and random bytes are added so ids are unique.
function Generatetxnid() {
  const strHash = Generatehash512('System.Random' + new Date().toString() + new Date().getMilliseconds() + crypto.randomBytes(4).toString('hex'));
  return strHash.substring(0, 20);
}

async function CreateAutoWithdrawal() {
  fire(async () => {
    await proc('shopping', 'usp_member_auto_withdrawal', { regno: 0 });
  });
}

async function CreateAutoWithdrawal_ROI() {
  await proc('shopping', 'usp_member_auto_withdrawal_for_growth', { regno: 0 });
}

// ---------------------------------------------------------------- paging / numbers / strings
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
  const promo = () => ControllerWithAction.includes('promos-and-advertisement');
  if (CurrentPageIndex === 1) prevClass = 'disabledli';
  if (QueryString !== '' && QueryString !== null && QueryString !== undefined) {
    if (!promo()) href = ControllerWithAction + '?page=' + PrePageNo + '&' + QueryString;
    else href = ControllerWithAction + '?page=' + Encryptword(String(PrePageNo)) + '&' + QueryString;
  } else if (!promo()) {
    href = ControllerWithAction + '?page=' + PrePageNo;
  } else {
    href = ControllerWithAction + '?page=' + Encryptword(String(PrePageNo));
  }

  let MyPagingDiv = '';
  MyPagingDiv += "<div class='pagination-container'>";
  MyPagingDiv += "<ul class='pagination'>";
  if (CurrentPageIndex > NumbersPerPage) {
    prevClass = 'enabledPrev';
    MyPagingDiv += "<li class='" + prevClass + "'><a  " + "href='" + href + "'" + '>\u00AB</a></li>';
  } else {
    prevClass = 'disabledPrev';
    MyPagingDiv += "<li class='" + prevClass + "'><a>\u00AB</a></li>";
  }

  let CurrentPageNo = StartPageNo;
  while (LoopCount >= 1) {
    Count += 1;
    if (CurrentPageIndex === CurrentPageNo) ActiveIndex = 'pageActive';
    else ActiveIndex = '';

    if (QueryString !== '' && QueryString !== null && QueryString !== undefined) {
      if (!promo()) href = ControllerWithAction + '?page=' + CurrentPageNo + '&' + QueryString;
      else href = ControllerWithAction + '?page=' + Encryptword(String(CurrentPageNo)) + '&' + QueryString;
    } else if (!promo()) {
      href = ControllerWithAction + '?page=' + CurrentPageNo;
    } else {
      href = ControllerWithAction + '?page=' + Encryptword(String(CurrentPageNo));
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

  if (QueryString !== '' && QueryString !== null && QueryString !== undefined) {
    href = ControllerWithAction + '?page=' + CurrentPageNo + '&' + QueryString;
  } else {
    href = ControllerWithAction + '?page=' + CurrentPageNo;
  }
  if (CurrentPageNo <= TotalPages) {
    NextClass = 'enabledNext';
    MyPagingDiv += "<li class='" + NextClass + "'><a " + "href='" + href + "'" + '>\u00BB</a></li>';
  } else {
    NextClass = 'disabledNext';
    MyPagingDiv += "<li class='" + NextClass + "'><a>\u00BB</a></li>";
  }

  MyPagingDiv += '</ul>';
  MyPagingDiv += "<div class='ReecordMsg'> Page " + String(CurrentPageIndex) + ' of ' + String(TotalPages) + ' (' + TotalRecord + ' Items' + ')</div>';
  MyPagingDiv += '</div>';
  return MyPagingDiv;
}

function DecimalToWords(d) {
  const formatted = String(d);
  if (formatted.includes('.')) {
    const sides = formatted.split('.');
    return NumberToText(toInt32(sides[0]), false) + ' Point ' + NumberToText(toInt32(sides[1]), false);
  }
  return NumberToText(bankers(Number(d)), false);
}

// Same algorithm as the .NET code (TripleDES/ECB/PKCS7, key = MD5(utf8(key))); Decryptword THROWS on error like the C#.
const _key = () => crypto.createHash('md5').update(Buffer.from(config.encryptionKey, 'utf8')).digest();
function Decryptword(DecryptText) {
  DecryptText = String(DecryptText);
  DecryptText = DecryptText.split('_plus_').join('+');
  DecryptText = DecryptText.split('_space_').join(' ');
  DecryptText = DecryptText.split('_slash_').join('/');
  DecryptText = DecryptText.split('_modulo_').join('%');
  DecryptText = DecryptText.split('_tild_').join('~');
  DecryptText = DecryptText.split('_dot_').join('.');
  const t = DecryptText.replace(/[ \t\r\n]/g, '');
  if (t.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(t)) throw new Error('The input is not a valid Base-64 string as it contains a non-base 64 character, more than two padding characters, or an illegal character among the padding characters.');
  const d = crypto.createDecipheriv('des-ede', _key(), null);
  return Buffer.concat([d.update(Buffer.from(t, 'base64')), d.final()]).toString('utf8');
}

function Encryptword(Encryptval) {
  return _Encryptword(Encryptval);
}

function GenerateRandomNumber() {
  const _allowedChars = 'abcdefghijkmnopqrstuvwxyz_0123456789-ABCDEFGHJKLMNOPQRSTUVWXYZ';
  let r = '';
  for (let i = 0; i < 6; i++) r += _allowedChars[Math.floor(_allowedChars.length * Math.random())];
  return r;
}

function GetCurrentDate() { return new Date(); } // DateTime.UtcNow

function GetRandom(minDigits, maxDigits) {
  if (minDigits < 1 || minDigits > maxDigits) throw new RangeError('Specified argument was out of the range of valid values.');
  return minDigits === maxDigits ? minDigits : crypto.randomInt(minDigits, maxDigits);
}

function GridNumbersPerPage() { return GRID('GridNoPerPage', 5); }
function GridPageSize() { return GRID('GridPageSize', 50); }

function NumberToText(number, isUK) {
  if (number === 0) return 'Zero';
  const and = isUK ? 'and ' : '';
  if (number === -2147483648) {
    return 'Minus Two Billion One Hundred ' + and + 'Forty Seven Million Four Hundred ' + and + 'Eighty Three Thousand ' + 'Six Hundred ' + and + 'Forty Eight';
  }
  const num = [0, 0, 0, 0];
  let first = 0;
  let u; let h; let t;
  let sb = '';
  if (number < 0) { sb += 'Minus '; number = -number; }
  const words0 = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine '];
  const words1 = ['Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const words2 = ['Twenty ', 'Thirty ', 'Forty ', 'Fifty ', 'Sixty ', 'Seventy ', 'Eighty ', 'Ninety '];
  const words3 = ['Thousand ', 'Million ', 'Billion '];
  num[0] = number % 1000;
  num[1] = Math.trunc(number / 1000);
  num[2] = Math.trunc(number / 1000000);
  num[1] = num[1] - 1000 * num[2];
  num[3] = Math.trunc(number / 1000000000);
  num[2] = num[2] - 1000 * num[3];
  for (let i = 3; i > 0; i--) {
    if (num[i] !== 0) { first = i; break; }
  }
  for (let i = first; i >= 0; i--) {
    if (num[i] === 0) continue;
    u = num[i] % 10;
    t = Math.trunc(num[i] / 10);
    h = Math.trunc(num[i] / 100);
    t = t - 10 * h;
    if (h > 0) sb += words0[h] + 'Hundred ';
    if (u > 0 || t > 0) {
      if (h > 0 || i < first) sb += and;
      if (t === 0) sb += words0[u];
      else if (t === 1) sb += words1[u];
      else sb += words2[t - 2] + words0[u];
    }
    if (i !== 0) sb += words3[i - 1];
  }
  return sb.replace(/\s+$/, '');
}

function NumberToWords(number) {
  if (number === 0) return 'zero';
  if (number < 0) return 'minus ' + NumberToWords(Math.abs(number));
  let words = '';
  if (Math.trunc(number / 1000000) > 0) {
    words += NumberToWords(Math.trunc(number / 1000000)) + ' million ';
    number %= 1000000;
  }
  if (Math.trunc(number / 1000) > 0) {
    words += NumberToWords(Math.trunc(number / 1000)) + ' thousand ';
    number %= 1000;
  }
  if (Math.trunc(number / 100) > 0) {
    words += NumberToWords(Math.trunc(number / 100)) + ' hundred ';
    number %= 100;
  }
  if (number > 0) {
    if (words !== '') words += ' ';
    const unitsMap = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tensMap = ['zero', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    if (number < 20) {
      words += unitsMap[number];
    } else {
      words += tensMap[Math.trunc(number / 10)];
      if (number % 10 > 0) words += '-' + unitsMap[number % 10];
    }
  }
  return words;
}

function RandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let r = '';
  for (let i = 0; i < length; i++) r += chars[crypto.randomInt(0, chars.length)];
  return r;
}

function RandomDigits(length) {
  let s = '';
  for (let i = 0; i < length; i++) s = s + String(crypto.randomInt(0, 10));
  return s;
}

function ValidateInt(Input) {
  if (Input === null || Input === undefined) return false;
  const t = String(Input);
  if (!/^[ \t\r\n]*[+-]?\d+[ \t\r\n]*$/.test(t)) return false;
  const n = parseInt(t.trim(), 10);
  return n >= -2147483648 && n <= 2147483647;
}

function ValidateInt64(Input) {
  if (Input === null || Input === undefined) return false;
  const t = String(Input);
  if (!/^[ \t\r\n]*[+-]?\d+[ \t\r\n]*$/.test(t)) return false;
  const n = BigInt(t.trim().replace(/^\+/, ''));
  return n >= -9223372036854775808n && n <= 9223372036854775807n;
}

async function GetDatabaseDate() {
  const Row = await queryOne('shopping', 'select fun_getcurrentdate() as currentdate');
  if (Row === null) throw new TypeError('Object reference not set to an instance of an object.');
  return Row.currentdate;
}

async function GetEwalletCurrentBalace(RegNo) {
  const row = await procOne('shopping', 'usp_getewalletdetails', { regno: RegNo });
  return toDecimal(outValue(row, 'CurrentBalance'));
}

async function GetTransCondition(Type) {
  const row = await procOne('shopping', 'usp_checktransconditions', { type: Type });
  return outValue(row, 'strOut');
}

async function Maintain_Manipulation(Emp_Code, BrCode, created_remark) {
  let retValue = '';
  try {
    const row = await procOne('shopping', 'usp_maintain_manipulations', { emp_code: Emp_Code, brcode: BrCode, created_remark });
    retValue = outValue(row, 'strResult');
  } catch (e) {
    retValue = '';
  }
  return retValue;
}

async function Send(from, to, cc, bcc, subject, body) {
  const username = '' + CompanySettings.CompanyInfoEmailId + '';
  const pass = '' + CompanySettings.CompanyMailPassword + '';
  const host = '' + CompanySettings.CompanyMailServer + '';
  from = '' + CompanySettings.CompanyInfoEmailId + '';
  const message = { subject, html: body, from: mailAddress(from) };
  if (to !== '') message.to = addrList(to);
  if (cc !== '') message.cc = addrList(cc);
  if (bcc !== '') message.bcc = addrList(bcc);
  mailAddress(from);
  return smtpSend({ host, port: 25, user: username, pass, message });
}

function removeSpacesAndSpecialChars(stringvalue) {
  const R = (s, a, b) => s.split(a).join(b);
  let v = stringvalue.trim();
  v = v.toLowerCase();
  v = R(v, 'c#', 'C-Sharp');
  v = R(v, ' ', '-');
  v = R(v, '&', 'and');
  v = R(v, 'amp;', '');
  v = R(v, '/', '-');
  v = R(v, '\\', '-');
  v = R(v, '\\', '-');
  v = R(v, '.', '');
  v = R(v, ',', '');
  v = R(v, '|', '-');
  v = R(v, '#', '-');
  v = R(v, '*', 'star');
  v = R(v, ':', '-');
  v = R(v, '+', 'plus');
  v = R(v, '---', '-');
  v = R(v, '--', '-');
  return v.trim();
}

async function SendGrowthInMobile(Message) {
  const Lim = mapRows(await query('shopping', `select M.mobile,M.LoginId,MP.currentIncome as totalIncome,
       case  when G.Updated_DailyGrowth_Rate>G.DailyGrowth_Rate then Updated_DailyGrowth_Rate else DailyGrowth_Rate
       end as  DailyReturn from member_Master M,tbl_GrowthMaster G,tbl_DailyGrowthAccount D,Member_Performance MP where
        G.RegNo=M.regNo and D.GMID=G.GMID and fun_getCurrentDate()::date=d.toDate::date
        and MP.regno=M.regNo and M.mobile<>'' and M.Active::int=1  and G.CurrentReturn<G.MaxReturn  and MP.currentIncome>0`), ['mobile', 'LoginId', 'totalIncome', 'DailyReturn']);
  for (const Item of Lim) {
    const MobileNoTemp = Item.mobile;
    const Loginid = Item.LoginId;
    const TodayGrowth = Number(Item.DailyReturn);
    const Msg = 'Dear user, your account ID ' + Loginid + ' is credited by ' + (TodayGrowth < 0 ? '-' : '') + String(Math.round(Math.abs(TodayGrowth))) + 'points. ';
    await SendMsgOnMobile(MobileNoTemp, Msg);
  }
}

async function UpdateGrowthByGlobal() {
  const row = await procOne('shopping', 'usp_updaetgrowth', { regno: '0' });
  const OutputResult = outValue(row, 'strResult');
  if (OutputResult === 'ok') {
    fire(async () => {
      await CreateAutoWithdrawal_ROI();
      await SendGrowthInMobile('ok');
    });
  }
}

async function TrackError(ErrorMsg) {
  try {
    await exec('shopping', 'INSERT INTO TBL_ERRORLOG(DESCRIPTION,ERRORTIME,STATUS) VALUES(@ErrorMsg, fun_getcurrentdate(), 1)', { ErrorMsg });
  } catch (ex) {
    // swallowed
  }
}

// ---------------------------------------------------------------- Franchisee settlement
const CREDIT_REMARK = 'Franchisee Onboarding Settlement Done !';

async function _trackWallet(RequestedTranId, ErrorCode, TrnId, ReturnMsg, Location) {
  await exec('shopping', 'Insert Into Tbl_WALLETAPITRACKING(RequestedTranId,ErrorCode,TrnId,ReturnMsg,Location,ACTIVITYDATETIME) Values(@a,@b,@c,@d,@e,fun_getcurrentdate())',
    { a: RequestedTranId, b: ErrorCode, c: TrnId, d: ReturnMsg, e: Location });
}

// One credit run (identical logic for the onboarding and the flat-fee commission tables)
async function _settle(list, table, idCol, CoinRate) {
  for (const Item of list) {
    if ((Item.EURWorth > 0 || Item.InvEURWorth > 0) && CoinRate > 0) {
      const INVWorth = Item.InvEURWorth;
      const EURWorth = Item.EURWorth;
      const NoofINVToBeCredit = INVWorth / CoinRate;
      const NoofEURToBeCredit = EURWorth;
      let ErrorCode = '';
      let TrnId = '';
      let ReturnMsg = '';
      let TransactionId = '';
      try {
        // ---- INV credit
        TransactionId = crypto.randomUUID();
        await scalar('shopping', 'SELECT CAST(fun_getcurrentdate() AS VARCHAR)'); // DateTime (unused value)
        const UserName = await scalar('shopping', 'Select USERNAME From MEMBER_MASTER WHERE EMAILID=@e limit 1', { e: Item.EmailId });
        let r = await procOne('shopping', 'usp_creditshopping_payment', { username: UserName, remark: CREDIT_REMARK, amount: NoofINVToBeCredit, currency: 'INV' });
        ErrorCode = outValue(r, 'ERRORCODE'); TrnId = outValue(r, 'TRNID'); ReturnMsg = outValue(r, 'RETURNMSG');
        await _trackWallet(TransactionId, ErrorCode, TrnId, ReturnMsg, 'After API Call');
        const flag = ErrorCode === '17104' ? 1 : 2;
        await exec('shopping', 'Update ' + table + ' Set NoOfINV=@n,INVTranId=@t,INVReturnMsg=@m,INVRate=@rate,IsCreditedOnExchnage=@f WHERE ' + idCol + '=@id',
          { n: NoofINVToBeCredit, t: TrnId, m: ReturnMsg, rate: CoinRate, f: flag, id: Item.ID });

        // ---- EUR credit
        TransactionId = crypto.randomUUID();
        await scalar('shopping', 'SELECT CAST(fun_getcurrentdate() AS VARCHAR)');
        const UserNameT = await scalar('shopping', 'Select USERNAME From MEMBER_MASTER WHERE EMAILID=@e limit 1', { e: Item.EmailId });
        r = await procOne('shopping', 'usp_creditshopping_payment', { username: UserNameT, remark: CREDIT_REMARK, amount: NoofEURToBeCredit, currency: 'EUR' });
        ErrorCode = outValue(r, 'ERRORCODE'); TrnId = outValue(r, 'TRNID'); ReturnMsg = outValue(r, 'RETURNMSG');
        await _trackWallet(TransactionId, ErrorCode, TrnId, ReturnMsg, 'After API Call');
        const flag2 = ErrorCode === '17104' ? 1 : 2;
        await exec('shopping', 'Update ' + table + ' Set EURTranId=@t,EURReturnMsg=@m,IsCreditedOnExchnage=@f WHERE ' + idCol + '=@id',
          { t: TrnId, m: ReturnMsg, f: flag2, id: Item.ID });
      } catch (objExp) {
        await _trackWallet('', '', '', objExp.message, 'Catch Block');
      }
    }
  }
}

async function Franchisee_Settlement() {
  const CoinRate = 1.0;
  const PROPS = ['EmailId', 'EURWorth', 'InvEURWorth', 'ID'];
  const liGetBoardingQueryData = mapRows(await query('shopping', `Select EmailId,FranchiseeCommissionEur As EURWorth,
FranchiseeCommissionINVEurWorth As InvEURWorth,TFOCDID As ID From TBL_FRANCHISEEONBOARDINGCOMMISSIONMONTHLY
Inner Join TBL_DISTRIBUTOR ON TBL_DISTRIBUTOR.DID=TBL_FRANCHISEEONBOARDINGCOMMISSIONMONTHLY.DID
Where IsCreditedOnExchnage::int=0`), PROPS);
  const liGetFlatFeeQueryData = mapRows(await query('shopping', `Select EmailId,FranchiseeCommissionEur As EURWorth,
FranchiseeCommissionINVEurWorth As InvEURWorth,TFFFCDID As ID From TBL_FRANCHISEEFLATFEECOMMISSIONMONTHLY
Inner Join TBL_DISTRIBUTOR ON TBL_DISTRIBUTOR.DID=TBL_FRANCHISEEFLATFEECOMMISSIONMONTHLY.DID
Where IsCreditedOnExchnage::int=0`), PROPS);
  // For Franchisee Onboarding Commission Credit
  await _settle(liGetBoardingQueryData, 'TBL_FRANCHISEEONBOARDINGCOMMISSIONMONTHLY', 'TFOCDID', CoinRate);
  // For Franchisee Flat Fee Commission Credit
  await _settle(liGetFlatFeeQueryData, 'TBL_FRANCHISEEFLATFEECOMMISSIONMONTHLY', 'TFFFCDID', CoinRate);
}

async function Auto_Update_Merchant_Order_Process() {
  try {
    const row = await procOne('shopping', 'usp_merchantordercompleteprocess', {});
    const OutPutMessage = outValue(row, 'STRPROCESSOUTPUT');
  } catch (ExpObj) {
    const OutPutMessage = ExpObj.message;
  }
}

async function Auto_Update_Reseller_Comission_Process() {
  try {
    const row = await procOne('shopping', 'usp_autoupdation_reseller_commission', {});
    const OutPutMessage = outValue(row, 'STRPROCESSOUTPUT');
  } catch (ExpObj) {
    const OutPutMessage = ExpObj.message;
  }
}

// ---------------------------------------------------------------- mail / sms
const EMAIL_RE = /^([\w.\-]+)@([\w\-]+)((\.(\w){2,3})+)$/;
function validAddrs(csv) { // addresses that match the legacy regex (after TrimStart/TrimEnd) are added
  const out = [];
  for (const a of csv.split(',')) {
    if (EMAIL_RE.test(a.trim()) && a !== '') out.push(a.trim());
  }
  return out;
}
function applyRecipients(msg, ToEmailId, CC_EmailId, BCC_EmailId) {
  if (ToEmailId !== '') { const l = validAddrs(ToEmailId); if (l.length) msg.to = l; }
  if (CC_EmailId !== '') { const l = validAddrs(CC_EmailId); if (l.length) msg.cc = l; }
  if (BCC_EmailId !== '') { const l = validAddrs(BCC_EmailId); if (l.length) msg.bcc = l; }
}

async function SendEmailByApiSetting(user, password, hostname, FromEmailId, BCC_EmailId, CC_EmailId, ToEmailId, Subject, BodyMessage, fileUploader, SenderId = '', SenderName = '') {
  try {
    const username = user; const pass = password; const host = hostname;
    const msg = { subject: Subject, html: BodyMessage };
    if (fileUploader !== null && fileUploader !== undefined) {
      const fileName = path.win32.basename(fileUploader.originalname || fileUploader.filename || '');
      msg.attachments = [{ filename: fileName, content: fileUploader.buffer }];
    }
    msg.from = (SenderId === '' || SenderName === '') ? mailAddress(FromEmailId) : mailAddress(SenderId, SenderName);
    applyRecipients(msg, ToEmailId, CC_EmailId, BCC_EmailId);
    if (SenderId === '' || SenderName === '') mailAddress(FromEmailId); else mailAddress(SenderId, SenderName);
    return await smtpSend({ host, port: 25, user: username, pass, message: msg });
  } catch (ex) {
    return String(ex.message);
  }
}

// PORT-NOTE: the legacy code blanks FromEmailId/host/credentials, so the MailAddress("") constructor throws (ArgumentException) when SenderId/SenderName are empty - reproduced.
async function SendMsgOnEmail(FromEmailId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage, SenderId = '', SenderName = '') {
  const username = ''; const pass = ''; const host = '';
  FromEmailId = '';
  const msg = { subject: Subject, html: BodyMessage };
  msg.from = (SenderId === '' || SenderName === '') ? mailAddress(FromEmailId) : mailAddress(SenderId, SenderName);
  applyRecipients(msg, ToEmailId, CC_EmailId, BCC_EmailId);
  if (SenderId === '' || SenderName === '') mailAddress(FromEmailId); else mailAddress(SenderId, SenderName);
  return smtpSend({ host, port: 25, user: username, pass, message: msg });
}

async function _get(url) {
  await axios.get(safeUrl(url), { responseType: 'text', transformResponse: [(d) => d], maxRedirects: 5, timeout: 100000 });
}

async function SendMsgOnMobile(MobileNo, Message, type = '', did = 0) {
  let res = 0;
  let CompanySMSAPI = ''; let baseurl = '';
  try {
    if (type !== '' && did !== 0) {
      CompanySMSAPI = await scalar('shopping', "SELECT coalesce(SMSAPI,'') FROM TBL_COMPANYSETTINGS Where PMID in (Select coalesce(PMID,0) FROM TBL_DISTRIBUTOR WHERE DID=@did) limit 1", { did });
      baseurl = s_(CompanySMSAPI) + MobileNo + '&message=' + Message + '&response=Y';
      await _get(baseurl);
      res = 1;
    } else {
      CompanySMSAPI = config.app.CompanySMSAPI || '';
      const CompanySMSAPIUSERNAME = config.app.CompanySMSAPIUSERNAME || '';
      const CompanySMSAPIPASSWORD = config.app.CompanySMSAPIPASSWORD || '';
      const CompanySMSAPISENDERID = config.app.CompanySMSAPISENDERID || '';
      baseurl = CompanySMSAPI + 'username=' + CompanySMSAPIUSERNAME + '&pass=' + CompanySMSAPIPASSWORD + '&senderid=' + CompanySMSAPISENDERID + '&dest_mobileno=' + MobileNo + '&message=' + Message + '&response=Y';
      await _get(baseurl);
      res = 1;
    }
  } catch (e) {
    res = 0;
  }
  return res;
}

async function SendMsgToMobileWithSelfAccount(Api) {
  let success = 0;
  try {
    await _get(Api);
    success = 1;
  } catch (e) {
    success = 0;
  }
  return success;
}

async function TrackResellerMessages(mobileNo, Message, process) {
  try {
    await exec('shopping', 'INSERT INTO TBL_RESELLER_MESSAGES(MOBILENO,MESSAGE,PROCESS) VALUES(@m, @msg, @p)', { m: mobileNo, msg: Message, p: process });
  } catch (ex) { /* swallowed */ }
}

async function TrackRegistrationEmail(emailId, mailBody, process) {
  try {
    const row = await procOne('shopping', 'usp_reseller_registration_email', { emailid: emailId, mailbody: mailBody, process });
    const OutputResult = outValue(row, 'STROUTPUT');
  } catch (ex) { /* swallowed */ }
}

async function TrackCustomersMessages(mobileNo, Message, process) {
  try {
    await exec('shopping', 'INSERT INTO TBL_CUSTOMERS_MESSAGES(MOBILENO,OTP,PROCESS) VALUES(@m, @msg, @p)', { m: mobileNo, msg: Message, p: process });
  } catch (ex) { /* swallowed */ }
}

async function TrackMerchantsMessages(mobileNo, Message, process) {
  try {
    await exec('shopping', 'INSERT INTO TBL_MERCHANTS_MESSAGES(MOBILENO,OTP,PROCESS) VALUES(@m, @msg, @p)', { m: mobileNo, msg: Message, p: process });
  } catch (ex) { /* swallowed */ }
}

async function TrackMerchantsEmails(emailId, mailBody, process) {
  try {
    const row = await procOne('shopping', 'usp_merchants_registration_email', { emailid: emailId, mailbody: mailBody, process });
    const OutputResult = outValue(row, 'STROUTPUT');
  } catch (ex) { /* swallowed */ }
}

async function TrackCustomersEmails(emailId, mailBody, process) {
  try {
    const row = await procOne('shopping', 'usp_customers_registration_email', { emailid: emailId, mailbody: mailBody, process });
    const OutputResult = outValue(row, 'STROUTPUT');
  } catch (ex) { /* swallowed */ }
}

async function CheckAndSendMsgOnEmail(UserId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage, SenderId = '', SenderName = '', FromEmailId = '') {
  const username = '' + CompanySettings.CompanyInfoEmailId + '';
  const pass = '' + CompanySettings.CompanyMailPassword + '';
  const host = '' + CompanySettings.CompanyMailServer + '';
  FromEmailId = '' + CompanySettings.CompanyInfoEmailId + '';
  const msg = { subject: Subject, html: BodyMessage };
  msg.from = (SenderId === '' || SenderName === '') ? mailAddress(FromEmailId) : mailAddress(SenderId, SenderName);
  applyRecipients(msg, ToEmailId, CC_EmailId, BCC_EmailId);
  if (SenderId === '' || SenderName === '') mailAddress(FromEmailId); else mailAddress(SenderId, SenderName);
  return smtpSend({ host, port: 25, user: username, pass, message: msg });
}

// PORT-NOTE: the legacy thread requests an empty URL (Baseurl = ""), which always fails; no request is made and "1" is returned immediately like the C#.
async function CheckAndSendMsgOnMobile(UserId, MobileNo, Message) {
  const result = '1';
  return result;
}

function ToOrdinal(value) {
  let exts = 'th';
  const last_digits = value % 100;
  if (last_digits < 11 || last_digits > 13) {
    switch (last_digits % 10) {
      case 1: exts = 'st'; break;
      case 2: exts = 'nd'; break;
      case 3: exts = 'rd'; break;
      default: break;
    }
  }
  return value + exts;
}

async function BlastCampaign() {
  fire(async () => { /* empty body in the legacy code */ });
}

function _kycRecordsLoop(mode, kycType, TPL, msgText) {
  return async () => {
    let Ret = '';
    try {
      const args = mode === undefined ? { regno: 0 } : { regno: 0, mode: 1 };
      const ObjkycRecords = mapRows(await proc('shopping', 'usp_auto_kyc', args), ['PLid', 'Fname']);
      for (let i = 0; i < ObjkycRecords.length; i++) {
        const Regno = ObjkycRecords[i].PLid;
        const row = await queryOne('shopping', 'select * from kyc_distributor where regno=@Regno and kyctype=@kycType limit 1', { Regno, kycType });
        if (row === null) {
          const row1 = await queryOne('shopping', 'select * from tbl_distributor where did=@Regno limit 1', { Regno });
          if (row1 === null) throw new TypeError('Object reference not set to an instance of an object.');
          const MemName = row1.fname;
          const msgForMobile = 'Dear ' + MemName + msgText + CompanySettings.CompanyName + ' Team';
          const username = row1.username;
          const Emailid = row1.emailid;
          const Mobile = row1.phone;
          let send = 0;
          try {
            const subject = '' + CompanySettings.CompanyName + ' Support Center';
            let mailtxt = '';
            if (send === 0) {
              mailtxt = TPL;
              mailtxt = rep(mailtxt, '$$lblName$$', username);
              mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
              mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
              mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
              mailtxt = rep(mailtxt, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
              const result = await SendMailLib.Send1('', Emailid, '', '', subject, mailtxt);
              if (result === 's') {
                send = 1;
              } else {
                return;
              }
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
  };
}

async function Auto_Mail() {
  fire(_kycRecordsLoop(undefined, 1, TPL_AUTOMAIL, ',\r\nWe request you to submit your KYC documents as soon as possible Thank you.\r\n The '));
}

async function BusinessKYC_Auto_Mail() {
  fire(_kycRecordsLoop(1, 2, TPL_BIZMAIL, ',\r\n We request you to submit your Business KYC documents as soon as possible Thank you.\r\n The '));
}

function SizeSuffix(value) {
  if (value < 0) return '-' + SizeSuffix(-value);
  if (value === 0) return '0.0 bytes';
  const mag = Math.trunc(Math.log(value) / Math.log(1024));
  const adjustedSize = value / Math.pow(2, mag * 10);
  const a = Math.round((adjustedSize + Number.EPSILON) * 10) / 10;
  return a.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ' + SizeSuffixes[mag];
}

async function updatemerchantkyc(plid) {
  let result = 0; let countkyc = 0; let countbankverifyied = 0; let Entitype = 0;
  try {
    countkyc = toInt32(await scalar('shopping', 'Select count(1) from KYC_DISTRIBUTOR where IsAprove::int=0 and Regno=@plid', { plid }));
    countbankverifyied = toInt32(await scalar('shopping', 'Select count(1) from BANK_ACCOUNTS_DISTRIBUTOR where DID=@plid and ACTIVE::int=1 and ISAPROVE::int=0', { plid }));
    const et = await scalar('shopping', 'Select distinct EntityType from Tbl_BusinessKycDetails_DISTRIBUTOR where DID=@plid limit 1', { plid });
    Entitype = et === null || et === undefined ? 0 : toInt32(et);
    if (Entitype === 1 && countkyc === 2 && countbankverifyied === 1) {
      await exec('shopping', 'Update TBL_DISTRIBUTOR set iskycapproved=2 where DID=@plid and ACTIVE::int=1', { plid });
      result = 1;
    } else if (Entitype === 3 && countkyc === 6 && countbankverifyied === 1) {
      await exec('shopping', 'Update TBL_DISTRIBUTOR set iskycapproved=2 where DID=@plid and ACTIVE::int=1', { plid });
      result = 1;
    } else {
      result = 0;
    }
    return result;
  } catch (Ex) {
    throw new Error(Ex.message);
  }
}

module.exports = {
  SpecialCharsForLoginID, MessageType, SelectBranchType, RoleUserType, SeclectUserType, SelectAddressType, ImageMode,
  ExchangeRateFromAPI, ImageUploadMasterMethodEComm, ImageUploadMasterMethod, ResizeImagekyc, ResizeImage, UploadImageFromExtractProcess,
  GetColorcode, Generatehash512, GetDataSet, GetDataSetSPNamed, Generatetxnid, CreateAutoWithdrawal, CreateAutoWithdrawal_ROI,
  CreateCustomPagging_ServerSide, DecimalToWords, Decryptword, Encryptword, GenerateRandomNumber, GetCurrentDate, Getimageformate, GetRandom,
  getRandomName, GridNumbersPerPage, GridPageSize, NumberToText, NumberToWords, RandomString, RandomDigits, saveImage, CreateImage,
  ValidateInt, ValidateInt64, GetDatabaseDate, GetEwalletCurrentBalace, GetTransCondition, Maintain_Manipulation, Send, removeSpacesAndSpecialChars,
  SendGrowthInMobile, UpdateGrowthByGlobal, TrackError, Franchisee_Settlement, Auto_Update_Merchant_Order_Process, Auto_Update_Reseller_Comission_Process,
  SendEmailByApiSetting, SendMsgOnEmail, SendMsgOnMobile, SendMsgToMobileWithSelfAccount, TrackResellerMessages, TrackRegistrationEmail,
  TrackCustomersMessages, TrackMerchantsMessages, TrackMerchantsEmails, TrackCustomersEmails, CheckAndSendMsgOnEmail, CheckAndSendMsgOnMobile,
  ToOrdinal, BlastCampaign, Auto_Mail, BusinessKYC_Auto_Mail, SizeSuffix, updatemerchantkyc,
};
