'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\AddCampaign.cs (class AddCampaignController => /portal/AddCampaign/...)
// Database: shopping (Db_Shopping). Fork of the Merchant Panel AddCampaign.cs (compared line by line; portal differences applied).
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const SendMail = require('../../lib/portal/SendMail');
const CompanySettings = require('../../lib/portal/CompanySettings');
const Tbl_AddTrafficBooster = require('../../lib/portal/Tbl_AddTrafficBooster');
const ps = require('./_shared/portal-session');
const {
  DB, view, outv, s, rep, toInt32, bindDouble, fire,
} = require('./_shared/batch-02-common');

const router = express.Router();
const C = '/portal/AddCampaign';

/** class VisitorsDDL */
const VISITORS_DDL = ['TVHMID', 'NOOFVISITORS'];

const MAIL_TEMPLATE = `<div>
<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>
<tbody><tr><td>
<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>
<img src='https://$$CompanyDomain$$/images/anav-exchange-logo.png' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>
<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'></td>
</tr></tbody></table></td>
</tr><tr><td>
<div>
<div class='clear'></div>

<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>
<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px15px; color: #000'>
Dear $$lblname$$,</h1>
<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>
Below mentioned are the details of your Created Campaign. </strong>
<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>
<table cellpadding='0' cellspacing='0' width='98%' style='font-size:14px;  font-family:Arial; color:#454545;  border:1px solid #eaeaea; background:#f0ffff;  '>
    <tr>
        <td colspan='3' style='height:10px; line-height:10px;'></td>
    </tr>

    <tr>
        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'>Campaign Url</td>
            <td style='width:25px; text-align:center;'>: </td>
        <td align='left' style='line-height:25px; height:25px;'> <span style='color:#026e85 !important;'><a href='$$lblUrl$$' target=_blank>$$lblUrl$$</a></span> </td>
    </tr>

    <tr>
        <td  style='text-align:right; width:120px; margin:0px; padding:0px; line-height:25px; height:25px;'><span style='float:right;'>From Date </span></td>
        <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>
        <td align='left' style='line-height:25px; height:25px;'><span style='color:#026e85 !important;'>$$lblfromdate$$</span> </td>
    </tr>

    <tr>
        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'>To Date</td>
            <td style='width:25px; text-align:center;'>: </td>
        <td align='left' style='line-height:25px; height:25px;'> <span style='color:#026e85 !important;'>$$lblToDate$$</span> </td>
    </tr>

    <tr>
        <td colspan='3' style='height:15px; line-height:15px;'></td>
    </tr>

</table>
</p>
<div style='clear: both'></div>
<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'> 
$$lblmessage$$
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

/** public string SendEmail(double Plid, string Url, string FromDate, string ToDate) (also an MVC action, see below) */
async function SendEmail(Plid, Url, FromDate, ToDate) {
  try {
    const row = await db.procOne(DB, 'USP_GETEMAILIDQA', { PMID: Plid });
    const Obj = row ? { LOGINID: row.loginid, USERNAME: row.username } : null; // FirstOrDefault()
    let body = '';
    const subject = '' + s(CompanySettings.CompanyName) + ' Support Center';
    const bcc = '';
    const cc = '';
    if (Obj === null) throw new TypeError('Object reference not set to an instance of an object.');
    const to = Obj.LOGINID;
    const from = '';
    body = MAIL_TEMPLATE;
    body = rep(body, '$$lblname$$', Obj.USERNAME);
    body = rep(body, '$$lblUrl$$', Url);
    body = rep(body, '$$lblfromdate$$', FromDate);
    body = rep(body, '$$lblToDate$$', ToDate);
    body = rep(body, '$$lblmessage$$', '');
    body = rep(body, '$$CompanyName$$', CompanySettings.CompanyName);
    body = rep(body, '$$CompanyURL$$', CompanySettings.CompanyURL);
    body = rep(body, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    body = rep(body, '$$CompanySupportEmailId$$', CompanySettings.CompanySupportEmailId);
    // System.Threading.Thread emailThread = new Thread(delegate { SendMail.Send1(...) }); emailThread.Start();
    fire(() => SendMail.Send1(from, to, cc, bcc, subject, body));
  } catch (Exp) {
    // ViewBag.Message = Exp.Message
    return 'fail';
  }
  return 'success';
}

// ---------------------------------------------------------------- Index(string id)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "merchant/add-campaign" -> AddCampaign/Index
router.all([`${C}/Index{/:id}`, C, '/portal/merchant/add-campaign'], ps.customerAuth, asyncHandler(async (req, res) => {
  const id = req.p.id;
  if (id !== undefined && id !== null) {
    const Decrypt = toInt32(await UtilityClass.Decryptword(String(id)));
    ps.tempDataSet(req, 'TATBID', Decrypt);
    const r = await db.queryOne(DB, 'select * from tbl_addtrafficbooster where tatbid = @Decrypt limit 1', { Decrypt });
    const Row = mapRow(r, Tbl_AddTrafficBooster.PROPS);
    if (Row !== null) {
      return view(res, '~/Views/CustomerPanel/AddCampaign/Index.cshtml', Row, { TATBID: Decrypt });
    }
    return view(res, '~/Views/CustomerPanel/AddCampaign/Index.cshtml', undefined, { TATBID: Decrypt });
  }
  return view(res, '~/Views/CustomerPanel/AddCampaign/Index.cshtml');
}));

// ---------------------------------------------------------------- GetNoOfVisitorsDDL()
// public (no session use in legacy)
router.all(`${C}/GetNoOfVisitorsDDL{/:id}`, asyncHandler(async (req, res) => {
  const rows = await db.query(DB, `SELECT TVHMID,
            (CAST(STARTFROM AS VARCHAR) || '-' || CAST(UPTO AS VARCHAR)) AS NOOFVISITORS FROM TBL_VISITORSHITSMASTER
            Where IsActive = 1 AND Status = 1`);
  return res.json(mapRows(rows, VISITORS_DDL));
}));

// ---------------------------------------------------------------- ManageSaveAndPublishCampaign(Url, Mode, UrlType, TVHMID, FromDate, ToDate, IsPublished, IsSaved, IsUpdate,
//                                                                   CampaignType, ShareSource, ImageLogoByteCode, TargatedCity, NoOfClicks, Title, Description)
// auth (PORT-NOTE: legacy saved the uploaded image BEFORE checking the session and then did Response.Redirect("user/add-campaign");
// here an anonymous request is rejected before any file is written)
router.all(`${C}/ManageSaveAndPublishCampaign{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  let Mode = p.Mode;
  const RandomNumber = Math.floor(Math.random() * 100000); // random.Next(0, 100000)
  const SavePaths = config.app.CampaignImagePath;
  const Imgname = s(await UtilityClass.ImageUploadMasterMethod(p.ImageLogoByteCode, SavePaths, '', UtilityClass.ImageMode.Original,
    'Campaign_Master' + RandomNumber));
  const Plid = Number(req.user.plid);
  let tatbid = 0;
  if (p.IsUpdate === '1') Mode = '3';
  if (ps.tempDataGet(req, 'TATBID') !== null) {
    tatbid = toInt32(ps.tempDataGet(req, 'TATBID'));
  }
  let StrOutPut = '0';
  const rows = await db.proc(DB, 'Usp_ManageTrafficBooster', {
    Mode, TATBID: tatbid, PLID: req.user.plid, UrlType: p.UrlType, URL: p.Url, TVHMID: p.TVHMID, FromDate: p.FromDate, ToDate: p.ToDate,
    IsPublished: p.IsPublished, IsSaved: p.IsSaved, IsActive: '1', Status: '1', ShareSource: p.ShareSource, Imgname,
    TargatedCity: p.TargatedCity, CampaignType: p.CampaignType, NoOfClicks: p.NoOfClicks, Title: p.Title, Description: p.Description,
  });
  // PORT-NOTE: ExecuteSqlCommand returned the affected-row count (result > 0); the PostgreSQL function returns a result row instead,
  // which is treated as "rows affected".
  const result = rows.length;
  if (result > 0) {
    if (p.IsSaved === '1' && p.IsPublished === '1' && p.IsUpdate === '0') {
      await SendEmail(Plid, p.Url, p.FromDate, p.ToDate);
    }
  }
  StrOutPut = s(outv(rows, 'IntResultOutPut')); // Param[12].Value.ToString()
  return res.json(StrOutPut);
}));

// ---------------------------------------------------------------- SendEmail(double Plid, string Url, string FromDate, string ToDate)
// auth (PORT-NOTE: public helper => reachable MVC action in legacy without a session check (mails any PMID); protected here)
router.all(`${C}/SendEmail{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const Plid = bindDouble(req.p.Plid, 'Plid');
  const out = await SendEmail(Plid, req.p.Url, req.p.FromDate, req.p.ToDate);
  return res.type('text/html').send(out); // string action => ContentResult
}));

module.exports = router;
