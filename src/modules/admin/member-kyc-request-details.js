'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MemberKYCRequestDetails.cs (class MemberKYCRequestDetailsController => /MemberKYCRequestDetails/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const SendMail = require('../../lib/admin/SendMail');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const { DB, nInt, nStr, reqInt, cvtInt, outOf, firstCol, netFormat } = require('./_shared/batch10-common');

const router = express.Router();
const C = 'MemberKYCRequestDetails';

/** class KYCDetails (Controllers/V4Admin/UpdateMemberProfileController.cs) */
const KYC_PROPS = ['REGNO', 'PID', 'IDFRUNTBACKIMG', 'PCID', 'BID', 'PHOTOTITLE', 'RESDENTIALTITLE', 'TAXATIONTITLE', 'BANKTITLE', 'PHOTOIMAGE',
  'RESDINTALTYPE', 'IDFRUNTIMGNO', 'FRUNTIMG', 'BACKIMG', 'TAXATIONTTYPE', 'PCIDNO', 'DOB', 'PANCARDIMG', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO',
  'IFSCCODE', 'BANKNAME', 'BANKIMG', 'BRANCHNAME', 'PHOTOSTATUS', 'IDFRUNTIMGSTATUS', 'PANSTATUS', 'BANKSTATUS', 'ALLSTATUS', 'PHOTOREMARK',
  'IDFRUNTIMGREMARK', 'PANREMARK', 'BANKREMARK', 'PHOTOAPPROVEDATE', 'IDFRUNTIMGAPPROVEDDATE', 'PANAPPROVEDDATE', 'BANKAPPROVEDDATE', 'KYCMODE'];
/** class MemberKYCDetail */
const DETAIL_PROPS = ['USERNAME', 'COUNTRYNAME', 'STATENAME', 'CITYNAME', 'Name', 'MOBILE', 'ADDRESS', 'PINCODE', 'JoiningDate', 'Activationdate',
  'STATUS', 'Investamount', 'EMAILID'];

const NRE = () => new Error('Object reference not set to an instance of an object.');
/** new System.Threading.Thread(delegate { ... }).Start() => fire and forget */
const bg = (fn) => { setImmediate(() => { Promise.resolve().then(fn).catch((e) => console.error('[admin] MemberKYCRequestDetails thread:', e.message)); }); };

