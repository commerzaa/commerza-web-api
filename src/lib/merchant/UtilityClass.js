/** Exports (Merchant Panel Models/UtilityClass.cs; object = { ...src/lib/UtilityClass (shared API port), ...merchant overrides/ports }):
 *  Database: 'shopping' (Merchant Web.config DataBaseContext = Db_Shopping). Async unless marked [sync].
 *  fields/enums: SpecialCharsForLoginID[], MessageType, SelectBranchType, RoleUserType, SeclectUserType (shared), SelectAddressType (shared),
 *    ImageMode {Thumbnail:0, SemiLarge:1, Original:2, Both:3}  (MERCHANT enum - differs from the shared {Thumbnail,Original,Both})
 *  classes: DatabaseDate (shared), EmailParam (shared), EwalletDetails, UserTypes, Kyc_Record
 *  --- reused from the shared lib (C# identical): Encryptword(Encryptval) [sync] ; Decryptword(DecryptText) [sync, '' on error] ; Generatehash512(text) ;
 *    Generatetxnid() ; RandomNumberStringByLength(length) [sync] ; GridNumbersPerPage() [sync] ; GridPageSize() [sync] ;
 *    TrackCustomersMessages(mobileNo, Message, process) ; TrackCustomersEmails(emailId, mailBody, process)
 *  --- merchant overrides of shared names:
 *    ImageUploadMasterMethodECommNew(ImageBase64Code, OriginalImage, SemiLargeImage, ThumbNailImage, IMode, IdForAppend) : string
 *    ImageUploadMasterMethod(ImageBase64Code, Orginial_Folder_Name, Thumb_Folder_Name, IMode, IdForAppend) : string   (throws, like the C#)
 *    ResizeImage(FullName, scaleFactor, filesize(KB), fromstream:Buffer, Folder) ; GetDataSetSPNamed(arrParam, strSPName, tblName) : {[tblName]: rows}
 *    GetDatabaseDate() : Date ; CallBackAddress(ToEmailID, Subject, EmailContent) : "s" | error message | ""
 *    SendEmailByApiSetting(user, password, hostname, FromEmailId, BCC_EmailId, CC_EmailId, ToEmailId, Subject, BodyMessage, fileUploader{originalname,buffer}|null, SenderId="", SenderName="") : string
 *    SendMsgOnMobile(MobileNo, Message, type="", did=0) : int ; TrackOTP(mobileNo, OTP, process)
 *    CheckAndSendMsgOnEmail(UserId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage, SenderId="", SenderName="", FromEmailId="") : string
 *  --- ported (missing in the shared lib):
 *    ExchangeRateFromAPI() | ExchangeRateFromAPI(amount, firstCcode, lastCcode) : decimal ; ImageUploadMasterMethodEComm(ImageBase64Code, OriginalImage, ThumbNailImage, IMode, IdForAppend) : string
 *    GetDataSet(strSql) : {Table: rows} ; CreateAutoWithdrawal() ; CreateAutoWithdrawal_ROI()
 *    CreateCustomPagging_ServerSide(ControllerWithAction, QueryString, TotalRecord, PageSize, NumbersPerPage, CurrentPageIndex) : string [sync]
 *    DecimalToWords(d) [sync] ; GenerateRandomNumber() [sync] ; GetCurrentDate() [sync] ; Getimageformate(imgBuffer) [sync] ; GetRandom(minDigits, maxDigits) [sync]
 *    getRandomName() [sync] ; NumberToText(number, isUK) [sync] ; NumberToWords(number) [sync] ; RandomString(length) [sync] ; RandomDigits(length) [sync]
 *    saveImage(imgecode, titlename, FolderName) : string ; CreateImage(base64String, fullpathpath, imagename) : string ; ValidateInt(Input) [sync] ; ValidateInt64(Input) [sync]
 *    GetEwalletCurrentBalace(RegNo) : decimal ; GetTransCondition(Type) : string ; Maintain_Manipulation(Emp_Code, BrCode, created_remark) : string
 *    CallBackAddress1(ToEmailId, Subject, EmailContent) : "success" | error message ; Send(from, to, cc, bcc, subject, body) : "success"
 *    removeSpacesAndSpecialChars(stringvalue) [sync] ; SendGrowthInMobile(Message) ; UpdateGrowthByGlobal() ; TrackError(ErrorMsg) (rethrows)
 *    TrackRegistrationEmail / TrackMerchantsEmails(emailId, mailBody, process) ; TrackMerchantsMessages(mobileNo, Message, process)
 *    SendMsgOnEmail(FromEmailId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage, SenderId="", SenderName="") : string
 *    SendMsgToMobileWithSelfAccount(Api) : int ; CheckAndSendMsgOnMobile(UserId, MobileNo, Message) : string ; ToOrdinal(value) [sync]
 *    BlastCampaign() ; Auto_Mail() ; BusinessKYC_Auto_Mail() ; UploadImageFromExtractProcess(ByteArray:Buffer, Orginial_Folder_Path, Thumb_Folder_Path, IMode, RealImageName) : string
 *    ResizeImagekyc(FullName, scaleFactor, filesize(KB), fromstream:Buffer, Folder) ; SizeSuffix(value) [sync] ; GetColorcode(ColorName) : string|null
 *  --- shared-only members (not in the Merchant C#) remain available unchanged through the spread (SendSMSWithAPI, SendEmail, SaveSMSHistory, ...).
 *  PORT-NOTE: Server.MapPath(x) => config.uploadDir/<x without leading ~ / ./ ../ and slashes>.
 *  PORT-NOTE: System.Drawing resize/re-encode uses the optional `sharp` package (lazily required, NOT installed); without it the decoded bytes are written unchanged
 *             and image-dimension checks are skipped. Target folders are created when missing (Image.Save threw on a missing folder).
 *  PORT-NOTE: background Threads => fire-and-forget promises (errors logged, the process does not crash like an unhandled Thread exception would).
 *  PORT-NOTE: concatenated T-SQL (TrackError/TrackOTP/Track*Messages/GetColorcode) is parameterised.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const config = require('../../config');
const { query, queryOne, scalar, exec, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { outValue } = require('../_http');
const { fire } = require('../_libhelpers');
const { mailAddress, addrList, smtpSend } = require('../franchise/_mailhelpers');
const CompanySettings = require('./CompanySettings');
const Shared = require('../UtilityClass');

const DB = 'shopping';

// ---------------------------------------------------------------- e-mail templates (Auto_Mail / BusinessKYC_Auto_Mail, verbatim from the C#)
const TPL_AUTOMAIL = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>\r\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>\r\n    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\r\n    <table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>\r\n        <tbody>\r\n      <tr>\r\n        <td><table style='width:100%;'>\r\n            <tbody>\r\n              <tr>\r\n                <td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\r\n              </tr>\r\n            </tbody>\r\n          </table></td>\r\n      </tr>\r\n        <tr>\r\n        <td>\r\n\r\n      <div>\r\n        <div class='clear'></div>\r\n        <table style='padding-bottom: 10px; width: 100%; '>\r\n          <tbody>\r\n            <tr>\r\n              <td>\r\n            <tr>\r\n              <td align='center'>\r\n\r\n         <strong style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> KYC Documents – Polite Reminder </p> </strong>\r\n\r\n         <div style='text-align:left;'>\r\n\r\n                                            <h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px\r\n\r\n15px; color: #3f3f42;'>Dear $$lblName$$, </h1>\r\n\r\n    <div style='font-size: 15px; color: #333;'>\r\n    \t\t\t\t<p style='font-size:14px; line-height:19px;  margin-top:20px; margin-bottom:0;'>We again remind you to submit your KYC documents within next 24hrs to benefit the use of our Referral Program system. </p>\r\n\r\n                </div>\r\n\r\n         </div>\r\n\r\n                <div style='clear: both'></div></td>\r\n            </tr>\r\n          <div style='margin: auto; padding-top: 0px; padding-bottom: 0px;display:none; margin-top: 0px; border-bottom:1px solid #00a0a8;'>\r\n            <center>\r\n              <img src='http://webmail.$$CompanyURL$$/imp/themes/default/graphics/spacer_red.png' htmlimgblocked='https://$$CompanyURL$$/images/divider.png'>\r\n            </center>\r\n          </div>\r\n          <div style='clear: both'></div>\r\n          <div style='clear: both'></div>\r\n            </td>\r\n\r\n            </tr>\r\n          <tr>\r\n            <td>\r\n\r\n                <table style='width:100%;'>\r\n                        <tbody>\r\n                          <tr>\r\n                            <td  colspan='2' align='center'><div style='margin-right: 7px; border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'> <font style='margin-right:0px; font-size: 16px; color:#000; font-family:  Arial, Helvetica, sans-serif; float: left; margin-top:2px; font-weight: normal; padding-top:3px'> </font>\r\n <a href='$$FacebookShare$$' style='color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target='8SE_b89lng5GVbx5a7NZME9'>   <img src='https://$$CompanyURL$$/images/mailer-facebook.png'  style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' > </a>\r\n <a href='$$TwitterShare$$' style='color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='e3PP7S0O2rDcb5kT5Qxvkl9'>  <img src='https://$$CompanyURL$$/images/mailer-twitter.png' style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' ></a>\r\n <a href='$$GoogleplusShare$$' style='color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='k_lu77WHdSxxe84MTtrgPlD'>  <img src='https://$$CompanyURL$$/images/mailer-gplus.png'  style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' > </a>\r\n <a href='$$LinkedinShare$$' style='color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='1QtmtsX-zlkY3NH-RX8bXJB'>  <img src='https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' ></a>\r\n <a href='$$PinterestShare$$' style='color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='FTivBEnhJ2wIlo_i9yYL1Xk'>  <img src='https://$$CompanyURL$$/images/mailer-pintrest.png'  style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' ></a> </div></td>\r\n                          </tr>\r\n                        </tbody>\r\n                      </table>\r\n\r\n         </td>\r\n          </tr>\r\n            </tbody>\r\n        </table>\r\n        <div class='clear'></div>\r\n      </div>\r\n        </td>\r\n\r\n        </tr>\r\n        </tbody>\r\n    </table>\r\n  </div>\r\n\r\n    <p style='font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>\r\n</div>";
const TPL_BIZMAIL = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>\r\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>\r\n    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\r\n    <table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>\r\n        <tbody>\r\n\r\n      <tr>\r\n        <td><table style='width:100%;'>\r\n            <tbody>\r\n              <tr>\r\n                <td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='http://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\r\n              </tr>\r\n            </tbody>\r\n          </table></td>\r\n      </tr>\r\n        <tr>\r\n\r\n        <td>\r\n\r\n      <div>\r\n        <div class='clear'></div>\r\n        <table style='padding-bottom: 10px; width: 100%; '>\r\n          <tbody>\r\n            <tr>\r\n              <td>\r\n            <tr>\r\n              <td align='center'><strong style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Business KYC – Polite Reminder\r\n                </p>\r\n                </strong>\r\n                <div style='text-align:left;'>\r\n                  <h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px\r\n\r\n15px; color: #3f3f42;'>Dear $$lblName$$, </h1>\r\n                  <div style='font-size: 15px; color: #333;'>\r\n                    <p style='font-size:14px; line-height:19px;  margin-top:20px; margin-bottom:0;'>We are reminding you to submit your Business KYC documents within next 24 Hrs. to get the benefit of your Business Listing.</p>\r\n                  </div>\r\n                </div>\r\n                <div style='clear: both'></div>\r\n                <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\r\n                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>\r\n                          <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> If you have any issues,\r\n            we will be happy to help you. You can contact us on <a href = 'mailto:$$SupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$SupportEmailId$$ </a></p>\r\n\r\n                                     </div>\r\n\r\n                                     </td>\r\n\r\n                                 </tr>\r\n\r\n                               <div style = 'clear: both'></div>\r\n\r\n                                <div style = 'clear: both'></div>\r\n\r\n                                   </td>\r\n\r\n                                   </tr>\r\n\r\n                                 <tr>\r\n\r\n                                   <td><table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>\r\n\r\n                                          <tbody>\r\n\r\n                                            <tr>\r\n\r\n                                            <td>\r\n\r\n                                                <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>\r\n\r\n                                                   <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5>\r\n\r\n                                                  </td>\r\n\r\n                                                    <td>\r\n\r\n                                                    <div style = 'margin-right: 7px; text-align:right'>\r\n\r\n                                                     <a href = '$$FacebookShare$$' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'http://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\r\n\r\n                                                                <a href = '$$TwitterShare$$' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'http://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\r\n\r\n                                                                           <a href = '$$GoogleplusShare$$' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'http://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\r\n\r\n                                                                                      <a href = '$$LinkedinShare$$' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'http://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\r\n\r\n                                                                                                  <a href = '$$PinterestShare$$' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'http://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>\r\n\r\n                                                                                                             </div></td>\r\n\r\n                                                                                                          </tr>\r\n\r\n                                                                                                        </tbody>\r\n\r\n                                                                                                      </table></td>\r\n\r\n                                                                                                  </tr>\r\n\r\n                                                                                                    </tbody>\r\n\r\n                                                                                                </table>\r\n\r\n                                                                                                <div class='clear'></div>\r\n      </div>\r\n        </td>\r\n\r\n        </tr>\r\n\r\n        </tbody>\r\n\r\n    </table>\r\n  </div>\r\n  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>\r\n</div>";

// ---------------------------------------------------------------- fields / enums
const SpecialCharsForLoginID = '!#$%^&*();,?+~`\''.split('');
const SizeSuffixes = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
const MessageType = { MobileSMS: 0, WebEmail: 1, 0: 'MobileSMS', 1: 'WebEmail' };
const SelectBranchType = { Dump_Warehouse: 0, Branch_Store: 1, Franchise: 2, Merchant: 3, 0: 'Dump_Warehouse', 1: 'Branch_Store', 2: 'Franchise', 3: 'Merchant' };
const RoleUserType = { Admin: 0, Merchant: 1, 0: 'Admin', 1: 'Merchant' };
const ImageMode = { Thumbnail: 0, SemiLarge: 1, Original: 2, Both: 3, 0: 'Thumbnail', 1: 'SemiLarge', 2: 'Original', 3: 'Both' };

// ---------------------------------------------------------------- private helpers
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
// int.Parse / Convert.ToInt32(string) (null => 0 only for Convert)
function toInt32(v, convertNull) {
  if ((v === null || v === undefined) && convertNull) return 0;
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
// Convert.ToBoolean(string): null => false, "true"/"false" (trimmed, any case), otherwise FormatException
function toBoolean(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'boolean') return v;
  const t = String(v).trim().toLowerCase();
  if (t === 'true') return true;
  if (t === 'false') return false;
  throw new Error('String was not recognized as a valid Boolean.');
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
function sharp() { // lazy optional dependency
  if (_sharp === undefined) { try { _sharp = require('sharp'); } catch (e) { _sharp = null; } }
  return _sharp;
}
function writeFile(file, buf) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf); }
function rmIfExists(file) { if (fs.existsSync(file)) fs.unlinkSync(file); }
function changeExtension(p, ext) { // Path.ChangeExtension(p, ext)
  const base = p.replace(/\.[^./\\]*$/, '');
  return ext ? base + '.' + ext.replace(/^\./, '') : base;
}
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
// DateTime.Now.ToString("ddMMyyyyhhmmssffffff")
function netStamp() {
  const d = new Date(); const p2 = (n) => String(n).padStart(2, '0');
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return p2(d.getDate()) + p2(d.getMonth() + 1) + d.getFullYear() + p2(h12) + p2(d.getMinutes()) + p2(d.getSeconds()) + String(d.getMilliseconds() * 1000).padStart(6, '0');
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
function validAddrs(csv) { // addresses matching the legacy regex (after TrimStart/TrimEnd) are added as written
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
// new SmtpClient(CompanySettings.CompanyMailServer, 587) with NetworkCredential(CompanySupportEmailId, CompanyMailPassword)
function companySmtp(message) {
  return smtpSend({
    host: CompanySettings.CompanyMailServer, port: 587,
    user: CompanySettings.CompanySupportEmailId, pass: CompanySettings.CompanyMailPassword, message,
  });
}

// ---------------------------------------------------------------- image methods
// private static void GetImageName(...): newWidth/newHeight computed (radio = int/int => DivideByZeroException when newHeight == 0), then Img.Save(path)
async function GetImageName(StrValidFull_NameAndPath, bytes, scaleFactor) {
  const sh = sharp();
  if (sh) {
    const meta = await sh(bytes).metadata();
    const newHeight = Math.trunc(meta.height * scaleFactor);
    if (newHeight === 0) throw new Error('Attempted to divide by zero.');
  }
  writeFile(StrValidFull_NameAndPath, bytes);
}

// public static void ResizeImagekyc(...)  (> 100 KB: fit into 515x832, or 479x612 for "Kyc_Images", JPEG quality 70, 24bpp RGB)
async function ResizeImagekyc(FullName, scaleFactor, filesize, fromstream, Folder) {
  assertImage(fromstream); // Image.FromStream
  if (filesize > 100) {
    const sh = sharp();
    if (!sh) { writeFile(FullName, fromstream); return; } // PORT-NOTE: sharp not installed - bytes saved unchanged
    const meta = await sh(fromstream).metadata();
    const originalWidth = meta.width; const originalHeight = meta.height;
    let maxWidth = 515; let maxHeight = 832; const quality = 70;
    if (Folder !== '' && Folder === 'Kyc_Images') { maxWidth = 479; maxHeight = 612; }
    const ratioX = Math.fround(maxWidth / originalWidth);
    const ratioY = Math.fround(maxHeight / originalHeight);
    const ratio = Math.min(ratioX, ratioY);
    const newWidth = Math.trunc(originalWidth * ratio);
    const newHeight = Math.trunc(originalHeight * ratio);
    if (newWidth <= 0 || newHeight <= 0) throw new Error('Parameter is not valid.'); // new Bitmap(0, h)
    const out = await sh(fromstream).resize(newWidth, newHeight, { fit: 'fill' }).flatten({ background: '#000000' }).jpeg({ quality }).toBuffer();
    writeFile(FullName, out);
  } else {
    writeFile(FullName, fromstream); // image.Save(FullName)
  }
}

// public static void ResizeImage(...)  (> 100 KB: FullImage 652x832, SemiLarge 479x612, ThumbNail 235x300, default 515x832; JPEG quality 70, 24bpp RGB)
// private CalculateResizedDimensions / GetEncoderInfo: the second DrawImage uses the same (newWidth,newHeight) box => one resize.
async function ResizeImage(FullName, scaleFactor, filesize, fromstream, Folder) {
  assertImage(fromstream); // Image.FromStream
  if (filesize > 100) {
    const sh = sharp();
    if (!sh) { writeFile(FullName, fromstream); return; } // PORT-NOTE: sharp not installed - bytes saved unchanged
    const meta = await sh(fromstream).metadata();
    const originalWidth = meta.width; const originalHeight = meta.height;
    let maxWidth = 515; let maxHeight = 832; const quality = 70;
    if (Folder !== '' && Folder === 'FullImage') {
      maxWidth = 652; maxHeight = 832;
    } else if (Folder !== '' && Folder === 'SemiLarge') {
      maxWidth = 479; maxHeight = 612;
    } else if (Folder !== '' && Folder === 'ThumbNail') {
      maxWidth = 235; maxHeight = 300;
    }
    const ratioX = Math.fround(maxWidth / originalWidth);
    const ratioY = Math.fround(maxHeight / originalHeight);
    const ratio = Math.min(ratioX, ratioY);
    const newWidth = Math.trunc(originalWidth * ratio);
    const newHeight = Math.trunc(originalHeight * ratio);
    if (newWidth <= 0 || newHeight <= 0) throw new Error('Parameter is not valid.');
    const out = await sh(fromstream).resize(newWidth, newHeight, { fit: 'fill' }).flatten({ background: '#000000' }).jpeg({ quality }).toBuffer();
    writeFile(FullName, out);
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
      assertImage(bytes); // Image.FromStream(ms)
      if (IMode === ImageMode.Original || IMode === ImageMode.Both) {
        const StrValidFull_NameAndPath = Orginial_Folder_Path + '/' + RealImageName;
        rmIfExists(StrValidFull_NameAndPath);
        await ResizeImage(StrValidFull_NameAndPath, 0.25, filesize, bytes, 'FullImage');
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

async function ImageUploadMasterMethodECommNew(ImageBase64Code, OriginalImage, SemiLargeImage, ThumbNailImage, IMode, IdForAppend) {
  const Orginial_Folder_Path = mapPath(OriginalImage);
  const SemiLarge_Folder_Path = mapPath(SemiLargeImage);
  const Thumb_Folder_Path = mapPath(ThumbNailImage);
  let RealImageName = '';
  if (ImageBase64Code.trim() !== '' && ImageBase64Code.includes('base64,')) {
    let Base64String = '';
    if (ImageBase64Code !== '') {
      Base64String = ImageBase64Code;
      RealImageName = IdForAppend + newImageNumber() + '_' + netStamp() + '.jpg';
    } else {
      RealImageName = ' ';
    }
    if (Base64String.includes('base64,')) {
      const { bytes } = parseDataUri(Base64String);
      let filesize = bytes.length;
      filesize = filesize / 1024;
      assertImage(bytes); // Image.FromStream(ms)
      if (IMode === ImageMode.Original || IMode === ImageMode.Both) {
        const StrValidFull_NameAndPath = Orginial_Folder_Path + '/' + RealImageName;
        rmIfExists(StrValidFull_NameAndPath);
        await ResizeImage(StrValidFull_NameAndPath, 0.25, filesize, bytes, 'FullImage');
      }
      if (IMode === ImageMode.SemiLarge || IMode === ImageMode.Both) {
        const StrValidSemiLarge_NameAndPath = SemiLarge_Folder_Path + '/' + RealImageName;
        rmIfExists(StrValidSemiLarge_NameAndPath);
        await ResizeImage(StrValidSemiLarge_NameAndPath, 0.25, filesize, bytes, 'SemiLarge');
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

// Master Method For Upload Image (Merchant: no try/catch => exceptions propagate; Original also goes through ResizeImagekyc)
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

// Orginial_Folder_Path / Thumb_Folder_Path are physical folders (callers already mapped them)
async function UploadImageFromExtractProcess(ByteArray, Orginial_Folder_Path, Thumb_Folder_Path, IMode, RealImageName) {
  let filesize = ByteArray.length;
  filesize = filesize / 1024;
  let scaleFactor = 0;
  assertImage(ByteArray); // Image.FromStream(ms)
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

// ImageCodecInfo mime type without "image/" (System.Drawing names), "jpg" when unknown
function Getimageformate(img) {
  const f = sniffFormat(img);
  return f === null ? 'jpg' : f;
}

// PORT-NOTE: both outputs are JPEG-encoded (ImageCodecInfo.GetImageEncoders()[1]) but keep the source extension, like the C#.
async function CreateImage(base64String, fullpathpath, imagename) {
  base64String = base64String.replace(/ /g, '+');
  if (base64String.includes('base64,')) {
    const IndexNo = base64String.indexOf('/') + 1;
    const lastIndexNo = base64String.indexOf(';');
    csSubstring(base64String, IndexNo, lastIndexNo - IndexNo); // ImageExt
    const IndexNo1 = base64String.indexOf(',') + 1;
    const Pathlength1 = base64String.length;
    base64String = csSubstring(base64String, IndexNo1, Pathlength1 - IndexNo1);
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
  if (!sh) { // PORT-NOTE: sharp not installed - original bytes saved unchanged to both files
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
    if (radio < 1) abc1 = 600 * radio;
    else if (radio > 1) abc2 = 600 / radio;
    else { abc1 = 600; abc2 = 400; }
    iwidth = bankers(abc1); iheight = bankers(abc2);
    if (radio < 1) {
      if (iwidth > 600 || iheight > 600) { iwidth = bankers(iwidth * radio); iheight = bankers(iheight * radio); }
    }
    if (radio > 1) {
      if (iwidth > 600 || iheight > 600) { iwidth = bankers(iwidth / radio); iheight = bankers(iheight / radio); }
    }
  }
  writeFile(strValidFullName2, await sh(b).resize(iwidth, iheight, { fit: 'fill' }).flatten({ background: '#000000' }).jpeg({ quality: 100 }).toBuffer());
  // ======================small
  if (filesize > 20 || (Math.trunc(newWidth1) > iwidth || Math.trunc(newHeight1) > iheight)) {
    iwidth = 225;
    iheight = 225;
  }
  writeFile(strValidFullName1, await sh(b).resize(iwidth, iheight, { fit: 'fill' }).flatten({ background: '#000000' }).jpeg({ quality: 100 }).toBuffer());
  return extens;
}

function getRandomName() { // Path.GetRandomFileName(): 8 chars + '.' + 3 chars of [a-z0-9]
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let r = '';
  for (let i = 0; i < 11; i++) { r += chars[crypto.randomInt(0, chars.length)]; if (i === 7) r += '.'; }
  return r;
}

// NOTE: legacy call is CreateImage(items, filenames, FolderName) while CreateImage takes (base64String, fullpathpath, imagename):
// the generated name is used as the folder and FolderName as the file name. Reproduced as is.
async function saveImage(imgecode, titlename, FolderName) {
  titlename = titlename.replace(/[^0-9a-zA-Z]+/g, '');
  titlename = titlename.replace(/[\s+]/g, '');
  let returnfilename = '';
  if (titlename.length > 5) titlename = titlename.substring(0, 4);
  const getcolltionimage = imgecode.split('^');
  for (const items of getcolltionimage) {
    const filenames = titlename.trim() + getRandomName();
    if (items.trim() !== '' && items.includes('base64,')) {
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
}

// ---------------------------------------------------------------- misc
// C# overloads ExchangeRateFromAPI() (INR -> USD) and ExchangeRateFromAPI(decimal amount, string firstCcode, string lastCcode)
async function ExchangeRateFromAPI(amount, firstCcode, lastCcode) {
  try {
    if (arguments.length < 3) { firstCcode = 'INR'; lastCcode = 'USD'; }
    const url = 'http://finance.yahoo.com/d/quotes.csv?s=' + firstCcode + lastCcode + '=X&f=l1';
    const r = await axios.get(uriEscape(url), { responseType: 'text', transformResponse: [(d) => d], timeout: 100000 });
    const t = String(r.data).trim().replace(/,/g, '');
    const exchangeRate = Number(t);
    if (t === '' || Number.isNaN(exchangeRate)) throw new Error('Input string was not in a correct format.');
    return exchangeRate;
  } catch (ex) {
    return 0;
  }
}

// PORT-NOTE: the legacy instance method opened AppSettings["ConnectionString"] (commented out in the Merchant Web.config); Db_Shopping is used.
async function GetDataSet(strSql) {
  const rows = await query(DB, strSql, {});
  return { Table: rows };
}

// arrParam: [{ParameterName:'@x', Value, Direction?}]; output parameters are not sent. Same connection note as GetDataSet.
async function GetDataSetSPNamed(arrParam, strSPName, tblName) {
  const args = {};
  for (const p of arrParam) {
    if (p.Direction === 'Output' || p.Direction === 2) continue;
    args[String(p.ParameterName).replace(/^@/, '').trim()] = p.Value;
  }
  const rows = await proc(DB, String(strSPName).replace(/[\[\]]/g, ''), args);
  return { [tblName]: rows };
}

async function CreateAutoWithdrawal() {
  fire(async () => {
    await proc(DB, 'usp_member_auto_withdrawal', { regno: 0 });
  });
}

async function CreateAutoWithdrawal_ROI() {
  await proc(DB, 'usp_member_auto_withdrawal_for_growth', { regno: 0 });
}

function CreateCustomPagging_ServerSide(ControllerWithAction, QueryString, TotalRecord, PageSize, NumbersPerPage, CurrentPageIndex) {
  let href = '';
  ControllerWithAction = '/' + ControllerWithAction;
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
  const hasQs = QueryString !== '' && QueryString !== null && QueryString !== undefined;
  if (CurrentPageIndex === 1) prevClass = 'disabledli';
  if (hasQs) {
    if (!promo()) href = ControllerWithAction + '?page=' + PrePageNo + '&' + QueryString;
    else href = ControllerWithAction + '?page=' + Shared.Encryptword(String(PrePageNo)) + '&' + QueryString;
  } else if (!promo()) {
    href = ControllerWithAction + '?page=' + PrePageNo;
  } else {
    href = ControllerWithAction + '?page=' + Shared.Encryptword(String(PrePageNo));
  }
  let MyPagingDiv = '';
  MyPagingDiv += "<div class='pagination-container'>";
  MyPagingDiv += "<ul class='pagination'>";
  if (CurrentPageIndex > NumbersPerPage) {
    prevClass = 'enabledPrev';
    MyPagingDiv += "<li class='" + prevClass + "'><a  " + "href='" + href + "'" + '>«</a></li>';
  } else {
    prevClass = 'disabledPrev';
    MyPagingDiv += "<li class='" + prevClass + "'><a>«</a></li>";
  }
  let CurrentPageNo = StartPageNo;
  while (LoopCount >= 1) {
    ActiveIndex = CurrentPageIndex === CurrentPageNo ? 'pageActive' : '';
    if (hasQs) {
      if (!promo()) href = ControllerWithAction + '?page=' + CurrentPageNo + '&' + QueryString;
      else href = ControllerWithAction + '?page=' + Shared.Encryptword(String(CurrentPageNo)) + '&' + QueryString;
    } else if (!promo()) {
      href = ControllerWithAction + '?page=' + CurrentPageNo;
    } else {
      href = ControllerWithAction + '?page=' + Shared.Encryptword(String(CurrentPageNo));
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
  if (hasQs) href = ControllerWithAction + '?page=' + CurrentPageNo + '&' + QueryString;
  else href = ControllerWithAction + '?page=' + CurrentPageNo;
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

// PORT-NOTE: C# decimal.ToString() keeps trailing zeros of the decimal scale (12.50m => "Fifty"); JS numbers do not (12.5 => "Five").
function DecimalToWords(d) {
  const formatted = String(d);
  if (formatted.includes('.')) {
    const sides = formatted.split('.');
    return NumberToText(toInt32(sides[0]), false) + ' Point ' + NumberToText(toInt32(sides[1]), false);
  }
  return NumberToText(bankers(Number(d)), false);
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

function ValidateInt(Input) { // int.TryParse
  if (Input === null || Input === undefined) return false;
  const t = String(Input);
  if (!/^[ \t\r\n]*[+-]?\d+[ \t\r\n]*$/.test(t)) return false;
  const n = parseInt(t.trim(), 10);
  return n >= -2147483648 && n <= 2147483647;
}

function ValidateInt64(Input) { // Int64.TryParse
  if (Input === null || Input === undefined) return false;
  const t = String(Input);
  if (!/^[ \t\r\n]*[+-]?\d+[ \t\r\n]*$/.test(t)) return false;
  const n = BigInt(t.trim().replace(/^\+/, ''));
  return n >= -9223372036854775808n && n <= 9223372036854775807n;
}

// instance method: select dbo.fun_GetCurrentDate() as CurrentDate (Db_Shopping)
async function GetDatabaseDate() {
  const Row = await queryOne(DB, 'select fun_getcurrentdate() as currentdate');
  if (Row === null) throw NRE();
  return Row.currentdate;
}

// instance method: Usp_GetEwalletDetails @regNo, @CurrentBalance out
async function GetEwalletCurrentBalace(RegNo) {
  const row = await procOne(DB, 'usp_getewalletdetails', { regno: RegNo });
  return toDecimal(outValue(row, 'CurrentBalance'));
}

// instance method: Usp_CheckTransConditions @type, @strOut out   (returns "start" if transaction is start)
async function GetTransCondition(Type) {
  const row = await procOne(DB, 'usp_checktransconditions', { type: Type });
  return outValue(row, 'strOut');
}

// instance method: dbo.usp_Maintain_Manipulations @Emp_Code,@BrCode,@created_remark,@strResult out
async function Maintain_Manipulation(Emp_Code, BrCode, created_remark) {
  let retValue = '';
  try {
    const row = await procOne(DB, 'usp_maintain_manipulations', { emp_code: Emp_Code, brcode: BrCode, created_remark });
    retValue = outValue(row, 'strResult');
  } catch (e) {
    retValue = '';
  }
  return retValue;
}

// identical to the shared CallBackAddress (SendGrid relay; APIKEY from config instead of the hard-coded key)
async function CallBackAddress1(ToEmailId, Subject, EmailContent) {
  return Shared.CallBackAddress(ToEmailId, Subject, EmailContent);
}

// Merchant: plain SMTP with SMPT_* AppSettings; "s" on success, the SMTP error message on send failure, "" on any other error.
async function CallBackAddress(ToEmailID, Subject, EmailContent) {
  try {
    const from = mailAddress(config.app.SMPT_Username); // new MailAddress(SMPT_Username)
    const to = addrList(ToEmailID); // mail.To.Add(ToEmailID)
    const port = toInt32(config.app.SMPT_PORT, true); // Convert.ToInt32(SMPT_PORT)
    if (port <= 0 || port > 65535) throw new RangeError('Specified argument was out of the range of valid values.'); // new SmtpClient(host, port)
    const enableSsl = toBoolean(config.app.SMTP_EnableSSL); // Convert.ToBoolean(SMTP_EnableSSL)
    let strret = '';
    strret = await smtpSend({
      host: s_(config.app.SMPT_HOST), port,
      user: s_(config.app.SMPT_Username), pass: s_(config.app.SMPT_Password), enableSsl,
      message: { from, to, subject: Subject, html: EmailContent },
    });
    return strret;
  } catch (ExpObj) {
    return '';
  }
}

async function Send(from, to, cc, bcc, subject, body) {
  await CallBackAddress(to, subject, body);
  return 'success';
}

function removeSpacesAndSpecialChars(stringvalue) {
  let v = stringvalue.trim();
  v = v.toLowerCase();
  v = rep(v, 'c#', 'C-Sharp');
  v = rep(v, ' ', '-');
  v = rep(v, '&', 'and');
  v = rep(v, 'amp;', '');
  v = rep(v, '/', '-');
  v = rep(v, '\\', '-');
  v = rep(v, '\\', '-');
  v = rep(v, '.', '');
  v = rep(v, ',', '');
  v = rep(v, '|', '-');
  v = rep(v, '#', '-');
  v = rep(v, '*', 'star');
  v = rep(v, ':', '-');
  v = rep(v, '+', 'plus');
  v = rep(v, '---', '-');
  v = rep(v, '--', '-');
  return v.trim();
}

// instance method (Session["CURRENCYCODE"] was read into an unused local - dropped)
async function SendGrowthInMobile(Message) {
  const Lim = mapRows(await query(DB, `select M.mobile,M.LoginId,MP.currentIncome as totalIncome,
       case  when G.Updated_DailyGrowth_Rate>G.DailyGrowth_Rate then Updated_DailyGrowth_Rate else DailyGrowth_Rate
       end as  DailyReturn from member_Master M,tbl_GrowthMaster G,tbl_DailyGrowthAccount D,Member_Performance MP where
        G.RegNo=M.regNo and D.GMID=G.GMID and fun_getCurrentDate()::date=d.toDate::date
        and MP.regno=M.regNo and M.mobile<>'' and M.Active::int=1  and G.CurrentReturn<G.MaxReturn  and MP.currentIncome>0`), ['mobile', 'LoginId', 'totalIncome', 'DailyReturn']);
  for (const Item of Lim) {
    const MobileNoTemp = Item.mobile;
    const Loginid = Item.LoginId;
    const TodayGrowth = Number(Item.DailyReturn);
    // decimal.ToString("0") rounds half away from zero
    const Msg = 'Dear user, your account ID ' + Loginid + ' is credited by ' + (TodayGrowth < 0 ? '-' : '') + String(Math.round(Math.abs(TodayGrowth))) + 'points. ';
    await SendMsgOnMobile(MobileNoTemp, Msg);
  }
}

// instance method: Usp_UpdaetGrowth @RegNo,@strResult out
async function UpdateGrowthByGlobal() {
  const row = await procOne(DB, 'usp_updaetgrowth', { regno: '0' });
  const OutputResult = outValue(row, 'strResult');
  if (OutputResult === 'ok') {
    fire(async () => {
      await CreateAutoWithdrawal_ROI();
      await SendGrowthInMobile('ok');
    });
  }
}

// Merchant: the exception is re-thrown (throw ex)
async function TrackError(ErrorMsg) {
  try {
    await exec(DB, 'INSERT INTO tbl_errorlog (description,errortime,status) VALUES (@ErrorMsg, fun_getcurrentdate(), 1)', { ErrorMsg });
  } catch (ex) {
    throw ex;
  }
}

// Merchant: DBO.TBL_MERCHANTS_OTP (the shared port writes tbl_customers_otp)
async function TrackOTP(mobileNo, OTP, process) {
  try {
    await exec(DB, 'INSERT INTO tbl_merchants_otp (mobileno,otp,process) VALUES (@m, @o, @p)', { m: mobileNo, o: OTP, p: process });
  } catch (ex) { /* swallowed */ }
}

