// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/PromoteReferral .cs (PromoteReferralController => /portal/PromoteReferral/...)
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const SendMail = require('../../lib/portal/SendMail');
const common = require('../../lib/portal/common');
const CS = require('../../lib/portal/CompanySettings');
const ps = require('./_shared/portal-session');
const { DB, NRE, s, outCol, bindInt, rep, trimEndChar, trimStartChar, view, background } = require('./_shared/batch-24-common');

const CompanySettings = CS.CompanySettings || CS;
const router = express.Router();
const P = '/portal/PromoteReferral';
/** class Landing */
const LANDING = ['RowNumber', 'TLPMID', 'PageName', 'PreviewURL', 'PageURL', 'IsDefault'];
const str = (v) => (v === undefined || v === '' ? null : v); // MVC string binding
/** DateTime.Now.ToString("dd-MM-yyyy") */
const ddMMyyyy = (d = new Date()) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: referral/promotereferral -> PromoteReferral/Index
router.all([`${P}/Index{/:id}`, P, '/portal/referral/promotereferral{/:id}'], ps.customerAuth, asyncHandler(async (req, res) => {
  const bag = {};
  bag.username = ps.sessionGet(req, ''); // @ViewBag.username = Session[""]
  const Plid = Number(req.user.plid);
  // PORT-NOTE: legacy command text was just "[Usp_ManageReferal]" (the @PLID SqlParameter was sent but never referenced), so the
  // procedure always ran with its default @PLID = 1. Reproduced: called without arguments.
  const ObjLanding = mapRows(await db.proc(DB, 'usp_managereferal', {}), LANDING);
  // Db._Portal_Login.Where(a => a.PLID == Plid).FirstOrDefault()
  const row = await db.queryOne(DB, 'SELECT username, defaultlandingurl FROM portal_login WHERE plid = @Plid LIMIT 1', { Plid });
  if (row == null) throw NRE(); // row.USERNAME
  const UserName = row.username;
  bag.ReferralID = row.username;
  let RLID = 0;
  const dl = row.defaultlandingurl === null || row.defaultlandingurl === undefined ? 0 : Number(row.defaultlandingurl);
  if (dl === 0) {
    RLID = 0;
  } else {
    RLID = dl;
  }
  // Db._Referral_Links ([Table("DBO.Referral_Link")]).Where(a => a.RLID == RLID).FirstOrDefault()
  const row1 = await db.queryOne(DB, 'SELECT url FROM referral_link WHERE rlid = @RLID LIMIT 1', { RLID });
  if (row1 != null) {
    if (row1.url === null || row1.url === undefined) throw NRE(); // row1.Url.ToString()
    bag.DefaultUrl = trimEndChar(String(row1.url), '/') + '/' + s(UserName);
  }
  return view(res, '~/Views/CustomerPanel/PromoteReferral/Index.cshtml', ObjLanding, bag);
}));

// ---------------------------------------------------------------- MakeDefualtUrl(int RLID) : JsonResult
// auth (Session["Plid"] == null => Json("expired"))
router.all(`${P}/MakeDefualtUrl{/:id}`, ...ps.customerOr('expired'), asyncHandler(async (req, res) => {
  const RLID = bindInt(req.p.RLID, 'RLID');
  const PLID = Number(req.user.plid);
  let ret = '';
  // row = Db._Portal_Login.Where(a => a.PLID == PLID).FirstOrDefault(); row.DefaultLandingUrl = RLID; Db.SaveChanges();
  const n = await db.exec(DB, 'UPDATE portal_login SET defaultlandingurl = @RLID WHERE plid = @PLID', { RLID, PLID });
  if (n > 0) {
    ret = 'Successfully set your default promotioal url.';
  } else {
    ret = 'Some Error Occured !';
  }
  res.json(ret);
}));

