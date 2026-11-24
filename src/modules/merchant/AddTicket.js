'use strict';
/** Port of Merchant Panel Controllers/CustomerPanel/AddTicket.cs (AddTicketController, 4 actions + helpers). DB: 'shopping' */
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { queryOne, procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const CompanySettings = require('../../lib/merchant/CompanySettings');
const SendMail = require('../../lib/merchant/SendMail');

const router = express.Router();
const DB = 'shopping';
const s = (v) => (v === null || v === undefined ? '' : String(v));
const rep = (str, k, v) => str.split(k).join(s(v));
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

// route-config: merchant/4Fa3dgSBxiyu2hTYRusqiw== -> Index, referral/addticket -> ReferralIndex, customer/addticket -> CustomerIndex
// auth
router.all(['/merchant/AddTicket/Index{/:id}', '/merchant/4Fa3dgSBxiyu2hTYRusqiw=='], auth, asyncHandler(async (req, res) => {
  let Od = req.p.Od;
  if (Od !== undefined && Od !== null) {
    Od = await UtilityClass.Decryptword(Od);
    Od = 'Ticket against order id ' + Od;
  } else {
    Od = '';
  }
  res.json({ view: '~/Views/AddTicket/Index.cshtml', Orderid: Od });
}));
// auth
router.all(['/merchant/AddTicket/ReferralIndex{/:id}', '/merchant/referral/addticket'], auth, (req, res) => res.json({ view: '~/Views/AddTicket/ReferralAddTicket.cshtml' }));
// auth
router.all(['/merchant/AddTicket/CustomerIndex{/:id}', '/merchant/customer/addticket'], auth, (req, res) => res.json({ view: '~/Views/AddTicket/CustomerAddTicket.cshtml' }));

/**
 * Master Method For Upload Image (base64 data-url => file under uploadDir). Synchronous, also used by SupportRequest.
 * PORT-NOTE: System.Drawing Image.FromStream validation / GetThumbnailImage re-encode (scale factor 1) is skipped; decoded bytes are written unchanged.
 */
function ImageUploadMasterMethod(ImageBase64Code, SavePaths, IdForAppend) {
  if (ImageBase64Code === undefined || ImageBase64Code === null) throw NRE();
  let RealImageName = '';
  if (ImageBase64Code.trim() !== '') {
    let Base64String = '';
    if (ImageBase64Code !== '') {
      Base64String = ImageBase64Code;
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
    const dir = path.join(config.uploadDir, String(SavePaths || '').replace(/^~?[\\/]+/, ''));
    const full = path.join(dir, RealImageName);
    if (Base64String.includes('base64,')) {
      Base64String = Base64String.substring(Base64String.indexOf(',') + 1);
      const bytes = Buffer.from(Base64String, 'base64');
      fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(full)) fs.unlinkSync(full);
      fs.writeFileSync(full, bytes);
    } else {
      RealImageName = ImageBase64Code.replace(/^\/+/, '');
    }
  }
  return RealImageName;
}

// protected void SendConfirmationEmail(...) - not routed
async function SendConfirmationEmail(ToEmail, Username, Text) {
  let send = 0;
  try {
    if (Username === '') Username = ToEmail;
    const subject = '' + CompanySettings.CompanyName + ' Ticket Generation Mail';
    let mailtxt = '';
    const Date_ = (() => { const d = new Date(); const p2 = (n) => String(n).padStart(2, '0'); return p2(d.getDate()) + '-' + p2(d.getMonth() + 1) + '-' + d.getFullYear(); })();
    if (send === 0) {
      mailtxt = `<div>
<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>
<tbody><tr><td>
<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>
<img src='$$CompanyDomainLogo$$' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>
<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'>$$datetime$$</td>
</tr></tbody></table></td>
</tr><tr><td>
<div>
<div class='clear'></div>

<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>
<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px15px; color: #000'>
Hello $$lblname$$,</h1>
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
If you have any issues regarding this mail, you can write us on <a style='color:#00008B'>$$SupportEmailId$$</a></p>
<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'></strong>
<div style='clear: both'></div>

<div style='clear: both'></div>
</td>
</tr><tr><td>
<table width='554'><tbody><tr><td>
<p style='font-size: 16px; line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>
Best Regards,
<br>
$$CompanyName$$ Team
</p>
</td>
<td style='width: 240px; text-align: right'>
<span>Follow us on</span>
<br>
<div style = 'margin-right: 7px; text-align:right'>
<a href = '$$FacebookShare$$' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = '$$CompanyDomain$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = '$$TwitterShare$$' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = '$$CompanyDomain$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = '$$GoogleplusShare$$' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = '$$CompanyDomain$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = '$$LinkedinShare$$' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = '$$CompanyDomain$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = '$$PinterestShare$$' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = '$$CompanyDomain$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>
</div
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
      mailtxt = rep(mailtxt, '$$SupportEmailId$$', CompanySettings.CompanySupportEmailId);
      mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
      mailtxt = rep(mailtxt, '$$CompanyDomainLogo$$', CompanySettings.CompanyDomainLogo);
      mailtxt = rep(mailtxt, '$$FacebookShare$$', CompanySettings.FacebookShare);
      mailtxt = rep(mailtxt, '$$TwitterShare$$', CompanySettings.TwitterShare);
      mailtxt = rep(mailtxt, '$$GoogleplusShare$$', CompanySettings.GoogleplusShare);
      mailtxt = rep(mailtxt, '$$LinkedinShare$$', CompanySettings.LinkedinShare);
      mailtxt = rep(mailtxt, '$$PinterestShare$$', CompanySettings.PinterestShare);
      const process = 'Merchant Ticket';
      await UtilityClass.TrackMerchantsEmails(ToEmail, mailtxt, process);
      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) { /* ViewBag.Message = exp.Message */ }
}

// auth
router.all('/merchant/AddTicket/GenerateTicket{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let Result = '';
  let AllImageName = '';
  let OneByOneImageName = '';
  const Plid = Number(req.user.plid);
  const folder = s(config.app.TicketCenterImage);
  const imgs = ['ImgPreviewFirst', 'ImgPreviewSecond', 'ImgPreviewThird', 'ImgPreviewFourth', 'ImgPreviewFifth', 'ImgPreviewSixth', 'ImgPreviewSeventh',
    'ImgPreviewEightth', 'ImgPreviewNineth', 'ImgPreviewTenth'];
  for (let i = 0; i < imgs.length; i++) {
    OneByOneImageName = ImageUploadMasterMethod(p[imgs[i]], folder, String(Plid));
    if (i === 0) AllImageName = OneByOneImageName;
    else AllImageName = AllImageName + (OneByOneImageName !== '' ? ',' : '') + (OneByOneImageName === '' ? '' : OneByOneImageName);
  }
  if (p.CategoryName === undefined || p.CategoryName === null || p.Subject === undefined || p.Subject === null || p.Message === undefined || p.Message === null) throw NRE();
  const row = await procOne(DB, 'sp_createaticket', {
    fromplid: String(Plid), categoryname: p.CategoryName.replace(/`/g, "'"), catid: parseInt(p.CategoryId, 10), subject: p.Subject.replace(/`/g, "'"),
    message: p.Message.replace(/`/g, "'"), image: AllImageName, accounttype: '1',
  });
  // PORT-NOTE: OUT params (@INTRESULT1, @MEMBEREMAILID, @TICKETID) are read from same-named lower-case columns of the result row.
  const pick = (n) => { const k = row && Object.keys(row).find((x) => x.toLowerCase() === n); return k === undefined ? null : row[k]; };
  Result = s(pick('intresult1')); // "Ok"
  const TicketID = s(pick('ticketid'));
  if (Result === 'Ok') {
    try {
      const o = await queryOne(DB, "Select coalesce(Phone,'') As Phone,EmailID,(FNAME) as UserName From Portal_Login where plid = @plid LIMIT 1", { plid: String(Plid) });
      const Obj = o ? { Phone: o.phone, EmailID: o.emailid, UserName: o.username } : null;
      if (Obj !== null && (Obj.EmailID !== '' || Obj.EmailID !== null)) {
        const PhoneMessage = 'Dear ' + Obj.UserName + ',Our tech support has put your ticket number  - ' + TicketID + ' into consideration.They will revert back soon.\r\n ' + CompanySettings.CompanyName + ' Team';
        const process = 'Merchant Ticket';
        if (Obj.Phone !== null && Obj.Phone !== undefined && Obj.Phone !== '') {
          await UtilityClass.SendMsgOnMobile(Obj.Phone, PhoneMessage);
          await UtilityClass.TrackMerchantsMessages(Obj.Phone, PhoneMessage, process);
        }
        await SendConfirmationEmail(Obj.EmailID, Obj.UserName, 'Your Ticket number - ' + TicketID + ' has been put into consideration.Our tech support team will further look into the matter and will revert back within 24 hours.');
      }
    } catch (Exp) { /* ViewBag.Message = Exp.Message */ }
  }
  res.json(Result);
}));

module.exports = router;
module.exports.ImageUploadMasterMethod = ImageUploadMasterMethod;
