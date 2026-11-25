'use strict';
// Ported from Franchise\Controllers\CustomerPanel\PromoteReferral .cs  (database: shopping — Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const common = require('../../lib/merchant/common');
const SendMail = require('../../lib/merchant/SendMail');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const CS = require('../../lib/merchant/CompanySettings');
const CompanySettings = CS.CompanySettings || CS;

const router = express.Router();
const P = '/merchant/PromoteReferral';

const rep = (s, k, v) => s.split(k).join(v == null ? '' : String(v)); // C# string.Replace
const ddmmyyyy = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`; };
const LANDING = ['RowNumber', 'TLPMID', 'PageName', 'PreviewURL', 'PageURL', 'IsDefault'];

// auth
router.all(P + '/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = req.user.plid;
  const ObjLanding = mapRows(await db.proc('shopping', 'usp_managereferal', { PLID: parseInt(req.user.plid, 10) }), LANDING);
  const row = await db.queryOne('shopping', 'select username, defaultlandingurl from portal_login where plid=@plid limit 1', { plid: Plid });
  const UserName = row.username;
  const out = { ReferralID: row.username, username: null };
  let RLID = 0;
  if (row.defaultlandingurl == 0) RLID = 0; else RLID = row.defaultlandingurl;
  const row1 = await db.queryOne('shopping', 'select url from referral_link where rlid=@rlid limit 1', { rlid: RLID });
  if (row1) out.DefaultUrl = String(row1.url).replace(/\/+$/, '') + '/' + UserName;
  res.json({ view: '~/Views/CustomerPanel/PromoteReferral/Index.cshtml', Model: ObjLanding, ViewBag: out, ...out });
}));

// auth
router.all(P + '/MakeDefualtUrl{/:id}', auth, asyncHandler(async (req, res) => {
  const PLID = parseInt(req.user.plid, 10);
  const RLID = parseInt(req.p.RLID, 10);
  let ret = '';
  const row = await db.queryOne('shopping', 'select plid from portal_login where plid=@plid limit 1', { plid: PLID });
  if (row) {
    await db.exec('shopping', 'update portal_login set defaultlandingurl=@rlid where plid=@plid', { rlid: RLID, plid: PLID });
    ret = 'Successfully set your default promotioal url.';
  } else {
    ret = 'Some Error Occured !';
  }
  res.json(ret);
}));

// auth
router.all(P + '/BtnSubmitSide{/:id}', auth, asyncHandler(async (req, res) => {
  const PLID = parseInt(req.user.plid, 10);
  const ret = await new common().UpdateReferrelSide(PLID, req.p.Side);
  res.json(ret);
}));

async function SendConfirmationEmail(ToEmail, Username, Text) {
  try {
    const subject = '' + CompanySettings.CompanyName + ' Support Center';
    const Date_ = ddmmyyyy();
    let mailtxt = `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; padding-bottom:10px;'>
<div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>
<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>
<tbody>
<tr>
<td><table style='width:100%;'>
<tbody>
<tr>
<td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>
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
we will be happy to help you. You can contact us on <a href = 'mailto:$$SupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$SupportEmailId$$ </a></p>
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
<a href = '$$FacebookShare$$' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = '$$TwitterShare$$' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = '$$GoogleplusShare$$' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = '$$LinkedinShare$$' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = '$$PinterestShare$$' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>
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
    mailtxt = rep(mailtxt, '$$lblname$$', Username);
    mailtxt = rep(mailtxt, '$$datetime$$', Date_);
    mailtxt = rep(mailtxt, '$$lblmessage$$', Text);
    mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
    mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
    mailtxt = rep(mailtxt, '$$SupportEmailId$$', CompanySettings.CompanySupportEmailId);
    mailtxt = rep(mailtxt, '$$FacebookShare$$', CompanySettings.FacebookShare);
    mailtxt = rep(mailtxt, '$$GoogleplusShare$$', CompanySettings.GoogleplusShare);
    mailtxt = rep(mailtxt, '$$TwitterShare$$', CompanySettings.TwitterShare);
    mailtxt = rep(mailtxt, '$$LinkedinShare$$', CompanySettings.LinkedinShare);
    mailtxt = rep(mailtxt, '$$PinterestShare$$', CompanySettings.PinterestShare);
    await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
  } catch (exp) { /* ViewBag.Message = exp.Message */ }
}

