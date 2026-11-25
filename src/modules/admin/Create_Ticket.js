'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Create_Ticket.cs (class Create_TicketController => /admin/Create_Ticket/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const SendMail = require('../../lib/admin/SendMail');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const B = require('./_shared/batch05_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Create_Ticket';

/** class GetLoginIdEmail */
const GLE_PROPS = ['Phone', 'EmailID', 'UserName', 'Password'];

/** private static bool ThumbnailCallback() { throw new NotImplementedException(); } (GetThumbnailImageAbort delegate, never invoked) */
function ThumbnailCallback() { throw new Error('The method or operation is not implemented.'); }
void ThumbnailCallback;

/** new Random().Next(min, max) */
const rnd = (min, max) => min + Math.floor(Math.random() * (max - min));

/**
 * public string ImageUploadMasterMethod(string ImageBase64Code, string SavePaths, string IdForAppend, string ImgPreviewTenth = "")
 * (public => also an MVC action returning the string as content)
 */
async function ImageUploadMasterMethod(ImageBase64Code, SavePaths, IdForAppend, ImgPreviewTenth = '') {
  let RealImageName = '';
  if (ImageBase64Code === null || ImageBase64Code === undefined) throw B.nullRef();
  if (ImageBase64Code.trim() !== '') {
    let Base64String = '';
    if (ImageBase64Code !== '') {
      Base64String = ImageBase64Code;
      let Image = String(rnd(100000, 1000000));
      Image = B.cleanName(Image);
      RealImageName = ImgPreviewTenth + Image + '-' + IdForAppend + '.jpg';
    } else {
      RealImageName = ' ';
    }
    const StrValidFullNameAndPath = path.join(B.mapPath(SavePaths), RealImageName);
    if (Base64String.includes('base64,')) {
      const ByteArray = B.decodeBase64Image(Base64String);
      const sharp = require('sharp');
      const meta = await sharp(ByteArray).metadata(); // Image.FromStream
      const filesize = ByteArray.length / 1024;
      if (fs.existsSync(StrValidFullNameAndPath)) fs.unlinkSync(StrValidFullNameAndPath);
      const scaleFactor = 1; // (.25 overwritten by 1 in legacy)
      const newWidth = Math.trunc(meta.width * scaleFactor);
      const newHeight = Math.trunc(meta.height * scaleFactor);
      fs.mkdirSync(path.dirname(StrValidFullNameAndPath), { recursive: true });
      if (filesize > 10) {
        // GetThumbnailImage(newWidth, newHeight) -> JPEG -> reload -> Save(path)
        const jpeg = await sharp(ByteArray).resize(newWidth, newHeight, { fit: 'fill' }).jpeg().toBuffer();
        fs.writeFileSync(StrValidFullNameAndPath, jpeg);
      } else {
        fs.writeFileSync(StrValidFullNameAndPath, ByteArray);
      }
    } else {
      RealImageName = ImageBase64Code.replace(/^\/+/, ''); // TrimStart('/')
    }
  }
  return RealImageName;
}

const MAIL_TEMPLATE = `<div>
<link href='http://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>
<tbody><tr><td>
<table width='585'><tbody><tr><td style='width: 350px'><a href='http://cryptoinbox.in/' target='UlOxf6W290vd9HCE04UigQH'>
<img src='http://cryptoinbox.in/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>
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
If you have any issues regarding this mail, you can write us on <a style='color:red'>support@cryptoinbox.in</a></p>
<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'></strong>
<div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px'>
<center>
<img src='http://webmail.cryptoinbox.com/imp/themes/default/graphics/spacer_red.png' htmlimgblocked='http://cryptoinbox.in/images/divider.png'></center>
</div>

<div style='clear: both'></div>

<div style='clear: both'></div>
</td>
</tr><tr><td>
<table width='554'><tbody><tr><td>
<p style='font-size: 16px; line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>
Sincerely,
<br>
Crypto Inbox Team
</p>
</td>
<td style='width: 240px; text-align: right'>
<div style='margin-right: 7px'>
<font style='margin-right:0px; font-size: 16px; color:#000; font-family:  Arial, Helvetica, sans-serif; float: left; margin-top:2px; font-weight: normal; padding-top:3px'>Follow us on </font>
<a href='http://www.facebook.com/CryptoInbox/' style='color:#3b5998; border: none; text-decoration: none' target='8SE_b89lng5GVbx5a7NZME9'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-facebook'></i></a>
<a href='http://twitter.com/CryptoInbox' style='color:#55acee; border: none; text-decoration: none' target='e3PP7S0O2rDcb5kT5Qxvkl9'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-twitter'></i></a>
<a href='http://plus.google.com/+Crypto InboxIn' style='color:#dd4b39; border: none; text-decoration: none' target='k_lu77WHdSxxe84MTtrgPlD'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-google-plus'></i></a>
<a href='http://www.linkedin.com/company/Crypto Inbox' style='color: #0072a4;' border: none; text-decoration: none' target='1QtmtsX-zlkY3NH-RX8bXJB'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-linkedin'></i></a>
<a href='http://pinterest.com/CryptoInbox/' style='color:#cb2027; border: none; text-decoration: none' target='FTivBEnhJ2wIlo_i9yYL1Xk'>
<i style='margin:4px 0 0 0; font-size:20px;' class='fa fa-pinterest-p'></i></a>
</div>
</td>
</tr></tbody></table></td>
</tr></tbody></table><div class='clear'></div>
</div>
</td>
</tr></tbody></table>
    </div>`;