// DBO.USP_MERCHANTS_REGISTRATION_EMAIL @EMAILID,@MAILBODY,@PROCESS,@STROUTPUT OUT (output unused)
async function TrackRegistrationEmail(emailId, mailBody, process) {
  try {
    const row = await procOne(DB, 'usp_merchants_registration_email', { emailid: emailId, mailbody: mailBody, process });
    const OutputResult = outValue(row, 'STROUTPUT'); void OutputResult;
  } catch (ex) { /* swallowed */ }
}

// PORT-NOTE: column list (MOBILENO,OTP,PROCESS) kept verbatim from the C#; a failing insert is swallowed like the legacy code.
async function TrackMerchantsMessages(mobileNo, Message, process) {
  try {
    await exec(DB, 'INSERT INTO tbl_merchants_messages (mobileno,otp,process) VALUES (@m, @o, @p)', { m: mobileNo, o: Message, p: process });
  } catch (ex) { /* swallowed */ }
}

async function TrackMerchantsEmails(emailId, mailBody, process) {
  try {
    const row = await procOne(DB, 'usp_merchants_registration_email', { emailid: emailId, mailbody: mailBody, process });
    const OutputResult = outValue(row, 'STROUTPUT'); void OutputResult;
  } catch (ex) { /* swallowed */ }
}