// ---------------------------------------------------------------- BtnSubmitSide(string Side) : JsonResult
// auth (Session["Plid"] == null => Json("expired"))
router.all(`${P}/BtnSubmitSide{/:id}`, ...ps.customerOr('expired'), asyncHandler(async (req, res) => {
  const Side = str(req.p.Side);
  const PLID = Number(req.user.plid);
  const dal = new common();
  const ret = await dal.UpdateReferrelSide(PLID, Side);
  res.json(ret);
}));

// ---------------------------------------------------------------- AccceptReferralProgram(string Sponsor) : JsonResult
// auth (Session["Plid"] == null => Json("Session has been expired, Please try again !"))
router.all(`${P}/AccceptReferralProgram{/:id}`, ...ps.customerOr('Session has been expired, Please try again !'), asyncHandler(async (req, res) => {
  const Sponsor = ''; // legacy overwrote the parameter with ""
  const PLID = Number(req.user.plid);
  const out = await db.procOne(DB, 'usp_newacceptreferralprogram', { SPONSER: Sponsor, PLID });
  const Result = s(outCol(out, 'result'));
  // PORT-NOTE: ExecuteSqlCommand returned the number of rows the procedure changed; PostgreSQL functions do not report it.
  // The procedure only changes rows past its early-return checks (@RESULT stays 'success'), so ReturnOutput = 1 when @RESULT = 'success'.
  const ReturnOutput = Result.toLowerCase() === 'success' ? 1 : 0;
  let Memname = '';
  const row = await db.queryOne(DB, 'SELECT username FROM portal_login WHERE plid = @PLID LIMIT 1', { PLID });
  if (row != null) Memname = row.username;
  if (ReturnOutput > 0) {
    try {
      // ConfirmationThread (errors never reached the response)
      background(async () => {
        const Obj = await db.queryOne(DB, `SELECT coalesce(phone, '') AS phone, emailid, username, password FROM portal_login
          WHERE plid::text = @PLID LIMIT 1`, { PLID: String(PLID) });
        const Message = 'Dear ' + s(Memname) + ',\r\n Welcome to ' + s(CompanySettings.CompanyName)
          + '’s Referral Program. Submission of KYC documents is must. Please submit the same. Thank you.';
        if (!Obj) throw NRE();
        if (Obj.phone != null && Obj.phone !== '') {
          await UtilityClass.SendMsgOnMobile(Obj.phone, Message);
        }
        if (Obj.emailid != null && Obj.username != null) {
          await SendConfirmationEmail(Obj.emailid, Obj.username, 'Thank you accepting the referral program.');
        }
      });
    } catch (Ex) {
      // ViewBag.Message = Ex.Message (not part of the Json result)
    }
  }
  res.json(Result.toLowerCase());
}));

/** protected void SendConfirmationEmail(string ToEmail, string Username, string Text) - not an action */
async function SendConfirmationEmail(ToEmail, Username, Text) {
  let send = 0;
  try {
    const subject = '' + s(CompanySettings.CompanyName) + ' Support Center';
    let mailtxt = '';
    const Date_ = ddMMyyyy();
    if (send === 0) {
      mailtxt = KYC_MAIL_BODY;
      mailtxt = rep(mailtxt, '$$lblname$$', Username);
      mailtxt = rep(mailtxt, '$$datetime$$', Date_);
      mailtxt = rep(mailtxt, '$$lblmessage$$', Text);
      mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
      mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
      mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
      mailtxt = rep(mailtxt, '$$CompanySupportEmailId$$', CompanySettings.CompanySupportEmailId);
      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
      if (result === 's') {
        send = 1;
      } else {
        return;
      }
    }
  } catch (exp) {
    // ViewBag.Message = exp.Message
  }
}

