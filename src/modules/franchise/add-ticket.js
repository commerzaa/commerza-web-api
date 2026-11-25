'use strict';
/** Port of Franchise/Controllers/CustomerPanel/AddTicket.cs. DB: 'shopping' */
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { queryOne, procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const CompanySettings = require('../../lib/franchise/CompanySettings');
const SendMail = require('../../lib/franchise/SendMail');

const router = express.Router();
const DB = 'shopping';
const s = (v) => (v === null || v === undefined ? '' : String(v));
const rep = (str, k, v) => str.split(k).join(s(v));

// route-config: franchisee/addticket -> Index, referral/addticket -> ReferralIndex, customer/addticket -> CustomerIndex
// auth
router.all(['/franchise/AddTicket/Index{/:id}', '/franchise/franchisee/addticket'], auth, (req, res) => res.json({ view: '~/Views/AddTicket/Index.cshtml' }));
// auth
router.all(['/franchise/AddTicket/ReferralIndex{/:id}', '/franchise/referral/addticket'], auth, (req, res) => res.json({ view: '~/Views/AddTicket/ReferralAddTicket.cshtml' }));
// auth
router.all(['/franchise/AddTicket/CustomerIndex{/:id}', '/franchise/customer/addticket'], auth, (req, res) => res.json({ view: '~/Views/AddTicket/CustomerAddTicket.cshtml' }));

/** Master Method For Upload Image (base64 data-url => file under uploadDir) */
async function ImageUploadMasterMethod(ImageBase64Code, SavePaths, IdForAppend) {
  let RealImageName = '';
  if (s(ImageBase64Code).trim() !== '') {
    let Base64String = ImageBase64Code;
    if (ImageBase64Code !== '') {
      let Image = String(Math.floor(Math.random() * 900000) + 100000);
      Image = Image.trim();
      Image = Image.replace(/&amp;/g, 'And');
      Image = Image.replace(/&/g, ' And ');
      Image = Image.replace(/[^\w\d]/g, '');
      Image = Image.replace(/ /g, '-');
      RealImageName = Image + '-' + IdForAppend + '.jpg';
    } else {
      RealImageName = ' ';
    }
    const dir = path.join(config.uploadDir, String(SavePaths).replace(/^~?[\\/]+/, ''));
    const full = path.join(dir, RealImageName);
    if (Base64String.includes('base64,')) {
      Base64String = Base64String.substring(Base64String.indexOf(',') + 1);
      const bytes = Buffer.from(Base64String, 'base64');
      fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(full)) fs.unlinkSync(full);
      // PORT-NOTE: System.Drawing thumbnail re-encode at scale 1 is skipped; original bytes are written unchanged.
      fs.writeFileSync(full, bytes);
    } else {
      RealImageName = ImageBase64Code.replace(/^\/+/, '');
    }
  }
  return RealImageName;
}

