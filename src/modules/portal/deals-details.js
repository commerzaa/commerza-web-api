'use strict';
// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\DealsDetailsController.cs (class DealsDetailsController => /portal/DealsDetails/...)
// Database: shopping (Db_Shopping). [CheckResellerTimeout] = no check. RouteConfig "deals/{title}" is commented out.
// DealsTemp / DealsDetails / HotDealsDetails / DealsInYourCity / DealsSeo are property bags.
// SendMailEnquiry starts BusinessDetailsController.Send(...) on a thread: ported inline as BusinessDetailsSend() (fire-and-forget),
// because a controller module cannot be required as a library.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const GetCountry = require('../../lib/portal/GetCountry');
const SendMail = require('../../lib/portal/SendMail');
const CompanySettingsMod = require('../../lib/portal/CompanySettings');
const { DB, NRE, pageUrl, col, isNull, csInt32 } = require('./_shared/batch-09-common');

const CompanySettings = CompanySettingsMod.CompanySettings || CompanySettingsMod;
const router = express.Router();

const DEALS_DETAILS_PROPS = ['IMAGES', 'FROMTIME', 'TOTIME', 'CREATEDATE', 'DEALID', 'HIGHLIGHTS', 'TERMS', 'DISCOUNT', 'PMID', 'ACTUALURL', 'TITLE',
  'REVIEW', 'REVIEWCOUNT', 'REWARD', 'STARTPRICE', 'MOBILENO', 'ADDRESS', 'CITYSTATENAME', 'CITYNAME', 'COUNTRYNAME', 'COMEMAILID', 'DESCRIPTION',
  'CID', 'AREANAME', 'CTID'];
const DEALS_SEO_PROPS = ['TITLE', 'DESCRIPTION', 'AREANAME', 'CITYNAME', 'COUNTRYNAME', 'STATENAME', 'CATNAME'];
const PORTAL_RESULT_PROPS = ['COMPANYNAME', 'MOBILENO', 'ADDRESS', 'COMEMAILID'];

/** CultureInfo.CurrentCulture.TextInfo.ToTitleCase (all-uppercase words are kept, others become Xxxx). */
function toTitleCase(s) {
  if (isNull(s)) throw new Error('Value cannot be null.\r\nParameter name: str');
  return String(s).replace(/[A-Za-z\u00C0-\u024F]+/g, (w) => (w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()));
}

/** Convert.ToInt64(object) / Convert.ToInt32(object) for TempData values (null => 0). */
const toLong = (v) => (isNull(v) ? 0 : csInt32(v));

/** DateTime.Now.ToString("dd MMM yyyy") + "  At  " + ToString("hh:mm tt") */
function enquiryDate() {
  const t = new Date();
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p2 = (n) => String(n).padStart(2, '0');
  const h = t.getHours() % 12 === 0 ? 12 : t.getHours() % 12;
  return `${p2(t.getDate())} ${M[t.getMonth()]} ${t.getFullYear()}  At  ${p2(h)}:${p2(t.getMinutes())} ${t.getHours() < 12 ? 'AM' : 'PM'}`;
}

const rep = (s, a, b) => s.split(a).join(isNull(b) ? '' : String(b));