// auth
router.all(P + '/AccceptReferralProgram{/:id}', auth, asyncHandler(async (req, res) => {
  let Sponsor = req.p.Sponsor;
  Sponsor = '';
  const PLID = parseInt(req.user.plid, 10);
  const o = await db.procOne('shopping', 'usp_newacceptreferralprogram', { Sponser: Sponsor, PLID });
  const Result = o && o.result != null ? String(o.result) : '';
  // PORT-NOTE: ExecuteSqlCommand's rows-affected value is not available from a PostgreSQL function;
  // the notification block runs when the procedure reports 'success'.
  const ReturnOutput = Result === 'success' ? 1 : 0;
  let Memname = '';
  const row = await db.queryOne('shopping', 'select username from portal_login where plid=@plid limit 1', { plid: PLID });
  if (row) Memname = row.username;
  if (ReturnOutput > 0) {
    try {
      setImmediate(async () => {
        try {
          const Obj = await db.queryOne('shopping', "Select coalesce(Phone,'') As Phone,EmailID,UserName,Password From Portal_Login where plid = @plid limit 1", { plid: String(PLID) });
          const Message = 'Dear ' + Memname + ',\r\n Welcome To ' + CompanySettings.CompanyName + '’s Referral Program. Submission of KYC documents is must. Please submit the same. Thank you.';
          if (Obj.phone != null && Obj.phone !== '') await UtilityClass.SendMsgOnMobile(Obj.phone, Message);
          if (Obj.emailid != null && Obj.username != null) await SendConfirmationEmail(Obj.emailid, Obj.username, 'Thank you accepting the referral program.');
        } catch (e) { console.error(e.message); }
      });
    } catch (Ex) { /* ViewBag.Message */ }
  }
  res.json(Result.toLowerCase());
}));

// auth
router.all(P + '/UpdateReferrel{/:id}', auth, asyncHandler(async (req, res) => {
  const ret = await new common().UpdateReferrel(parseInt(req.user.plid, 10), req.p.ReferrelName);
  res.json(ret);
}));

// auth
router.all(P + '/IsDefault{/:id}', auth, asyncHandler(async (req, res) => {
  const ret = await new common().IsDefault(parseInt(req.user.plid, 10), req.p.ReferrelName);
  res.json(ret);
}));

async function sendmail(plid, email1, referallink, SenderName) {
  try {
    const subject = '' + CompanySettings.CompanyName + ' Support Center';
    const Date_ = ddmmyyyy();
    let mailtxt = `<div>
<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 100%'>
<tbody><tr><td>
<table width='100%'><tbody><tr>
    <td style='width: 70%'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>
<img src='https://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>
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
                    <a href='$$FacebookShare$$' style='color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target='_blank'> <img src='https://$$CompanyURL$$/images/mailer-facebook.png' style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>
                    <a href='$$TwitterShare$$' style='color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='_blank'> <img src='https://$$CompanyURL$$/images/mailer-twitter.png' style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>
                    <a href='$$GoogleplusShare$$' style='color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='_blank'> <img src='https://$$CompanyURL$$/images/mailer-gplus.png' style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>
                    <a href='$$LinkedinShare$$' style='color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='_blank'> <img src='https://$$CompanyURL$$/images/mailer-linkeden.jpg' style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>
                     <a href='$$PinterestShare$$' style='color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target='_blank'> <img src='https://$$CompanyURL$$/images/mailer-pintrest.png' style='border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>

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
    mailtxt = rep(mailtxt, '$$datetime$$', Date_);
    mailtxt = rep(mailtxt, '$$ReferralLInk$$', referallink);
    mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
    mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
    mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    mailtxt = rep(mailtxt, '$$FacebookShare$$', CompanySettings.FacebookShare);
    mailtxt = rep(mailtxt, '$$GoogleplusShare$$', CompanySettings.GoogleplusShare);
    mailtxt = rep(mailtxt, '$$TwitterShare$$', CompanySettings.TwitterShare);
    mailtxt = rep(mailtxt, '$$LinkedinShare$$', CompanySettings.LinkedinShare);
    mailtxt = rep(mailtxt, '$$PinterestShare$$', CompanySettings.PinterestShare);
    await SendMail.Send(0, '', email1, '', '', subject, mailtxt, SenderName);
  } catch (exp) { /* ViewBag.Message */ }
}

// auth
router.all(P + '/btnsendmail{/:id}', auth, asyncHandler(async (req, res) => {
  const plid = parseInt(req.user.plid, 10);
  let ret = '0';
  try {
    ret = '1';
    const { email1, referallink, SenderName } = req.p;
    setImmediate(() => { sendmail(plid, email1, referallink, SenderName).catch((e) => console.error(e.message)); });
  } catch (ex) {
    ret = ex.message;
  }
  res.json(ret);
}));

// auth
router.all(P + '/BtnSendSmsForReferAndEarn{/:id}', auth, asyncHandler(async (req, res) => {
  let ret = '0';
  try {
    let MobileNo = req.p.MobileNo;
    const Reflinks = req.p.Reflinks;
    MobileNo = String(MobileNo).replace(/,+$/, '');
    MobileNo = MobileNo.replace(/^,+/, '');
    ret = '1';
    setImmediate(() => {
      Promise.resolve(UtilityClass.SendMsgOnMobile(MobileNo, 'Hurry Up !!\r\nWe help you to earn money by refer link to your friends \r\n' + Reflinks + '\r\nFor more details visit \r\nhttps://' + CompanySettings.CompanyURL + '/.\r\nATCShopping Support Team')).catch((e) => console.error(e.message));
    });
  } catch (ex) {
    ret = ex.message;
  }
  res.json(ret);
}));

module.exports = router;