/** protected void SendConfirmationEmail(string ToEmail, string Username, string Text) */
async function SendConfirmationEmail(req, ToEmail, Username, Text) {
  let send = 0;
  try {
    const subject = ' Support Center';
    let mailtxt = '';
    const DateS = B.netFormat(new Date(), 'dd-MM-yyyy');
    if (send === 0) {
      // MailMessage mm = new MailMessage("cryptoinbox@mlmkabila.com", ToEmail) { IsBodyHtml = true } - built but never sent in legacy
      if (ToEmail === null || ToEmail === undefined || ToEmail === '') throw new Error('The parameter \'addresses\' cannot be an empty string.');
      mailtxt = MAIL_TEMPLATE;
      mailtxt = mailtxt.split('$$lblname$$').join(Username === null || Username === undefined ? '' : Username);
      mailtxt = mailtxt.split('$$datetime$$').join(DateS);
      mailtxt = mailtxt.split('$$lblmessage$$').join(Text === null || Text === undefined ? '' : Text);
      const result = await SendMail.Send('', ToEmail, '', '', subject, mailtxt);
      if (result === 's') {
        send = 1;
      } else {
        return;
      }
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'SendConfirmationEmail');
  }
}

// ---------------------------------------------------------------- ActionResult Index(string transID)
// auth (admin page; legacy had no session check - PORT-NOTE: protected with adminAuth)
// route-config: "AdminPanel/Create-Ticket" -> Create_Ticket/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Create-Ticket'], adminAuth, asyncHandler(async (req, res) => {
  void req.p.transID;
  return res.json({ view: '~/Views/AdminPanel/Create_Ticket/Index.cshtml', ImageName: '../../icons/Noimg.png' });
}));

