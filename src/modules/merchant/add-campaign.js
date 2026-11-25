'use strict';
const DB = 'shopping';
/**
 * Port of Merchant Panel Controllers/CustomerPanel/AddCampaign.cs (AddCampaignController)
 * Actions: Index, GetNoOfVisitorsDDL, ManageSaveAndPublishCampaign, SendEmail (4)
 */
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const config = require('../../config');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const SendMail = require('../../lib/merchant/SendMail');
const CS = require('../../lib/merchant/CompanySettings');
const CompanySettings = CS.CompanySettings || CS;

const rep = (s, k, v) => s.split(k).join(v === null || v === undefined ? '' : String(v));

async function SendEmail(Plid, Url, FromDate, ToDate) {
  try {
    const row = await db.procOne(DB, 'USP_GETEMAILIDQA', { PMID: Plid });
    const Obj = row ? { LOGINID: row.loginid, USERNAME: row.username } : null;
    let body = '';
    const subject = `${CompanySettings.CompanyName} Support Center`;
    const bcc = '';
    const cc = '';
    const to = Obj.LOGINID; // NullReference when no row (caught => "fail")
    const from = '';
    body = `<div>
<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>
<tbody><tr><td>
<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>
<img src='https://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>
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
If you have any issues regarding this mail, you can write us on <a style='color:red'>$$SupportEmailId$$</a></p>
<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'></strong>
<div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px'>
<center>
<img src='http://webmail.$$CompanyURL$$/imp/themes/default/graphics/spacer_red.png' htmlimgblocked='https://$$CompanyURL$$/images/divider.png'></center>
</div>

<div style='clear: both'></div>

<div style='clear: both'></div>
</td>
</tr><tr><td>
<table width='554'><tbody><tr><td>
<p style='font-size: 16px; line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>
Sincerely,
<br>
$$CompanyName$$Team
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
    body = rep(body, '$$lblname$$', Obj.USERNAME);
    body = rep(body, '$$lblUrl$$', Url);
    body = rep(body, '$$lblfromdate$$', FromDate);
    body = rep(body, '$$lblToDate$$', ToDate);
    body = rep(body, '$$lblmessage$$', '');
    body = rep(body, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    body = rep(body, '$$CompanyURL$$', CompanySettings.CompanyURL);
    body = rep(body, '$$SupportEmailId$$', CompanySettings.CompanySupportEmailId);
    body = rep(body, '$$CompanyName$$', CompanySettings.CompanyName);
    // background thread
    Promise.resolve().then(() => SendMail.Send1(from, to, cc, bcc, subject, body)).catch((e) => console.error(e.message));
  } catch (Exp) {
    return 'fail';
  }
  return 'success';
}

// auth
// route-config: merchant/add-campaign
router.all(['/merchant/AddCampaign/Index{/:id}', '/merchant/merchant/add-campaign{/:id}'], auth, asyncHandler(async (req, res) => {
  const id = req.p.id;
  if (id !== undefined && id !== null) {
    const Decrypt = parseInt(await UtilityClass.Decryptword(id), 10);
    sessionStore.set(req, 'TATBID', Decrypt); // TempData["TATBID"]
    const Row = await db.queryOne(DB, 'SELECT * FROM Tbl_AddTrafficBooster WHERE TATBID=@id LIMIT 1', { id: Decrypt });
    if (Row) return res.json({ Model: Row, TATBID: Decrypt });
    return res.json({ TATBID: Decrypt });
  }
  return res.json({});
}));

// auth
router.all('/merchant/AddCampaign/GetNoOfVisitorsDDL{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await db.query(DB, `SELECT TVHMID,
            (CAST(STARTFROM AS VARCHAR)||'-'||CAST(UPTO AS VARCHAR)) AS NOOFVISITORS FROM TBL_VISITORSHITSMASTER
            Where IsActive=true AND Status=1`);
  res.json(mapRows(rows, ['TVHMID', 'NOOFVISITORS']));
}));

// auth
router.all('/merchant/AddCampaign/ManageSaveAndPublishCampaign{/:id}', auth, asyncHandler(async (req, res) => {
  const { Url, UrlType, TVHMID, FromDate, ToDate, IsPublished, IsSaved, IsUpdate, CampaignType, ShareSource, ImageLogoByteCode, TargatedCity, NoOfClicks, Title, Description } = req.p;
  let Mode = req.p.Mode;
  const RandomNumber = Math.floor(Math.random() * 100000);
  const SavePaths = String(config.app.CampaignImagePath || 'CampaignImages');
  const Imgname = String(await UtilityClass.ImageUploadMasterMethod(ImageLogoByteCode, SavePaths, '', UtilityClass.ImageMode.Original, `Campaign_Master${RandomNumber}`) || '');
  const Plid = req.user.plid;
  let tatbid = 0;
  if (IsUpdate === '1') Mode = '3';
  const t = sessionStore.get(req, 'TATBID');
  if (t !== undefined && t !== null) {
    tatbid = parseInt(t, 10);
    sessionStore.set(req, 'TATBID', null); // TempData is consumed once read
  }
  const r = await db.procOne(DB, 'Usp_ManageTrafficBooster', {
    Mode, TATBID: tatbid, PLID: req.user.plid, UrlType, URL: Url, TVHMID, FromDate, ToDate, IsPublished, IsSaved, IsActive: '1', Status: '1',
    ShareSource, Imgname, TargatedCity, CampaignType, NoOfClicks, Title, Description,
  });
  // PORT-NOTE: C# tested ExecuteSqlCommand's affected-row count (>0); a returned result row is treated as success.
  if (r) {
    if (IsSaved === '1' && IsPublished === '1' && IsUpdate === '0') {
      await SendEmail(Plid, Url, FromDate, ToDate);
    }
  }
  const StrOutPut = r && r.intresultoutput !== undefined && r.intresultoutput !== null ? String(r.intresultoutput) : '0';
  res.json(StrOutPut);
}));

// auth
router.all('/merchant/AddCampaign/SendEmail{/:id}', auth, asyncHandler(async (req, res) => {
  const { Plid, Url, FromDate, ToDate } = req.p;
  res.type('text/plain').send(await SendEmail(Number(Plid), Url, FromDate, ToDate));
}));

module.exports = router;