// ---------------------------------------------------------------- UpdateReferrel(string ReferrelName) : JsonResult
// auth (Session["Plid"] == null => Json("expired"))
router.all(`${P}/UpdateReferrel{/:id}`, ...ps.customerOr('expired'), asyncHandler(async (req, res) => {
  const ReferrelName = str(req.p.ReferrelName);
  const PLID = Number(req.user.plid);
  const dal = new common();
  const ret = await dal.UpdateReferrel(PLID, ReferrelName);
  res.json(ret);
}));

// ---------------------------------------------------------------- IsDefault(string ReferrelName) : JsonResult
// auth (Session["Plid"] == null => Json("expired"))
router.all(`${P}/IsDefault{/:id}`, ...ps.customerOr('expired'), asyncHandler(async (req, res) => {
  const ReferrelName = str(req.p.ReferrelName);
  const PLID = Number(req.user.plid);
  const dal = new common();
  const ret = await dal.IsDefault(PLID, ReferrelName);
  res.json(ret);
}));

// ---------------------------------------------------------------- btnsendmail(string email1, string referallink, string SenderName) : JsonResult
// auth (Session["Plid"] == null => Json("expired"))
router.all(`${P}/btnsendmail{/:id}`, ...ps.customerOr('expired'), asyncHandler(async (req, res) => {
  const email1 = str(req.p.email1); const referallink = str(req.p.referallink); const SenderName = str(req.p.SenderName);
  const plid = Number(req.user.plid);
  let ret = '0';
  try {
    ret = '1';
    background(() => sendmail(plid, email1, referallink, SenderName));
  } catch (ex) {
    ret = ex.message;
  }
  res.json(ret);
}));

/** protected void sendmail(Int64 plid, string email1, string referallink, string SenderName) - not an action */
async function sendmail(plid, email1, referallink, SenderName) {
  let send = 0;
  try {
    const subject = '' + s(CompanySettings.CompanyName) + ' Support Center';
    let mailtxt = '';
    const Date_ = ddMMyyyy();
    const email = email1;
    if (send === 0) {
      mailtxt = REFERRAL_MAIL_BODY;
      mailtxt = rep(mailtxt, '$$datetime$$', Date_);
      mailtxt = rep(mailtxt, '$$ReferralLInk$$', referallink);
      mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
      mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
      mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
      mailtxt = rep(mailtxt, '$$CompanySupportEmailId$$', CompanySettings.CompanySupportEmailId);
      const result = await SendMail.Send(0, '', email, '', '', subject, mailtxt, SenderName);
      if (result === 's') {
        send = 1;
      } else {
        return;
      }
    }
  } catch (exp) {
    // ViewBag.Message = exp.Message
  }
}

// ---------------------------------------------------------------- BtnSendSmsForReferAndEarn(string MobileNo, string Reflinks) : JsonResult
// auth (Session["Plid"] == null => Json("expired"))
router.all(`${P}/BtnSendSmsForReferAndEarn{/:id}`, ...ps.customerOr('expired'), asyncHandler(async (req, res) => {
  let MobileNo = str(req.p.MobileNo); const Reflinks = str(req.p.Reflinks);
  const plid = Number(req.user.plid); // eslint-disable-line no-unused-vars
  let ret = '0';
  try {
    if (MobileNo === null) throw NRE(); // MobileNo.TrimEnd(',')
    MobileNo = trimEndChar(MobileNo, ',');
    MobileNo = trimStartChar(MobileNo, ',');
    ret = '1';
    const mobile = MobileNo;
    background(() => UtilityClass.SendMsgOnMobile(mobile, 'Hurry Up !!\r\nWe help you to earn money by refer link to your friends \r\n' + s(Reflinks)
      + '\r\nFor more details visit \r\n' + s(CompanySettings.CompanyDomain) + '/.\r\n' + s(CompanySettings.CompanyName) + ' Support Team'));
  } catch (ex) {
    ret = ex.message;
  }
  res.json(ret);
}));

