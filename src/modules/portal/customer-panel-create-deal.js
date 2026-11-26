// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\CreateDeal.cs (class CreateDealController => /portal/CreateDeal/...)
'use strict';
// Database: shopping (Db_Shopping). The friendly URL "merchant/createdeal" is commented out in RouteConfig.cs.
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const SendMail = require('../../lib/portal/SendMail');
const CompanySettings = require('../../lib/portal/CompanySettings');
const { Portal_Deal_Master } = require('../../lib/portal/Portal_Deal_Master');
const { nullRef, mvcStr, toInt32, toDecimal, toStr, outOf } = require('./_shared/batch-03-common');
const { view } = require('./_shared/batch-06-common');
const { multerAny } = require('./_shared/batch-04-common');
const { MAIL_RE } = require('./_shared/batch-22-common');

const DB = 'shopping';
const router = express.Router();
const C = '/portal/CreateDeal';
const VIEW = '~/Views/CustomerPanel/CreateDeal/Index.cshtml';

/** string.TrimEnd(',') / TrimStart(',') */
const trimEndComma = (s) => s.replace(/,+$/, '');
const trimStartComma = (s) => s.replace(/^,+/, '');
const need = (v) => { if (v === null || v === undefined) nullRef(); return String(v); };

// ---------------------------------------------------------------- ActionResult Index(string id)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
router.all([`${C}/Index{/:id}`, C], ps.customerAuth, asyncHandler(async (req, res) => {
  const id = mvcStr(req, 'id');
  const ViewBag = {};
  const TempData = {};
  if (id !== null) {
    const ID = toInt32(toStr(await UtilityClass.Decryptword(id)));
    ps.tempDataSet(req, 'ID', ID);
    TempData.ID = ID;
    const row = mapRow(await db.queryOne(DB, 'select * from portal_deal_master where dealid = @ID limit 1', { ID }), Portal_Deal_Master.PROPS);
    if (row !== null) ViewBag.DealsDetails = row;
  }
  return view(res, VIEW, undefined, ViewBag, { TempData });
}));