// public static string GetHtmlBodyForKyc()  (static => not an MVC action)
const KYC_BODY = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>\r\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>\r\n    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\r\n    <table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>\r\n        <tbody>\r\n\r\n      <tr>\r\n        <td><table style='width:100%;'>\r\n            <tbody>\r\n              <tr>\r\n                <td width='100%' align='center'><a href='https://cryptoinbox.com/' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://cryptoinbox.com/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\r\n              </tr>\r\n            </tbody>\r\n          </table></td>\r\n      </tr>\r\n        <tr>\r\n\r\n        <td>\r\n\r\n      <div>\r\n        <div class='clear'></div>\r\n        <table style='padding-bottom: 10px; width: 100%; '>\r\n          <tbody>\r\n            <tr>\r\n              <td>\r\n            <tr>\r\n              <td align='center'><strong style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> KYC Documents Approved\r\n                </p>\r\n                </strong>\r\n                <div style='text-align:left;'>\r\n                  <h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px\r\n\r\n15px; color: #3f3f42;'>Dear $$lblName$$, </h1>\r\n                  <div style='font-size: 15px; color: #333;'>\r\n                    <p style='font-size:14px; line-height:19px;  margin-top:20px; margin-bottom:0;'>We are happy to inform you that your KYC documents are approved and verified. You can now start using the benefits of our Referral Program.</p>\r\n                  </div>\r\n                </div>\r\n                <div style='clear: both'></div>\r\n                <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\r\n                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>\r\n                          <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> If you have any issues,\r\n            we will be happy to help you. You can contact us on <a href = 'mailto:support@cryptoinbox.com' target = '_blank' style = 'color:#00a0a8;'> support@cryptoinbox.com </a></p>\r\n\r\n                                     </div>\r\n\r\n                                     </td>\r\n\r\n                                 </tr>\r\n\r\n                               <div style = 'clear: both'></div>\r\n\r\n                                <div style = 'clear: both'></div>\r\n\r\n                                   </td>\r\n\r\n                                   </tr>\r\n\r\n                                 <tr>\r\n\r\n                                   <td><table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>\r\n\r\n                                          <tbody>\r\n\r\n                                            <tr>\r\n\r\n                                            <td>\r\n\r\n                                                <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>\r\n\r\n                                                   <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The Cryptoinbox Team</h5>\r\n\r\n                                                  </td>\r\n\r\n                                                    <td>\r\n\r\n                                                    <div style = 'margin-right: 7px; text-align:right'>\r\n\r\n                                                     <a href = 'https://www.facebook.com/' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://cryptoinbox.com/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\r\n\r\n                                                                <a href = 'https://twitter.com/' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://cryptoinbox.com/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\r\n\r\n                                                                           <a href = 'https://plus.google.com/' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://cryptoinbox.com/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\r\n\r\n                                                                                      <a href = 'https://www.linkedin.com/' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://cryptoinbox.com/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\r\n\r\n                                                                                                  <a href = 'https://pinterest.com/' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://cryptoinbox.com/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>\r\n\r\n                                                                                                             </div></td>\r\n\r\n                                                                                                          </tr>\r\n\r\n                                                                                                        </tbody>\r\n\r\n                                                                                                      </table></td>\r\n\r\n                                                                                                  </tr>\r\n\r\n                                                                                                    </tbody>\r\n\r\n                                                                                                </table>\r\n\r\n                                                                                                <div class='clear'></div>\r\n      </div>\r\n        </td>\r\n\r\n        </tr>\r\n\r\n        </tbody>\r\n\r\n    </table>\r\n  </div>\r\n  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | cryptoinbox.com</p>\r\n</div>";
function GetHtmlBodyForKyc() {
  let body = "";
  body = KYC_BODY;
  return body;
}