/* eslint-disable */
const BODY_TEMPLATE = "<div>\r\n<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\r\n<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>\r\n<tbody><tr><td>\r\n<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>\r\n<img src='https://$$CompanyURL$$/images/anav-exchange-logo.png' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>\r\n<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'></td>\r\n</tr></tbody></table></td>\r\n</tr><tr><td>\r\n<div>\r\n<div class='clear'></div>\r\n\r\n<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>\r\n<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px15px; color: #000'>\r\nDear Customer, </h1>\r\n<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>\r\nBelow mentioned are the detail of received enquiry </strong>\r\n<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>\r\n<table cellpadding='0' cellspacing='0' width='98%' style='font-size:14px;  font-family:Arial; color:#454545;  border:1px solid #eaeaea; background:#f0ffff;  '>\r\n        <tr>\r\n    <td colspan='3' style='height:10px; line-height:10px;'></td>\r\n    </tr>\r\n\r\n    <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'><span style='float:right;'>Date </span></td>\r\n        <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'><span style='color:#026e85 !important;'>$$lbldate$$</span> </td>\r\n\r\n    </tr>\r\n\r\n     <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'> Name</td>\r\n         <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'> <span style='color:#026e85 !important;'>$$lblname$$</span> </td>\r\n\r\n    </tr>\r\n     <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'>Contact No</td>\r\n         <td style='width:25px; text-align:center;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'> <span style='color:#026e85 !important;'>$$lblphone$$</span> </td>\r\n\r\n    </tr>\r\n\r\n     <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'>Email Id </td>\r\n         <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'> <span style='color:#026e85 !important;'>$$lblemail$$</span> </td>\r\n\r\n    </tr>\r\n\r\n     <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px; vertical-align:top'>Message</td>\r\n         <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'> <span style='color: #026e85 !important; padding-left:5px;   width: 381px;'>$$lblmessage$$</span> </td>\r\n\r\n    </tr>\r\n    <tr>\r\n    <td colspan='3' style='height:15px; line-height:15px;'></td>\r\n    </tr>\r\n\r\n</table>\r\n</p>\r\n<div style='clear: both'></div>\r\n<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>\r\nIf you have any issues regarding this mail, you can write us on <a style='color:red'>$$CompanySupportEmailId$$</a></p>\r\n<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'></strong>\r\n<div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px'>\r\n<center>\r\n<img src='http://webmail.clusteroffer.com/imp/themes/default/graphics/spacer_red.png' htmlimgblocked='https://$$CompanyURL$$/images/divider.png'></center>\r\n</div>\r\n\r\n<div style='clear: both'></div>\r\n\r\n<div style='clear: both'></div>\r\n</td>\r\n</tr><tr><td>\r\n<table width='554'><tbody><tr><td>\r\n<p style='font-size: 16px; line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>\r\nSincerely,\r\n<br>\r\n$$CompanyName$$ Team\r\n</p>\r\n</td>\r\n<td style='width: 240px; text-align: right'>\r\n<div style='margin-right: 7px'>\r\n<font style='margin-right:0px; font-size: 16px; color:#000; font-family:  Arial, Helvetica, sans-serif; float: left; margin-top:2px; font-weight: normal; padding-top:3px'>Follow us on </font>\r\n<a href='https://www.facebook.com/ATCShoppingServices/' style='color:#3b5998; border: none; text-decoration: none' target='8SE_b89lng5GVbx5a7NZME9'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-facebook'></i></a>\r\n<a href='https://twitter.com/ATCShoppingServices' style='color:#55acee; border: none; text-decoration: none' target='e3PP7S0O2rDcb5kT5Qxvkl9'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-twitter'></i></a>\r\n<a href='https://plus.google.com/+ATCShoppingServices' style='color:#dd4b39; border: none; text-decoration: none' target='k_lu77WHdSxxe84MTtrgPlD'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-google-plus'></i></a>\r\n<a href=https://www.linkedin.com/company/ATCShoppingServices' style='color: #0072a4;' border: none; text-decoration: none' target='1QtmtsX-zlkY3NH-RX8bXJB'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-linkedin'></i></a>\r\n<a href='https://pinterest.com/ATCShoppingServices/' style='color:#cb2027; border: none; text-decoration: none' target='FTivBEnhJ2wIlo_i9yYL1Xk'>\r\n<i style='margin:4px 0 0 0; font-size:20px;' class='fa fa-pinterest-p'></i></a>\r\n</div>\r\n</td>\r\n</tr></tbody></table></td>\r\n</tr></tbody></table><div class='clear'></div>\r\n</div>\r\n</td>\r\n</tr></tbody></table>\r\n    </div>";
const BODY1_TEMPLATE = "<div>\r\n<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\r\n<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>\r\n<tbody><tr><td>\r\n<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>\r\n<img src='https://$$CompanyURL$$/images/anav-exchange-logo.png' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>\r\n<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'></td>\r\n</tr></tbody></table></td>\r\n</tr><tr><td>\r\n<div>\r\n<div class='clear'></div>\r\n\r\n<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>\r\n<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px15px; color: #000'>\r\nDear Customer, </h1>\r\n<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>\r\nBelow mentioned are the detail of received enquiry </strong>\r\n<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>\r\n<table cellpadding='0' cellspacing='0' width='98%' style='font-size:14px;  font-family:Arial; color:#454545;  border:1px solid #eaeaea; background:#f0ffff;  '>\r\n        <tr>\r\n    <td colspan='3' style='height:10px; line-height:10px;'></td>\r\n    </tr>\r\n\r\n    <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'><span style='float:right;'>Date </span></td>\r\n        <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'><span style='color:#026e85 !important;'>$$lbldate$$</span> </td>\r\n\r\n    </tr>\r\n\r\n     <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'> Name</td>\r\n         <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'> <span style='color:#026e85 !important;'>$$lblname$$</span> </td>\r\n\r\n    </tr>\r\n     <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'>Contact No</td>\r\n         <td style='width:25px; text-align:center;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'> <span style='color:#026e85 !important;'>$$lblphone$$</span> </td>\r\n\r\n    </tr>\r\n\r\n     <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'>Email Id </td>\r\n         <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'> <span style='color:#026e85 !important;'>$$lblemail$$</span> </td>\r\n\r\n    </tr>\r\n      <tr>\r\n        <td style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'>Address </td>\r\n         <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'> <span style='color:#026e85 !important;'> <span style='color:#026e85 !important;'>$$lbladdress$$</span> </td>\r\n\r\n    </tr>\r\n     <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px; vertical-align:top'>Message</td>\r\n         <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'> <span style='color: #026e85 !important; padding-left:5px;   width: 381px;'>$$lblmessage$$</span> </td>\r\n\r\n    </tr>\r\n    <tr>\r\n    <td colspan='3' style='height:15px; line-height:15px;'></td>\r\n    </tr>\r\n\r\n</table>\r\n</p>\r\n<div style='clear: both'></div>\r\n<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>\r\nIf you have any issues regarding this mail, you can write us on <a style='color:red'>support@$$lblwebsite$$</a></p>\r\n<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'></strong>\r\n<div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px'>\r\n<center>\r\n<img src='' htmlimgblocked='https://$$CompanyURL$$/images/divider.png'></center>\r\n</div>\r\n\r\n<div style='clear: both'></div>\r\n\r\n<div style='clear: both'></div>\r\n</td>\r\n</tr><tr><td>\r\n<table width='554'><tbody><tr><td>\r\n<p style='font-size: 16px; line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>\r\nSincerely,\r\n<br>\r\nAnav Exchange Team\r\n</p>\r\n</td>\r\n<td style='width: 240px; text-align: right'>\r\n<div style='margin-right: 7px'>\r\n<font style='margin-right:0px; font-size: 16px; color:#000; font-family:  Arial, Helvetica, sans-serif; float: left; margin-top:2px; font-weight: normal; padding-top:3px'>Follow us on </font>\r\n<a href='https://www.facebook.com/ATCShoppingServices/' style='color:#3b5998; border: none; text-decoration: none' target='8SE_b89lng5GVbx5a7NZME9'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-facebook'></i></a>\r\n<a href='https://twitter.com/ATCShoppingServices' style='color:#55acee; border: none; text-decoration: none' target='e3PP7S0O2rDcb5kT5Qxvkl9'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-twitter'></i></a>\r\n<a href='https://plus.google.com/+ATCShoppingServices' style='color:#dd4b39; border: none; text-decoration: none' target='k_lu77WHdSxxe84MTtrgPlD'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-google-plus'></i></a>\r\n<a href='https://www.linkedin.com/company/ATCShoppingServices' style='color: #0072a4;' border: none; text-decoration: none' target='1QtmtsX-zlkY3NH-RX8bXJB'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-linkedin'></i></a>\r\n<a href='https://pinterest.com/ATCShoppingServices/' style='color:#cb2027; border: none; text-decoration: none' target='FTivBEnhJ2wIlo_i9yYL1Xk'>\r\n<i style='margin:4px 0 0 0; font-size:20px;' class='fa fa-pinterest-p'></i></a>\r\n</div>\r\n</td>\r\n</tr></tbody></table></td>\r\n</tr></tbody></table><div class='clear'></div>\r\n</div>\r\n</td>\r\n</tr></tbody></table>\r\n    </div>";
/* eslint-enable */