// Merchant: user/password/hostname are NOT used for SMTP - it authenticates with CompanySupportEmailId/CompanyMailPassword on CompanyMailServer:587;
// no SMS/e-mail history is written. PORT-NOTE: SmtpClient.Timeout = int.MaxValue => nodemailer default timeouts.
async function SendEmailByApiSetting(user, password, hostname, FromEmailId, BCC_EmailId, CC_EmailId, ToEmailId, Subject, BodyMessage, fileUploader = null, SenderId = '', SenderName = '') {
  try {
    const username = user; const pass = password; const host = hostname; void username; void pass; void host;
    const msg = { subject: Subject, html: BodyMessage };
    if (fileUploader !== null && fileUploader !== undefined) {
      const fileName = path.win32.basename(fileUploader.originalname || fileUploader.filename || fileUploader.FileName || '');
      msg.attachments = [{ filename: fileName, content: fileUploader.buffer }];
    }
    msg.from = (SenderId === '' || SenderName === '') ? mailAddress(FromEmailId) : mailAddress(SenderId, SenderName);
    applyRecipients(msg, ToEmailId, CC_EmailId, BCC_EmailId);
    return await companySmtp(msg);
  } catch (ex) {
    return String(ex.message);
  }
}

// FromEmailId is blanked, so without SenderId/SenderName `new MailAddress("")` throws (not caught in the C#) - reproduced.
async function SendMsgOnEmail(FromEmailId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage, SenderId = '', SenderName = '') {
  FromEmailId = '';
  const msg = { subject: Subject, html: BodyMessage };
  msg.from = (SenderId === '' || SenderName === '') ? mailAddress(FromEmailId) : mailAddress(SenderId, SenderName);
  applyRecipients(msg, ToEmailId, CC_EmailId, BCC_EmailId);
  return companySmtp(msg);
}