/** DateTime.Now.ToString("dddd MMMM dd yyyy hh:mm tt") (en-US) */
function longStamp(d) {
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${netFormat(d, 'dd yyyy hh:mm tt')}`;
}

// public static void NotifyToMemberAboutKYC(Int64 RegNo)  (static => not an MVC action)
async function NotifyToMemberAboutKYC(RegNo) {
  try {
    // db._Portal_Login.Where(a => a.PLID == RegNo).FirstOrDefault()
    const tt = await db.queryOne(DB, 'select username, phone, emailid from portal_login where plid = @RegNo limit 1', { RegNo });
    const datetime = longStamp(new Date());
    if (!tt) throw NRE();
    const MemName = tt.username;
    const Message = "Your KYC has been <span style='color:green'>Approved</span> by our Administrative Team.";
    // eslint-disable-next-line no-unused-vars
    const SmsMessage = 'Dear ' + MemName + ',\r\nYour KYC is approved and verified. Thank you. For further details, visit https: https://cryptoinbox.com/referral-login\r\n The Cryptoinbox Team';
    const Phone = tt.phone; // eslint-disable-line no-unused-vars
    const email = tt.emailid;
    const Username = tt.username;
    let body = GetHtmlBodyForKyc();
    body = body.split('$$lblName$$').join(Username === null ? '' : Username);
    body = body.split('$$message$$').join(Message);
    body = body.split('$$datetime$$').join(datetime);
    bg(async () => { await SendMail.Send('', email, '', '', 'Cryptoinbox Support Center', body); });
  } catch (e) { /* catch (Exception) { } */ }
}

// public void Bind_MemberDetail(int Regno) => ViewBag.detail
async function Bind_MemberDetail(Regno, ViewBag) {
  const rows = await db.proc(DB, 'USP_MEMBERKYCDETAILS', { REGNO: Regno }); // catch { throw; }
  const row = rows[0];
  ViewBag.detail = row ? mapRow(row, DETAIL_PROPS) : null;
}

// public void CountBulkMember(int Regfno) => ViewBag.countmember
async function CountBulkMember(req, Regfno, ViewBag) {
  let countbulkmembver = 0;
  try {
    const rows = await db.proc(DB, 'usp_InsertMemberKYCImages', { Regno: Regfno, ImageName: '', Mode: 20 });
    const v = firstCol(rows);
    countbulkmembver = v === null || v === undefined ? 0 : Number(v);
    ViewBag.countmember = countbulkmembver;
  } catch (ex) {
    await errorInsert(req, ex, 'usp_InsertMemberKYCImages');
    ViewBag.filepath = ex.message;
  }
}

// public void CheckBulkIDActive() => ViewBag.CheckActive
async function CheckBulkIDActive(req, ViewBag) {
  let CheckBulkActive = 0;
  try {
    const rows = await db.proc(DB, 'usp_InsertMemberKYCImages', { Regno: '0', ImageName: '', Mode: 21 });
    const v = firstCol(rows);
    CheckBulkActive = v === null || v === undefined ? 0 : Number(v);
    ViewBag.CheckActive = CheckBulkActive;
  } catch (ex) {
    await errorInsert(req, ex, 'usp_InsertMemberKYCImages');
    ViewBag.filepath = ex.message;
  }
}

// ---------------------------------------------------------------- Index(int? Regno)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Member-KYC-Request-Details" -> MemberKYCRequestDetails/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Member-KYC-Request-Details'], adminAuth, asyncHandler(async (req, res) => {
  const Regno = nInt(req.p.Regno);
  const regno = Regno === null ? 0 : Regno; // Convert.ToInt32(int?)
  const ViewBag = {};
  await CheckBulkIDActive(req, ViewBag);
  await Bind_MemberDetail(regno, ViewBag);
  await CountBulkMember(req, regno, ViewBag);
  // dbo.USP_KYCDETAILSForRequest @REGBO
  const lstkycdata = mapRows(await db.proc(DB, 'USP_KYCDETAILSForRequest', { REGBO: Regno }), KYC_PROPS);
  res.json({ view: '~/Views/AdminPanel/MemberKYCRequestDetails/Index.cshtml', Model: lstkycdata, ...ViewBag });
}));

// ---------------------------------------------------------------- public void fun_accept_reject_kyc(string Regno, string kTID, string statuskyc, string Remarks)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/fun_accept_reject_kyc{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Regno = nStr(req.p.Regno);
  const kTID = nStr(req.p.kTID);
  const status = cvtInt(nStr(req.p.statuskyc));
  const regno = cvtInt(Regno); // Convert.ToInt64
  let Remarks = nStr(req.p.Remarks); if (Remarks === null) Remarks = '';
  const empId = req.user.emp_id;
  // MM = Db._Member_Master.Where(a => a.regNo == regno).FirstOrDefault()
  const MMrow = await db.queryOne(DB, 'select username, emailid, mobile from member_master where regno = @regno limit 1', { regno });
  const MM = MMrow ? { userName: MMrow.username, Emailid: MMrow.emailid, mobile: MMrow.mobile } : null;
  // DBO.USP_APPROVEANDREJECTKYC @REGNO,@REMARK,@EMPID,@KTID,@Status,@RESULT OUT
  const rows = await db.proc(DB, 'USP_APPROVEANDREJECTKYC', { REGNO: Regno, REMARK: Remarks, EMPID: empId, KTID: kTID, Status: status });
  const ReturnMessage = outOf(rows, 'result').toLowerCase();
  if (ReturnMessage === 'success') {
    const smsAction = (id) => db.queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id = @id limit 1', { id });
    const emailAction = (eid) => db.queryOne(DB, 'select email_content, email_send_status, email_subject from tbl_emailaction where eid = @eid limit 1', { eid });
    const SMSContenForKycReject = await smsAction(44);
    if (!SMSContenForKycReject || !MM) throw NRE();
    const Rejectemessg = await UtilityClass.FindingSmsContentWithUserIdPassword(MM.userName, SMSContenForKycReject.sms_content, Remarks, '', 31);
    if (status === 1) {
      const EmailContenForKycApprove = await emailAction(37);
      const SMSContenForKycApprove = await smsAction(43);
      if (!SMSContenForKycApprove) throw NRE();
      const Approvemessg = await UtilityClass.FindingSmsContentWithUserIdPassword(MM.userName, SMSContenForKycApprove.sms_content, Remarks, '', 30);
      if (!EmailContenForKycApprove) throw NRE();
      const EmailSubject = EmailContenForKycApprove.email_subject;
      const DynamicMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(MM.userName, EmailContenForKycApprove.email_content, Remarks, '', 29, '');
      if (Number(EmailContenForKycApprove.email_send_status) === 1) {
        bg(async () => {
          const fileUploader = null;
          if (MM.Emailid === null || MM.Emailid === undefined) throw NRE();
          await UtilityClass.SendEmailByApiSetting('', '', '', '', '', '', String(MM.Emailid).toLowerCase(), EmailSubject, DynamicMsg, fileUploader);
        });
      }
      if (Number(SMSContenForKycApprove.sms_send_status) === 1) {
        bg(async () => { await UtilityClass.SendSMSWithAPI(MM.mobile, Approvemessg, '1'); });
      }
    } else if (status === 2) {
      const EmailContenForKycApprove = await emailAction(38);
      if (!EmailContenForKycApprove) throw NRE();
      const EmailSubject = EmailContenForKycApprove.email_subject;
      const DynamicMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(MM.userName, EmailContenForKycApprove.email_content, Remarks, '', 30, '');
      if (Number(EmailContenForKycApprove.email_send_status) === 1) {
        bg(async () => {
          const fileUploader = null;
          if (MM.Emailid === null || MM.Emailid === undefined) throw NRE();
          await UtilityClass.SendEmailByApiSetting('', '', '', '', '', '', String(MM.Emailid).toLowerCase(), EmailSubject, DynamicMsg, fileUploader);
        });
      }
      if (Number(SMSContenForKycReject.sms_send_status) === 1) {
        bg(async () => { await UtilityClass.SendSMSWithAPI(MM.mobile, Rejectemessg, '1'); });
      }
    }
  }
  // PORT-NOTE: ReturnMessage was lower-cased above, so this upper-case comparison is never true in legacy either (kept).
  if (ReturnMessage === 'SUCCESSFULLY VERIFIED AND APPROVE') {
    await NotifyToMemberAboutKYC(regno);
  }
  res.send(''); // void action
}));

// ---------------------------------------------------------------- public void Bind_MemberDetail(int Regno)
// auth (PORT-NOTE: legacy had no session check; returns nothing but reads member data => adminAuth)
router.all(`/admin/${C}/Bind_MemberDetail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await Bind_MemberDetail(reqInt(req.p.Regno, 'Regno'), {});
  res.send('');
}));

// ---------------------------------------------------------------- public void CountBulkMember(int Regfno)
// auth (PORT-NOTE: legacy had no session check => adminAuth)
router.all(`/admin/${C}/CountBulkMember{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await CountBulkMember(req, reqInt(req.p.Regfno, 'Regfno'), {});
  res.send('');
}));

// ---------------------------------------------------------------- public void CheckBulkIDActive()
// auth (PORT-NOTE: legacy had no session check => adminAuth)
router.all(`/admin/${C}/CheckBulkIDActive{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await CheckBulkIDActive(req, {});
  res.send('');
}));

module.exports = router;