async function SendConfirmationEmail(ToEmail, Username, Text) {
  let send = 0;
  try {
    const subject = '' + CompanySettings.CompanyName + ' Support Center';
    const Date_ = (() => { const d = new Date(); const p2 = (n) => String(n).padStart(2, '0'); return p2(d.getDate()) + '-' + p2(d.getMonth() + 1) + '-' + d.getFullYear(); })();
    if (send === 0) {
      let mailtxt = `<div>
<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif;width: 585px'>
<tbody><tr><td>
<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>
<img src='https://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>
<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: 'Exo', sans-serif, Helvetica, sans-serif; width: 250px'>$$datetime$$</td>
</tr></tbody></table></td>
</tr><tr><td>
<div>
<div class='clear'></div>

<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>
<h1 style='font-size: 18px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px15px; color: #000'>
Dear $$lblname$$,</h1>
<strong style='font-size: 16px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>
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
<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; color: #000'>

</p>
<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; color: #000'>
If you have any issues regarding this mail, you can write us on <a style='color:red'>$$CompanySupportEmailID$$</a></p>
<strong style='font-size: 16px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'></strong>
<div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px'>
<center>
<img src='http://webwebmail.mlmkabila.com/imp/themes/default/graphics/spacer_red.png' htmlimgblocked='https://$$CompanyURL$$/images/divider.png'></center>
</div>

<div style='clear: both'></div>

<div style='clear: both'></div>
</td>
</tr><tr><td>
<table width='554'><tbody><tr><td>
<p style='font-size: 16px; line-height:1.6; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>
Sincerely,
<br>
$$CompanyName$$ Team
</p>
</td>
<td style='width: 240px; text-align: right'>
<div style='margin-right: 7px'>
<font style='margin-right:0px; font-size: 16px; color:#000; font-family:  Arial, Helvetica, sans-serif; float: left; margin-top:2px; font-weight: normal; padding-top:3px'>Follow us on </font>
<a href='javascript:void(0)' style='color:#3b5998; border: none; text-decoration: none' target='8SE_b89lng5GVbx5a7NZME9'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-facebook'></i></a>
<a href='javascript:void(0)' style='color:#55acee; border: none; text-decoration: none' target='e3PP7S0O2rDcb5kT5Qxvkl9'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-twitter'></i></a>
<a href='javascript:void(0)' style='color:#dd4b39; border: none; text-decoration: none' target='k_lu77WHdSxxe84MTtrgPlD'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-google-plus'></i></a>
<a href='javascript:void(0)' style='color: #0072a4;' border: none; text-decoration: none' target='1QtmtsX-zlkY3NH-RX8bXJB'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-linkedin'></i></a>
<a href='javascript:void(0)' style='color:#cb2027; border: none; text-decoration: none' target='FTivBEnhJ2wIlo_i9yYL1Xk'>
<i style='margin:4px 0 0 0; font-size:20px;' class='fa fa-pinterest-p'></i></a>
</div>
</td>
</tr></tbody></table></td>
</tr></tbody></table><div class='clear'></div>
</div>
</td>
</tr></tbody></table>
    </div>`;
      mailtxt = rep(mailtxt, '$$lblname$$', Username);
      mailtxt = rep(mailtxt, '$$datetime$$', Date_);
      mailtxt = rep(mailtxt, '$$lblmessage$$', Text);
      mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
      mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
      mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
      mailtxt = rep(mailtxt, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) { /* ViewBag.Message = exp.Message */ }
}

// auth
router.all('/franchise/AddTicket/GenerateTicket{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let Result = '';
  let AllImageName = '';
  let OneByOneImageName = '';
  const Plid = Number(req.user.did);
  const folder = s(config.app.TicketCenterImage);
  const imgs = ['ImgPreviewFirst', 'ImgPreviewSecond', 'ImgPreviewThird', 'ImgPreviewFourth', 'ImgPreviewFifth', 'ImgPreviewSixth', 'ImgPreviewSeventh',
    'ImgPreviewEightth', 'ImgPreviewNineth', 'ImgPreviewTenth'];
  for (let i = 0; i < imgs.length; i++) {
    OneByOneImageName = await ImageUploadMasterMethod(s(p[imgs[i]]), folder, String(Plid));
    if (i === 0) AllImageName = OneByOneImageName;
    else AllImageName = AllImageName + (OneByOneImageName !== '' ? ',' : '') + (OneByOneImageName === '' ? '' : OneByOneImageName);
  }
  const row = await procOne(DB, 'sp_createaticket', {
    fromdid: String(Plid), categoryname: s(p.CategoryName).replace(/`/g, "'"), catid: parseInt(p.CategoryId, 10), subject: s(p.Subject).replace(/`/g, "'"),
    message: s(p.Message).replace(/`/g, "'"), image: AllImageName, accounttype: '3  ',
  });
  const pick = (n) => { const k = row && Object.keys(row).find((x) => x.toLowerCase() === n); return k === undefined ? null : row[k]; };
  Result = s(pick('intresult1'));
  const TicketID = pick('ticketid').toString();
  if (Result === 'Ok') {
    try {
      const o = await queryOne(DB, "SELECT coalesce(phone,'') AS phone, emailid, username FROM distributor_login WHERE did = @did LIMIT 1", { did: String(Plid) });
      const Obj = o ? { Phone: o.phone, EmailID: o.emailid, UserName: o.username } : null;
      if (Obj !== null && (Obj.EmailID !== '' || Obj.EmailID !== null)) {
        const PhoneMessage = 'Dear ' + Obj.UserName + ',Your ticket, reference no. - ' + TicketID + ' has been created successfully.\r\n For more details visit ' + CompanySettings.CompanyDomain + '.\r\n ' + CompanySettings.CompanyName + ' Support Team.';
        if (Obj.Phone !== null && Obj.Phone !== '') await UtilityClass.SendMsgOnMobile(Obj.Phone, PhoneMessage);
        await SendConfirmationEmail(Obj.EmailID, Obj.UserName, 'Your ticket, reference no. - ' + TicketID + ' has been created successfully.');
      }
    } catch (Exp) { /* ViewBag.Message = Exp.Message */ }
  }
  res.json(Result);
}));

module.exports = router;
