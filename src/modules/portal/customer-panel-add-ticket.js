'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\AddTicket.cs (class AddTicketController => /portal/AddTicket/...)
// Database: shopping (Db_Shopping). Fork of the Merchant Panel AddTicket.cs (compared line by line; portal differences applied).
// [DistributerSessionExpireCheck]: body commented out in legacy => no extra check.
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/portal/UtilityClass');
const CompanySettings = require('../../lib/portal/CompanySettings');
const SendMail = require('../../lib/portal/SendMail');
const ps = require('./_shared/portal-session');
const {
  DB, view, masterpageshow, outv, s, need, rep, toInt32, ddMMyyyy, ImageUploadMasterMethod,
} = require('./_shared/batch-02-common');

const router = express.Router();
const C = '/portal/AddTicket';

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "merchant/addticket" -> AddTicket/Index
router.all([`${C}/Index{/:id}`, C, '/portal/merchant/addticket'], ps.customerAuth,
  (req, res) => view(res, '~/Views/CustomerPanel/AddTicket/Index.cshtml'));

// ---------------------------------------------------------------- ReferralIndex()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "referral/addticket" -> AddTicket/ReferralIndex
router.all([`${C}/ReferralIndex{/:id}`, '/portal/referral/addticket'], ps.customerAuth,
  (req, res) => view(res, '~/Views/CustomerPanel/AddTicket/ReferralAddTicket.cshtml'));

// ---------------------------------------------------------------- CustomerIndex()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "customer/addticket" -> AddTicket/CustomerIndex
router.all([`${C}/CustomerIndex{/:id}`, '/portal/customer/addticket'], ps.customerAuth,
  (req, res) => view(res, '~/Views/CustomerPanel/AddTicket/CustomerAddTicket.cshtml', undefined, { masterpageshow: masterpageshow(req) }));

// ---------------------------------------------------------------- CustomermobileIndex()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "customer/addticket-mobile" -> AddTicket/CustomermobileIndex
router.all([`${C}/CustomermobileIndex{/:id}`, '/portal/customer/addticket-mobile'], ps.customerAuth,
  (req, res) => view(res, '~/Views/CustomerPanel/AddTicket/CustomerAddTicketmobile.cshtml', undefined, { masterpageshow: masterpageshow(req) }));

const MAIL_TEMPLATE = `<div>
<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>
<tbody><tr><td>
<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>
<img src='https://shop.sohunginfotech.com/images/$$CompanyLogo$$' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>
<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'>$$datetime$$</td>
</tr></tbody></table></td>
</tr><tr><td>
<div>
<div class='clear'></div>

<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>
<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px15px; color: #000'>
Dear $$lblname$$,</h1>
<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>
This Email is the confirmation for your ticket submission. </strong>
<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>
<table cellpadding='0' cellspacing='0' width='98%' style='font-size:14px;  font-family:Arial; color:#454545;  border:1px solid #eaeaea; background:#f0ffff;  '>
    <tr>
        <td colspan='3' style='height:10px; line-height:10px;'></td>
    </tr>
    <tr> 
    <td colspan='3' style='height:10px; line-height:30px;'>$$lblmessage$$</td>
    </tr>

    <tr>
        <td colspan='3' style='height:15px; line-height:15px;'></td>
    </tr>

</table>
</p>
<div style='clear: both'></div>
<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'> 

</p>
<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>
If you have any issues regarding this mail, you can write us on <a style='color:red' href='mailto:$$CompanySupportEmailId$$'>$$CompanySupportEmailId$$</a></p>
<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'></strong>
<div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px'>
<center>
<img src='http://webmail.jewria.com/imp/themes/default/graphics/spacer_red.png' htmlimgblocked='https://$$CompanyDomain$$/images/divider.png'></center>
</div>

<div style='clear: both'></div>

<div style='clear: both'></div>
</td>
</tr><tr><td>
<table width='554'><tbody><tr><td>
<p style='font-size: 16px; line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>
Sincerely,
<br>
$$CompanyName$$ Team
</p>
</td>
</tr></tbody></table></td>
</tr></tbody></table><div class='clear'></div>
</div>
</td>
</tr></tbody></table>
    </div>`;

const MAIL_RE = /^[^@\s]+@[^@\s]+$/;