/** BusinessDetailsController.Send(Int64 plid, string Name, string mail, string mob, string susmsg, int portalpmid1) */
async function BusinessDetailsSend(plid, Name, mail, mob, susmsg, portalpmid1) {
  const format = enquiryDate();
  // eslint-disable-next-line no-unused-vars
  const Name1 = toTitleCase(Name);
  const website = CompanySettings.CompanyURL;
  try {
    let body = BODY_TEMPLATE;
    const Result = mapRow(await db.queryOne(DB,
      "SELECT pm.companyname, pm.mobileno, (pm.address || ' ' || pm.areaname) AS address, pm.comemailid FROM portal_master pm WHERE pm.pmid = @pmid LIMIT 1",
      { pmid: portalpmid1 }), PORTAL_RESULT_PROPS);
    if (Result) {
      const email = Result.COMEMAILID;
      body = rep(body, '$$lbldate$$', format);
      body = rep(body, '$$lblname$$', Name);
      body = rep(body, '$$lblphone$$', mob);
      body = rep(body, '$$lblemail$$', mail);
      body = rep(body, '$$lblmessage$$', susmsg);
      body = rep(body, '$$lblwebsite$$', website);
      body = rep(body, '$$CompanyURL$$', CompanySettings.CompanyURL);
      body = rep(body, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
      body = rep(body, '$$CompanyName$$', CompanySettings.CompanyName);
      body = rep(body, '$$CompanySupportEmailId$$', CompanySettings.CompanySupportEmailId);
      const result = await SendMail.Send(plid, '', email, '', '', 'Anav Exchange', body);
      if (result !== 's') return;
      let body1 = BODY1_TEMPLATE;
      body1 = rep(body1, '$$lblwebsite$$', website);
      body1 = rep(body1, '$$lbldate$$', format);
      body1 = rep(body1, '$$lblname$$', Result.COMPANYNAME);
      body1 = rep(body1, '$$lblphone$$', Result.MOBILENO);
      body1 = rep(body1, '$$lblemail$$', Result.COMEMAILID);
      body1 = rep(body1, '$$lbladdress$$', Result.ADDRESS);
      body1 = rep(body1, '$$lblmessage$$', susmsg);
      body = rep(body, '$$CompanyURL$$', CompanySettings.CompanyURL); // legacy: replaces in body, not body1 ($$CompanyURL$$ stays in body1)
      const result1 = await SendMail.Send(plid, '', mail, '', '', 'Enquiry Details', body1);
      if (result1 !== 's') return;
    }
  } catch (Exp) {
    // ViewBag.Message = Exp.Message (no view)
  }
}

/** public int GetDealsInfo(...) : USP_PORTALDEALINBOX ... @INTRESULT OUT */
async function GetDealsInfo(Fromemailid, Fromname, Toemailid, Toname, Ccname, Ccemailid, Subject, Message, Ipaddress, Ipcountry, Ipstate, Ipcity, dealid, Mobile) {
  const row = await db.procOne(DB, 'usp_portaldealinbox', {
    fromemailid: Fromemailid, fromname: Fromname, toemailid: Toemailid, toname: Toname, ccemailid: Ccemailid, ccname: Ccname, message: Message,
    subject: Subject, ipaddress: Ipaddress, ipcountry: Ipcountry, ipstate: Ipstate, ipcity: Ipcity, dealid, mobile: Mobile,
  });
  const v = col(row, 'intresult');
  if (isNull(v)) throw NRE(); // StrResult.Value.ToString() on DBNull => "" => Convert.ToInt32 FormatException
  return csInt32(v);
}

// ---------------------------------------------------------------- Index(string title)
// public
router.all(['/portal/DealsDetails/Index{/:id}', '/portal/DealsDetails'], ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  let DealID = 0;
  const title = isNull(req.p.title) ? null : String(req.p.title);
  const ViewBag = {};
  if (title !== null) {
    const DealIDArray = title.split('-');
    if (DealIDArray.length > 0) {
      const i = DealIDArray.length;
      if (/^\d*$/.test(DealIDArray[i - 1])) {
        DealID = csInt32(DealIDArray[i - 1]); // "" => FormatException (legacy 500)
      }
      ps.tempDataSet(req, 'DealID', DealID);
      ps.tempDataSet(req, 'DealID1', DealID);
    }
  }
  if (ps.sessionGet(req, 'COUNTRYID') === null) {
    try {
      await GetCountry.SettingVisitor('1');
      await GetCountry.InitializeVisitorCountrySession(req);
    } catch (ex) {
      ViewBag.Message = ex.message;
    }
  } else {
    try {
      const Sessionid = ps.getSid(req);
      await GetCountry.SettingVisitor(Sessionid);
      await GetCountry.InitializeVisitorCountrySession(req);
    } catch (ex) {
      ViewBag.Message = ex.message;
    }
  }
  ps.sessionSet(req, 'reviewDEALID', DealID);
  ViewBag.DealID = DealID;
  const ObjPortal_Deal_Master = mapRow(await db.procOne(DB, 'usp_dealsmaster', { mode: '2', dealid: DealID }), DEALS_DETAILS_PROPS);
  ViewBag.Canonical = pageUrl(req);
  const ObjPortal_DealsSeo = mapRow(await db.procOne(DB, 'usp_dealsmaster', { mode: '3', dealid: DealID }), DEALS_SEO_PROPS);
  const s = (v) => (isNull(v) ? '' : v);
  if (ObjPortal_DealsSeo) {
    ViewBag.Title = s(ObjPortal_DealsSeo.TITLE) + ' Deals, Offers, Coupons and Discount in ' + s(ObjPortal_DealsSeo.AREANAME) + ',' + s(ObjPortal_DealsSeo.CITYNAME);
    ViewBag.MetaDesc = ObjPortal_DealsSeo.DESCRIPTION;
    ViewBag.MetaKeyword = s(ObjPortal_DealsSeo.TITLE) + ' Deals, Offers, Coupons and Discount in ' + s(ObjPortal_DealsSeo.AREANAME) + ','
      + s(ObjPortal_DealsSeo.TITLE) + ' in ' + s(ObjPortal_DealsSeo.CITYNAME) + ',' + s(ObjPortal_DealsSeo.TITLE);
    ViewBag.ShowAlternateUrl = 0;
  } else {
    ViewBag.Title = '';
    ViewBag.MetaDesc = '';
    ViewBag.MetaKeyword = '';
    ViewBag.ShowAlternateUrl = 0;
  }
  return res.json({
    view: '~/Views/DealsDetails/Index.cshtml', Model: ObjPortal_Deal_Master, ...ViewBag,
    TempData: { DealID: ps.tempDataPeek(req, 'DealID'), DealID1: ps.tempDataPeek(req, 'DealID1') },
  });
}));