// ---------------------------------------------------------------- JsonResult CreateTicket(...)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/CreateTicket{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const s = (k) => B.nStr(req.p[k]);
  const category = s('category'); const memberid = s('memberid'); const subject = s('subject'); const message = s('message');
  const popupimg = s('popupimg'); const CategoryName = s('CategoryName');
  const imgs = ['ImgPreviewFirst', 'ImgPreviewSecond', 'ImgPreviewThird', 'ImgPreviewFourth', 'ImgPreviewFifth', 'ImgPreviewSixth',
    'ImgPreviewSeventh', 'ImgPreviewEightth', 'ImgPreviewNineth', 'ImgPreviewTenth'];
  const I = {}; for (const k of imgs) I[k] = s(k);
  let msg = '';
  const strValidFullName = '';
  try {
    let AllImageName = '';
    let toRegNo = 0;
    // PORT-NOTE: legacy concatenated memberid into the SQL (injection); parameterised.
    const reg = await db.scalar(DB, 'select regno from member_master where username = @memberid and status = 1 limit 1', { memberid });
    toRegNo = reg === null || reg === undefined ? 0 : Number(reg); // Convert.ToDouble(null) => 0
    const PanImage = popupimg; void PanImage;
    let OneByOneImageName = '';
    const Plid = toRegNo;
    const count = Number(await db.scalar(DB, 'select count(1) from tbl_ticketmaster', {})); void count;
    const TicketImage = config.app.TicketImage === undefined || config.app.TicketImage === null ? '' : String(config.app.TicketImage);
    const cs = (v) => (v === null ? '' : v); // Convert.ToString
    // #region First Image
    if (cs(I.ImgPreviewFirst) !== '') {
      try {
        AllImageName = await ImageUploadMasterMethod(I.ImgPreviewFirst, TicketImage, String(Plid), 'ImgPreviewFirst');
        if (AllImageName !== '') AllImageName = '/Create_Member_Ticket/' + AllImageName;
      } catch (expObj) {
        AllImageName = '/Create_Member_Ticket/' + expObj.message;
      }
    }
    // #region Second .. Ninth Image
    for (const k of imgs.slice(1, 9)) {
      if (cs(I[k]) !== '') {
        try {
          OneByOneImageName = await ImageUploadMasterMethod(I[k], TicketImage, String(Plid), k);
          if (OneByOneImageName !== '') {
            OneByOneImageName = '/Create_Member_Ticket/' + OneByOneImageName;
            AllImageName = AllImageName + (OneByOneImageName !== '' ? ',' : '') + (OneByOneImageName === '' ? '' : OneByOneImageName);
          }
        } catch (expObj) {
          if (k === 'ImgPreviewSecond') AllImageName = '/Create_Member_Ticket/' + expObj.message; // second: assignment (legacy)
          else if (k === 'ImgPreviewNineth') AllImageName = AllImageName + '~/Create_Member_Ticket/' + expObj.message;
          else AllImageName = AllImageName + '/Create_Member_Ticket/' + expObj.message;
        }
      }
    }
    // #region Tenth Image
    if (cs(I.ImgPreviewTenth) !== '') {
      try {
        OneByOneImageName = await ImageUploadMasterMethod(I.ImgPreviewTenth, TicketImage, String(Plid), 'ImgPreviewTenth');
        // PORT-NOTE: legacy never appended the tenth image name to AllImageName - kept.
        if (OneByOneImageName !== '') OneByOneImageName = '/Create_Member_Ticket/' + OneByOneImageName;
      } catch (expObj) {
        AllImageName = AllImageName + '/Create_Member_Ticket/' + expObj.message;
      }
    }
    if (AllImageName !== '') AllImageName = AllImageName.replace(/^,+/, '');
    // PORT-NOTE: legacy concatenated category into the SQL; parameterised (non-numeric => SQL error => catch, like the legacy).
    const catname = B.str(await db.scalar(DB, 'select categoryname from categorymaster where catid = (@category)::int limit 1', { category }));
    void catname;
    const EMid = req.user.emp_id;
    const row = await db.queryOne(DB, 'select emp_id from tbl_employee_master where emp_id = @EMid limit 1', { EMid }); void row;
    if (CategoryName === null || subject === null || message === null) throw B.nullRef(); // .Replace on null
    const r = await db.procOne(DB, 'SP_CREATEATICKET', {
      FROMPLID: toRegNo, CATEGORYNAME: CategoryName.split('`').join("'"), CATID: category, SUBJECT: subject.split('`').join("'"),
      MESSAGE: message.split('`').join("'"), IMAGE: AllImageName,
    });
    msg = B.outStr(r, 'intresult1'); // "Ok"
    const TicketID = B.outStr(r, 'ticketid');
    if (msg.toLowerCase() === 'ok') {
      try {
        // PORT-NOTE: legacy concatenated toRegNo into the SQL; parameterised.
        const o = await db.queryOne(DB, "select coalesce(phone,'') as phone, emailid, username from portal_login where plid = @toRegNo limit 1", { toRegNo });
        const Obj = o ? mapRow(o, GLE_PROPS) : null;
        if (Obj !== null && (Obj.EmailID !== '' || Obj.EmailID !== null)) {
          const PhoneMessage = 'Dear ' + Obj.UserName + ',Your ticket, reference no. - ' + TicketID
            + ' has been created successfully.\r\n For more details visit http://cryptoinbox.in/.\r\n Crypto Inbox Support Team.';
          void PhoneMessage; // SMS send is commented out in legacy
          await SendConfirmationEmail(req, Obj.EmailID, Obj.UserName, 'Your ticket, reference no. - ' + TicketID + ' has been created successfully.');
        }
      } catch (Exp) {
        // ViewBag.Message = Exp.Message (not part of the JSON response)
      }
    }
    // PORT-NOTE: `int ret = ExecuteSqlCommand(...)` (rows affected by the proc) is not available from PostgreSQL; a successful
    // proc ("ok") is treated as ret > 0.
    const ret = msg.toLowerCase() === 'ok' ? 1 : 0;
    if (ret > 0) {
      msg = 'ok';
    } else if (strValidFullName.trim() !== '') {
      if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    }
    return res.json(msg);
  } catch (ex) {
    if (strValidFullName.trim() !== '') {
      if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    }
    return res.json(msg);
  }
}));

// ---------------------------------------------------------------- public string ImageUploadMasterMethod(string ImageBase64Code, string SavePaths, string IdForAppend, string ImgPreviewTenth = "")
// auth (public method => routable in legacy (ContentResult); writes files - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/ImageUploadMasterMethod{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const tenth = B.nStr(req.p.ImgPreviewTenth);
  const r = await ImageUploadMasterMethod(B.nStr(req.p.ImageBase64Code), B.nStr(req.p.SavePaths), B.nStr(req.p.IdForAppend), tenth === null ? '' : tenth);
  res.type('text/html').send(r);
}));

module.exports = router;