/** protected void SendConfirmationEmail(string ToEmail, string Username, string Text) - not routed */
async function SendConfirmationEmail(ToEmail, Username, Text) {
  let send = 0;
  try {
    if (Username === '') Username = ToEmail;
    const subject = '' + s(CompanySettings.CompanyName) + ' Support Center';
    let mailtxt = '';
    const Date_ = ddMMyyyy();
    if (send === 0) {
      // new MailMessage(CompanySettings.NoReplyMail, ToEmail) threw for a null/invalid address (caught below => no mail)
      if (!MAIL_RE.test(s(CompanySettings.NoReplyMail).trim()) || !MAIL_RE.test(need(ToEmail).trim())) {
        throw new Error('The specified string is not in the form required for an e-mail address.');
      }
      mailtxt = MAIL_TEMPLATE;
      mailtxt = rep(mailtxt, '$$lblname$$', Username);
      mailtxt = rep(mailtxt, '$$datetime$$', Date_);
      mailtxt = rep(mailtxt, '$$lblmessage$$', Text);
      mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
      mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
      mailtxt = rep(mailtxt, '$$CompanyLogo$$', CompanySettings.CompanyLogo);
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

// ---------------------------------------------------------------- GenerateTicket(CategoryId, CategoryName, Subject, Message, ImgPreviewFirst..ImgPreviewTenth)
// auth (legacy: unguarded (Login)Session["Plid"] => NullReferenceException without a session)
router.all(`${C}/GenerateTicket{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  let Result = '';
  let AllImageName = '';
  let OneByOneImageName = '';
  const Plid = Number(req.user.plid);
  const folder = s(config.app.TicketCenterImage);
  const imgs = ['ImgPreviewFirst', 'ImgPreviewSecond', 'ImgPreviewThird', 'ImgPreviewFourth', 'ImgPreviewFifth', 'ImgPreviewSixth',
    'ImgPreviewSeventh', 'ImgPreviewEightth', 'ImgPreviewNineth', 'ImgPreviewTenth'];
  AllImageName = await ImageUploadMasterMethod(p[imgs[0]], folder, String(Plid));
  for (let i = 1; i < imgs.length; i++) {
    OneByOneImageName = await ImageUploadMasterMethod(p[imgs[i]], folder, String(Plid));
    AllImageName = AllImageName + (OneByOneImageName !== '' ? ',' : '') + (OneByOneImageName === '' ? '' : OneByOneImageName);
  }

  const rows = await db.proc(DB, 'SP_CREATEATICKET', {
    FROMPLID: String(Plid), CATEGORYNAME: need(p.CategoryName).split('`').join("'"), CATID: toInt32(p.CategoryId),
    SUBJECT: need(p.Subject).split('`').join("'"), MESSAGE: need(p.Message).split('`').join("'"), IMAGE: AllImageName, ACCOUNTTYPE: '2',
  });
  Result = s(outv(rows, 'INTRESULT1')); // "Ok"
  const TicketID = s(outv(rows, 'TICKETID'));
  if (Result === 'Ok') {
    try {
      const o = await db.queryOne(DB, "Select coalesce(Phone,'') As Phone, EmailID, UserName From tbl_customerlogin where Clid = @Clid limit 1",
        { Clid: String(Plid) });
      const Obj = o ? { Phone: o.phone, EmailID: o.emailid, UserName: o.username } : null;
      if (Obj !== null && (Obj.EmailID !== '' || Obj.EmailID !== null)) {
        const PhoneMessage = 'Dear ' + s(Obj.UserName) + ',Your ticket, reference no. - ' + TicketID + ' has been created successfully.\r\n '
          + s(CompanySettings.CompanyName) + ' Support Team.';
        if (Obj.Phone !== null && Obj.Phone !== '') {
          await UtilityClass.SendMsgOnMobile(Obj.Phone, PhoneMessage);
        }
        await SendConfirmationEmail(Obj.EmailID, Obj.UserName, 'Your ticket, reference no. - ' + TicketID + ' has been created successfully.');
      }
    } catch (Exp) {
      // ViewBag.Message = Exp.Message
    }
  }
  return res.json(Result);
}));

// ---------------------------------------------------------------- ImageUploadMasterMethod(string ImageBase64Code, string SavePaths, string IdForAppend)
// auth (PORT-NOTE: public helper => reachable MVC action in legacy WITHOUT a session check that writes files to a client-chosen folder;
// protected here, and paths outside uploadDir are refused)
router.all(`${C}/ImageUploadMasterMethod{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const out = await ImageUploadMasterMethod(req.p.ImageBase64Code, req.p.SavePaths, s(req.p.IdForAppend));
  return res.type('text/html').send(out); // string action => ContentResult
}));

module.exports = router;