// ---------------------------------------------------------------- SendMailEnquiry(string Name, string Mobile, string EmailId, string Message)
// public (anonymous enquiry form, no session check in legacy)
router.all('/portal/DealsDetails/SendMailEnquiry{/:id}', ps.portalSession, asyncHandler(async (req, res) => {
  const g = (k) => (req.p[k] === undefined ? null : req.p[k]);
  let Name = g('Name'); const Mobile = g('Mobile'); const EmailId = g('EmailId'); const Message = g('Message');
  let MessageOut = 0;
  let IPCONTRY = ''; let IPSTATE = ''; let IPCITY = ''; let IPADDRESS = '';
  const loc = ps.sessionGet(req, 'Propertysessionofcountrystatecity');
  if (loc !== null) {
    const t = (v) => { if (isNull(v)) throw NRE(); return String(v).trim(); };
    IPCONTRY = t(loc.CountryName); IPSTATE = t(loc.RegionName); IPCITY = t(loc.CityName); IPADDRESS = t(loc.IPAddress);
  }
  Name = toTitleCase(Name);
  const ObjDealsTemp = mapRow(await db.queryOne(DB,
    'SELECT pmid, plid, comemailid, companyname FROM portal_master WHERE pmid = (SELECT pmid FROM portal_deal_master WHERE dealid = @dealid LIMIT 1) LIMIT 1',
    { dealid: toLong(ps.tempDataPeek(req, 'DealID')) }), ['PMID', 'PLID', 'COMEMAILID', 'COMPANYNAME']); // TempData read + TempData.Keep()
  if (!ObjDealsTemp || isNull(ObjDealsTemp.COMEMAILID) || isNull(ObjDealsTemp.COMPANYNAME)) throw NRE();
  const Ret = await GetDealsInfo(String(CompanySettings.CompanyInfoEmailId ?? ''), String(CompanySettings.CompanyName ?? ''),
    String(ObjDealsTemp.COMEMAILID), String(ObjDealsTemp.COMPANYNAME), Name, EmailId, '', Message, IPADDRESS, IPCONTRY, IPSTATE, IPCITY,
    toLong(ps.tempDataPeek(req, 'DealID1')), Mobile);
  if (Ret === 1) {
    // new Thread(() => new BusinessDetailsController().Send(...)).Start()
    BusinessDetailsSend(ObjDealsTemp.PLID, Name, EmailId, Mobile, Message, csInt32(ObjDealsTemp.PMID))
      .catch((e) => console.error('[portal DealsDetails.SendMailEnquiry mail]', e && e.message));
    MessageOut = 1;
  }
  return res.json(MessageOut);
}));

// ---------------------------------------------------------------- GetDealsInfo(...)  (public int method => MVC action, ContentResult)
// public (same exposure as legacy; inserts an enquiry row like SendMailEnquiry)
router.all('/portal/DealsDetails/GetDealsInfo{/:id}', ps.portalSession, asyncHandler(async (req, res) => {
  const g = (k) => (req.p[k] === undefined ? null : req.p[k]);
  const r = await GetDealsInfo(g('Fromemailid'), g('Fromname'), g('Toemailid'), g('Toname'), g('Ccname'), g('Ccemailid'), g('Subject'), g('Message'),
    g('Ipaddress'), g('Ipcountry'), g('Ipstate'), g('Ipcity'), toLong(g('dealid')), g('Mobile'));
  res.type('text/html').send(String(r));
}));

module.exports = router;