// #region mail bodies (verbatim from the C# source)
const KYC_MAIL_BODY = `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; padding-bottom:10px;'>
<div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>
<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>
<tbody>
<tr>
<td><table style='width:100%;'>
<tbody>
<tr>
<td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/anav-exchange-logo.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>
</tr>
</tbody>
</table></td>
</tr>
<tr>
<td>
<div class='clear'></div>
<table style='padding-bottom: 10px; width: 100%; '>
<tbody>
<tr>
<td>
<tr>
<td align='center'><strong style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> KYC Documents Verification Process
</p>
</strong>
<div style='text-align:left;'>
<h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Dear $$lblname$$, </h1>
<div style='font-size: 15px; color: #333;'>
</div>
<p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> Thanks for Submitting your KYC documents. Your Referral Program will be working only after your KYC documents are approved by our Verification Team. </p>
<p  style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'>We will process the documents and update the status within next 48hrs. Please be patience.</p>
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
<td><table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>
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
const REFERRAL_MAIL_BODY = `<div>
<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 100%'>
<tbody><tr><td>
<table width='100%'><tbody><tr>
    <td style='width: 70%'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>
<img src='https://$$CompanyURL$$/images/anav-exchange-logo.png' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>
<td style='text-align: right;   padding-right: 10px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 30%'>$$datetime$$</td>
</tr></tbody></table></td>
</tr><tr><td>
<div>
<div class='clear'></div>

<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; margin:10px; padding-top: 6px;'><tbody><tr><td>
<h4 style=' font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px

15px; color: #000'>Hey, have you heard of this site? I became a Member for Free and thought you might want to check it out too!
 </h4>
<p>
No matter what your product is, you are ultimately in the Products business. customers need to be
constantly Purchasing about the many advantages of doing business with you, trained to use your products more effectively,
and taught how to make never-ending improvement in their lives.</p>
<p>
A market is never saturated with a good product, but it is very quickly saturated with a bad one. All of the Products are for brand new, name brand products, all selling for less than of the retail price! You won't believe these prices! check it out at
<a href='$$ReferralLInk$$' target='_blank' style='text-decoration:none; color:#c95831;'>$$CompanyURL$$ </a>
or copy this url: <a id='LinkForShare' href='$$ReferralLInk$$' target='_blank' style='text-decoration:none; color:#c95831;'>$$ReferralLInk$$</a></p>
<div style='clear: both'></div>
<p style='font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px;'>
It's free to join, it's really cool and really addictive. Thanks.
</p>
<strong style=' font-weight: normal; margin: 0px;'></strong>


<div style='clear: both'></div>

<div style='clear: both'></div>
</td>
</tr><tr><td>
<table width='100%'><tbody><tr><td>

<p style='line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>
Sincerely,
<br>
$$CompanyName$$ Team
</p>
</td>
<td style='width: 240px; text-align: right'>
<div style=''>


    <div style='margin-right: 7px; text-align:right'>  
                    <a href='https://www.facebook.com/ATCShoppingServices/' style='color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target='_blank'> <img src='https://$$CompanyURL$$/images/mailer-facebook.png' style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a> 
                    <a href='https://twitter.com/ATCShoppingServices' style='color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='_blank'> <img src='https://$$CompanyURL$$/images/mailer-twitter.png' style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a> 
                    <a href='https://plus.google.com/+ATCShoppingIn' style='color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='_blank'> <img src='https://$$CompanyURL$$/images/mailer-gplus.png' style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a> 
                    <a href='https://www.linkedin.com/company/ATCShopping' style='color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='_blank'> <img src='https://$$CompanyURL$$/images/mailer-linkeden.jpg' style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>
                     <a href='https://pinterest.com/ATCShoppingServices/' style='color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='_blank'> <img src='https://$$CompanyURL$$/images/mailer-pintrest.png' style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a> 
                     
                     </div>

</div>
</td>
</tr></tbody></table></td>
</tr></tbody></table>
    
    <div class='clear'></div>
</div>
</td>
</tr></tbody></table>
    </div>`;

module.exports = router;