// ---------------------------------------------------------------- [HttpPost] ActionResult AddNewDeals(AddDeals ObjAddDeals, string Description, string Command, string AllDelasTermsHf, string AllDelasHighlightsHf, string hfImagename)
// auth (legacy cast (Login)Session["Plid"] inside its try: a null session ended in the catch => View; protected here)
// multipart/form-data: ObjAddDeals.Upload (HttpPostedFileBase[]) => multer memory storage, field "Upload" (or "ObjAddDeals.Upload").
router.post(`${C}/AddNewDeals{/:id}`, ps.customerAuth, multerAny(), asyncHandler(async (req, res) => {
  const ViewBag = {};
  const b = req.body || {};
  const field = (name) => {
    const v = mvcStr(req, name);
    return v !== null ? v : (b['ObjAddDeals.' + name] === undefined ? null : String(b['ObjAddDeals.' + name]));
  };
  /** model binding of a decimal property: invalid / missing => default 0 (ModelState error, no exception) */
  const decProp = (name) => { try { const v = field(name); return v === null || v.trim() === '' ? 0 : toDecimal(v); } catch (e) { return 0; } };
  const ObjAddDeals = {
    Title: field('Title'), OfferReward: field('OfferReward'), Description: field('Description'), StartingPrice: decProp('StartingPrice'),
    Discount: decProp('Discount'), DealsFrom: field('DealsFrom'), DealsTill: field('DealsTill'), Highlights: field('Highlights'), Terms: field('Terms'),
    Upload: null,
  };
  // PORT-NOTE: MVC binds a posted but empty <input type=file> as [null]; a request without any multipart body leaves Upload null
  //   (=> NullReferenceException in the C#). Files of size 0 / without a name are treated as that null entry.
  const files = (req.files || []).filter((f) => /^(ObjAddDeals\.)?Upload(\[\d*\])?$/i.test(f.fieldname));
  const real = files.filter((f) => f.originalname && f.size > 0);
  if (real.length > 0) ObjAddDeals.Upload = real;
  else if (req.is('multipart/form-data')) ObjAddDeals.Upload = [null];
  const Description = mvcStr(req, 'Description'); const Command = mvcStr(req, 'Command');
  const AllDelasTermsHf = mvcStr(req, 'AllDelasTermsHf'); const AllDelasHighlightsHf = mvcStr(req, 'AllDelasHighlightsHf');
  const hfImagename = mvcStr(req, 'hfImagename');
  try {
    const Plid = toInt32(req.user.plid);
    let ImageName = trimEndComma(need(hfImagename));
    if (ObjAddDeals.Upload === null) nullRef();
    if (ObjAddDeals.Upload[0] !== null) {
      for (const File of ObjAddDeals.Upload) {
        const BinaryData = File.buffer;
        const ImageBase64Code = 'data:image/jpeg;base64,' + BinaryData.toString('base64');
        const Orginial_Folder_Name = (config.app && config.app.DelasImagePath) || '';
        const Thumb_Folder_Name = (config.app && config.app.DelasThumbleImagePath) || '';
        ImageName = ImageName + ',' + need(await UtilityClass.ImageUploadMasterMethod(ImageBase64Code, Orginial_Folder_Name, Thumb_Folder_Name,
          UtilityClass.ImageMode.Both, String(Plid))).trim();
      }
      ImageName = ImageName.trim();
      ImageName = trimEndComma(trimStartComma(ImageName));
    } else {
      ImageName = trimEndComma(hfImagename);
    }
    let DealID = 0;
    let Mode = 0;
    if (Command === 'Save Deal') { DealID = 0; Mode = 1; }
    if (Command === 'Update Deal') { DealID = toInt32(ps.tempDataGet(req, 'ID')); Mode = 2; }
    // [USP_INS_PORTAL_DEAL_MASTER] @TITLE,@OFFER,@DESC,@DISCOUNT,@STARTPRICE,@DEALFROM,@DEALTO,@TERMS,@HIGHLIGHT,@PMID,@IMAGES,@CURRDEALID out,@STRRESULT out,@Mode,@DEALID
    const rows = await db.proc(DB, 'usp_ins_portal_deal_master', {
      title: need(ObjAddDeals.Title).trim(),
      offer: need(ObjAddDeals.OfferReward).trim(),
      desc: need(Description).trim(),
      discount: toInt32(ObjAddDeals.Discount),
      startprice: toInt32(ObjAddDeals.StartingPrice),
      // PORT-NOTE: a null SqlParameter value meant "not supplied" (proc default ''); passed as '' here.
      dealfrom: ObjAddDeals.DealsFrom === null ? '' : ObjAddDeals.DealsFrom,
      dealto: ObjAddDeals.DealsTill === null ? '' : ObjAddDeals.DealsTill,
      terms: need(AllDelasTermsHf).trim(),
      highlight: need(AllDelasHighlightsHf).trim(),
      pmid: Plid,
      images: ImageName,
      mode: Mode,
      dealid: DealID,
    });
    // PORT-NOTE: ExecuteSqlCommand returned the rows affected (SET NOCOUNT is off in the proc). PostgreSQL functions do not report it:
    //   a returned result row counts as ReturnOutput > 0.
    const ReturnOutput = rows.length > 0 ? 1 : -1;
    const Message = toStr(outOf(rows, 'strresult')); // DBNull.ToString() => ""
    const CurrentDealID = toStr(outOf(rows, 'currdealid')); // eslint-disable-line no-unused-vars
    ViewBag.Message = Message;
    ps.tempDataSet(req, 'ID', null);
    if (toInt32(ReturnOutput) > 0 && DealID === 0 && Mode === 1) {
      try {
        // legacy concatenated plid into the SQL ("where plid = '" + Plid + "'"); bound parameter here
        const Obj = await db.queryOne(DB, "select coalesce(phone, '') as phone, emailid, username from portal_login where plid = @Plid limit 1", { Plid });
        if (Obj !== null && (Obj.emailid !== '' && Obj.emailid !== null)) {
          await SendConfirmationEmail(Obj.emailid, 'Thank you for creating Deal with us. Your request is sent to Admin for verification.', ViewBag);
        }
      } catch (Exp) {
        ViewBag.Message = Exp.message;
      }
    }
  } catch (Exp) {
    ViewBag.Message = Exp.message;
    return view(res, VIEW, undefined, ViewBag);
  }
  // Response.Redirect("/merchant/alldeals") ends the request
  return res.json({ redirect: '/merchant/alldeals' });
}));