// Merchant: type+did => TBL_COMPANYSETTINGS(PMID=1).SMSAPI with 1111111111/DummyText placeholders; otherwise the AppSettings SMS gateway URL.
async function SendMsgOnMobile(MobileNo, Message, type = '', did = 0) {
  let res = 0;
  let CompanySMSAPI = ''; let baseurl = '';
  try {
    if (type !== '' && Number(did) !== 0) {
      let API = '';
      CompanySMSAPI = await scalar(DB, "SELECT coalesce(smsapi,'') FROM tbl_companysettings WHERE pmid=1 LIMIT 1");
      if (CompanySMSAPI === null || CompanySMSAPI === undefined) throw NRE();
      API = rep(String(CompanySMSAPI), '1111111111', MobileNo);
      API = rep(API, 'DummyText', Message);
      await httpGet(API);
      res = 1;
    } else {
      // ConfigurationManager.AppSettings[...].ToString() throws when the key is missing
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

async function SendMsgToMobileWithSelfAccount(Api) {
  let success = 0;
  try {
    const Baseurl = Api;
    await httpGet(Baseurl);
    success = 1;
  } catch (e) {
    success = 0;
  }
  return success;
}

// Merchant: no FromEmailId/DID database lookup - CompanySettings (AppSettings) account, SMTP CompanyMailServer:587; MailAddress errors are not caught.
async function CheckAndSendMsgOnEmail(UserId, ToEmailId, CC_EmailId, BCC_EmailId, Subject, BodyMessage, SenderId = '', SenderName = '', FromEmailId = '') {
  FromEmailId = '' + CompanySettings.CompanyInfoEmailId + '';
  const msg = { subject: Subject, html: BodyMessage };
  msg.from = (SenderId === '' || SenderName === '') ? mailAddress(FromEmailId) : mailAddress(SenderId, SenderName);
  applyRecipients(msg, ToEmailId, CC_EmailId, BCC_EmailId);
  return companySmtp(msg);
}

// The SMS is sent on a background thread; "1" is returned immediately.
async function CheckAndSendMsgOnMobile(UserId, MobileNo, Message) {
  let result = '';
  result = '1'; // UpdateMessageCount(...) commented out in the C#
  if (result === '1' || result === '2') {
    try {
      fire(async () => {
        const Baseurl = '' + CompanySettings.Baseurl1 + '&' + CompanySettings.Baseurl2 + '&' + CompanySettings.Baseurl3 + '&'
          + CompanySettings.Baseurl4 + '' + '&mobile=' + MobileNo + '&message=' + Message + '';
        await httpGet(Baseurl);
      });
    } catch (ex) {
      result = String(ex.message);
    }
  }
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

// shared body of Auto_Mail / BusinessKYC_Auto_Mail (background thread)
function _kycReminderLoop(opts) {
  return async () => {
    let Ret = '';
    try {
      const SendMail = require('./SendMail');
      const ObjkycRecords = mapRows(await proc(DB, 'usp_auto_kyc', opts.procArgs), ['PLid', 'Fname']);
      for (let i = 0; i < ObjkycRecords.length; i++) {
        const Regno = ObjkycRecords[i].PLid;
        const row = await queryOne(DB, 'select * from kyc where regno=@Regno and kyctype=@kycType limit 1', { Regno, kycType: opts.kycType });
        if (row === null) {
          const row1 = await queryOne(DB, 'select * from portal_login where plid=@Regno limit 1', { Regno });
          if (row1 === null) throw NRE();
          const MemName = row1.fname;
          const msgForMobile = opts.mobileMsg(MemName);
          const username = row1.username;
          const Emailid = row1.emailid;
          const Mobile = row1.phone;
          let send = 0;
          try {
            const subject = opts.subject();
            let mailtxt = '';
            if (send === 0) {
              mailtxt = opts.fill(opts.template, username);
              const result = await SendMail.Send1('', Emailid, '', '', subject, mailtxt);
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
    void Ret;
  };
}

async function Auto_Mail() {
  fire(_kycReminderLoop({
    procArgs: { regno: 0 },
    kycType: 1,
    template: TPL_AUTOMAIL,
    mobileMsg: (MemName) => 'Dear ' + MemName + ',\r\nWe request you to submit your KYC documents as soon as possible Thank you.\r\n The ' + CompanySettings.CompanyName + ' Team',
    subject: () => '' + CompanySettings.CompanyName + ' Support Center',
    fill: (t, username) => {
      let m = rep(t, '$$lblName$$', username);
      m = rep(m, '$$CompanyURL$$', CompanySettings.CompanyURL);
      m = rep(m, '$$FacebookShare$$', CompanySettings.FacebookShare);
      m = rep(m, '$$TwitterShare$$', CompanySettings.TwitterShare);
      m = rep(m, '$$GoogleplusShare$$', CompanySettings.GoogleplusShare);
      m = rep(m, '$$LinkedinShare$$', CompanySettings.LinkedinShare);
      m = rep(m, '$$PinterestShare$$', CompanySettings.PinterestShare);
      return m;
    },
  }));
}

async function BusinessKYC_Auto_Mail() {
  fire(_kycReminderLoop({
    procArgs: { regno: 0, mode: 1 },
    kycType: 2,
    template: TPL_BIZMAIL,
    mobileMsg: (MemName) => 'Dear ' + MemName + ',\r\n We request you to submit your Business KYC documents as soon as possible Thank you.\r\n The ' + CompanySettings.CompanyName + 'Team',
    subject: () => 'jewriaSupport Center',
    fill: (t, username) => {
      let m = rep(t, '$$lblName$$', username);
      m = rep(m, '$$CompanyURL$$', CompanySettings.CompanyURL);
      m = rep(m, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
      m = rep(m, '$$SupportEmailId$$', CompanySettings.CompanySupportEmailId);
      m = rep(m, '$$FacebookShare$$', CompanySettings.FacebookShare);
      m = rep(m, '$$TwitterShare$$', CompanySettings.TwitterShare);
      m = rep(m, '$$GoogleplusShare$$', CompanySettings.GoogleplusShare);
      m = rep(m, '$$LinkedinShare$$', CompanySettings.LinkedinShare);
      m = rep(m, '$$PinterestShare$$', CompanySettings.PinterestShare);
      return m;
    },
  }));
}

// string.Format("{0:n1} {1}", adjustedSize, SizeSuffixes[mag])
function SizeSuffix(value) {
  value = Number(value);
  if (value < 0) return '-' + SizeSuffix(-value);
  if (value === 0) return '0.0 bytes';
  const mag = Math.trunc(Math.log(value) / Math.log(1024));
  const adjustedSize = value / Math.pow(2, mag * 10);
  const a = Math.round((adjustedSize + Number.EPSILON) * 10) / 10;
  return a.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ' + SizeSuffixes[mag];
}

async function GetColorcode(ColorName) {
  const colorCode = await scalar(DB, 'SELECT colorcode FROM tbl_hexacolrcode WHERE colorname=@ColorName AND status::int=1 LIMIT 1', { ColorName });
  if (colorCode !== '' && colorCode !== null && colorCode !== undefined) return colorCode;
  return colorCode === undefined ? null : colorCode;
}

// ---------------------------------------------------------------- classes
class EwalletDetails { constructor(init) { this.CurrentBalance = null; this.RegNo = null; Object.assign(this, init); } }
class UserTypes { constructor(init) { this.UserTypeMem = null; Object.assign(this, init); } }
class Kyc_Record { constructor(init) { this.PLid = null; this.Fname = null; Object.assign(this, init); } }

const UtilityClass = {
  ...Shared,
  // fields / enums / classes
  SpecialCharsForLoginID, MessageType, SelectBranchType, RoleUserType, ImageMode,
  EwalletDetails, UserTypes, Kyc_Record,
  // merchant overrides
  ImageUploadMasterMethodECommNew, ImageUploadMasterMethod, ResizeImage, GetDataSetSPNamed, GetDatabaseDate, CallBackAddress,
  SendEmailByApiSetting, SendMsgOnMobile, TrackOTP, CheckAndSendMsgOnEmail,
  // ported (missing in the shared lib)
  ExchangeRateFromAPI, ImageUploadMasterMethodEComm, GetDataSet, CreateAutoWithdrawal, CreateAutoWithdrawal_ROI, CreateCustomPagging_ServerSide,
  DecimalToWords, GenerateRandomNumber, GetCurrentDate, Getimageformate, GetRandom, getRandomName, NumberToText, NumberToWords, RandomString,
  RandomDigits, saveImage, CreateImage, ValidateInt, ValidateInt64, GetEwalletCurrentBalace, GetTransCondition, Maintain_Manipulation,
  CallBackAddress1, Send, removeSpacesAndSpecialChars, SendGrowthInMobile, UpdateGrowthByGlobal, TrackError, TrackRegistrationEmail,
  TrackMerchantsMessages, TrackMerchantsEmails, SendMsgOnEmail, SendMsgToMobileWithSelfAccount, CheckAndSendMsgOnMobile, ToOrdinal,
  BlastCampaign, Auto_Mail, BusinessKYC_Auto_Mail, UploadImageFromExtractProcess, ResizeImagekyc, SizeSuffix, GetColorcode,
};

module.exports = UtilityClass;