/** protected void SendConfirmationEmail(string ToEmail, string Text) */
async function SendConfirmationEmail(ToEmail, Text, ViewBag) {
  let send = 0;
  try {
    const subject = '' + toStr(CompanySettings.CompanyName) + '  Support Center';
    let mailtxt = '';
    const d = new Date();
    const z = (n) => String(n).padStart(2, '0');
    const Date_ = `${z(d.getDate())}-${z(d.getMonth() + 1)}-${d.getFullYear()}`;
    if (send === 0) {
      // new MailMessage(CompanySettings.NoReplyMail, ToEmail) threw for an empty/invalid address (caught below => no mail)
      if (!MAIL_RE.test(toStr(CompanySettings.NoReplyMail).trim()) || !MAIL_RE.test(toStr(ToEmail).trim())) {
        throw new Error('The specified string is not in the form required for an e-mail address.');
      }
      mailtxt = `<div>
<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>
<tbody><tr><td>
<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>
<img src='https://$$CompanyURL$$/images/anav-exchange-logo.png' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>
<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'>$$datetime$$</td>
</tr></tbody></table></td>
</tr><tr><td>
<div>
<div class='clear'></div>

<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>
<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px15px; color: #000'>
Dear $$lblname$$,</h1>
<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>
This Email is the confirmation for your posting of deal on our website. </strong>
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
If you have any issues regarding this mail, you can write us on <a style='color:red'>$$CompanySupportEmailId$$</a></p>
<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'></strong>
<div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px'>
<center>
<img src='http://webmail.jewria.com/imp/themes/default/graphics/spacer_red.png' htmlimgblocked='https://$$CompanyURL$$/images/divider.png'></center>
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
<td style='width: 240px; text-align: right'>
<div style='margin-right: 7px'>
<font style='margin-right:0px; font-size: 16px; color:#000; font-family:  Arial, Helvetica, sans-serif; float: left; margin-top:2px; font-weight: normal; padding-top:3px'>Follow us on </font>
<a href='https://www.facebook.com/ATCShoppingServices/' style='color:#3b5998; border: none; text-decoration: none' target='8SE_b89lng5GVbx5a7NZME9'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-facebook'></i></a>
<a href='https://twitter.com/ATCShoppingServices' style='color:#55acee; border: none; text-decoration: none' target='e3PP7S0O2rDcb5kT5Qxvkl9'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-twitter'></i></a>
<a href='https://plus.google.com/+ATCShoppingIn' style='color:#dd4b39; border: none; text-decoration: none' target='k_lu77WHdSxxe84MTtrgPlD'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-google-plus'></i></a>
<a href='https://www.linkedin.com/company/ATCShopping' style='color: #0072a4;' border: none; text-decoration: none' target='1QtmtsX-zlkY3NH-RX8bXJB'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-linkedin'></i></a>
<a href='https://pinterest.com/ATCShoppingServices/' style='color:#cb2027; border: none; text-decoration: none' target='FTivBEnhJ2wIlo_i9yYL1Xk'>
<i style='margin:4px 0 0 0; font-size:20px;' class='fa fa-pinterest-p'></i></a>
</div>
</td>
</tr></tbody></table></td>
</tr></tbody></table><div class='clear'></div>
</div>
</td>
</tr></tbody></table>
    </div>`;
      const rep = (s, k, v) => s.split(k).join(toStr(v));
      mailtxt = rep(mailtxt, '$$lblname$$', 'Member');
      mailtxt = rep(mailtxt, '$$datetime$$', Date_);
      mailtxt = rep(mailtxt, '$$lblmessage$$', Text);
      mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
      mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
      mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
      mailtxt = rep(mailtxt, '$$CompanySupportEmailId$$', CompanySettings.CompanySupportEmailId);
      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
      if (result === 's') send = 1;
      else return;
    }
  } catch (Exp) {
    ViewBag.Message = Exp.message;
  }
}

module.exports = router;
