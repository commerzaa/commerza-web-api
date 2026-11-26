// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\BusinessDetailsController.cs
'use strict';
// class BusinessDetailsController => /portal/BusinessDetails/<Action>{/:id}. Database: shopping (Db_Shopping). [CheckResellerTimeout] = no check.
// RouteConfig "BusinessDetails": url "{title}" => BusinessDetails/Index, registered as /portal/:title (route-config).
// Public non-ActionResult methods are MVC actions too: findDayOfWeek / Send (void => EmptyResult), getFranchise (=> ContentResult of
// Franchisedata.ToString(), i.e. "Franchisedata"). Static (Limit, RemoveSpecialCharacters) and private (fillemail, fill, fillmobile,
// IsNumeric) members are not actions: ported as internal functions.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const SendMail = require('../../lib/portal/SendMail');
const BusinessDetail = require('../../lib/portal/BusinessDetail');
const Common = require('../../lib/portal/common');
const Portal_Master = require('../../lib/portal/Portal_Master');
const CompanySettingsMod = require('../../lib/portal/CompanySettings');
const { fire, need } = require('./_shared/batch-02-common');
const {
  DB, NRE, s, strParam, bindInt, bindLong, toInt32, view, emptyResult, toTitleCase, enquiryDate, otherRouteHandles, legacyAbsolutePath,
} = require('./_shared/batch-18-common');

const CompanySettings = CompanySettingsMod.CompanySettings || CompanySettingsMod;
const router = express.Router();
const C = '/portal/BusinessDetails';
const obj1 = new BusinessDetail();

const DETAILS_PAGE_SEO = ['CompanyName', 'AREANAME', 'CITYNAME', 'COUNTRYNAME', 'STATENAME', 'CATNAME'];
const PORTAL_RESULT = ['COMPANYNAME', 'MOBILENO', 'ADDRESS', 'COMEMAILID'];
const FRANCHISEDATA = ['phone', 'COMPANYNAME'];

// static fields of the controller class (shared by every request, like C# statics)
const statics = { strerror: null, str: null, phone: null, Dayid: 0 };

const cat = (v) => (v === undefined || v === null ? '' : String(v));
const g = (req, k) => strParam(req.p[k]);

// ---------------------------------------------------------------- non-action helpers (static / private in C#)
/** public static string Limit(object Desc, int len) */
function Limit(Desc, len) { // eslint-disable-line no-unused-vars
  const str = need(Desc);
  return str.length > len ? str.substring(0, len) + '<br/>' : str;
}
/** private string fillemail(string textemail) */
function fillemail(textemail) { statics.str = need(textemail).split(',')[0]; return statics.str; } // eslint-disable-line no-unused-vars
/** private string fill(string textemail) */
function fill(textemail) { statics.str = need(textemail).split('|')[0]; return statics.str; } // eslint-disable-line no-unused-vars
/** private string fillmobile(string mobileno) */
function fillmobile(mobileno) { statics.phone = need(mobileno).split('|')[0]; return statics.phone; } // eslint-disable-line no-unused-vars
/** public static string RemoveSpecialCharacters(string str) */
function RemoveSpecialCharacters(str) { return [...need(str)].filter((c) => /[0-9A-Za-z._]/.test(c)).join(''); } // eslint-disable-line no-unused-vars
/** private bool IsNumeric(string sText) */
function IsNumeric(sText) { return [...need(sText)].every((c) => '0123456789'.includes(c)); } // eslint-disable-line no-unused-vars

/** public void findDayOfWeek() */
function findDayOfWeek() {
  const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
  const map = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };
  statics.Dayid = map[day];
}

/** public Franchisedata getFranchise(string did) */
async function getFranchise(did) {
  // legacy concatenated td.did='" + did + "' (parameterised here)
  const row = await db.queryOne(DB,
    'select dm.companyname, td.phone from tbl_distributor td left join distributor_master dm on td.regno = dm.plid where td.did::text = @did limit 1',
    { did: cat(did) });
  return row ? mapRow(row, FRANCHISEDATA) : null;
}

/* eslint-disable */
const BODY_TEMPLATE = "<div>\r\n<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\r\n<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>\r\n<tbody><tr><td>\r\n<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>\r\n<img src='https://$$CompanyURL$$/images/anav-exchange-logo.png' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>\r\n<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'></td>\r\n</tr></tbody></table></td>\r\n</tr><tr><td>\r\n<div>\r\n<div class='clear'></div>\r\n\r\n<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>\r\n<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px15px; color: #000'>\r\nDear Customer, </h1>\r\n<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>\r\nBelow mentioned are the detail of received enquiry </strong>\r\n<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>\r\n<table cellpadding='0' cellspacing='0' width='98%' style='font-size:14px;  font-family:Arial; color:#454545;  border:1px solid #eaeaea; background:#f0ffff;  '>\r\n        <tr>\r\n    <td colspan='3' style='height:10px; line-height:10px;'></td>\r\n    </tr>\r\n\r\n    <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'><span style='float:right;'>Date </span></td>\r\n        <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'><span style='color:#026e85 !important;'>$$lbldate$$</span> </td>\r\n\r\n    </tr>\r\n\r\n     <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'> Name</td>\r\n         <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'> <span style='color:#026e85 !important;'>$$lblname$$</span> </td>\r\n\r\n    </tr>\r\n     <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'>Contact No</td>\r\n         <td style='width:25px; text-align:center;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'> <span style='color:#026e85 !important;'>$$lblphone$$</span> </td>\r\n\r\n    </tr>\r\n\r\n     <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'>Email Id </td>\r\n         <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'> <span style='color:#026e85 !important;'>$$lblemail$$</span> </td>\r\n\r\n    </tr>\r\n\r\n     <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px; vertical-align:top'>Message</td>\r\n         <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'> <span style='color: #026e85 !important; padding-left:5px;   width: 381px;'>$$lblmessage$$</span> </td>\r\n\r\n    </tr>\r\n    <tr>\r\n    <td colspan='3' style='height:15px; line-height:15px;'></td>\r\n    </tr>\r\n\r\n</table>\r\n</p>\r\n<div style='clear: both'></div>\r\n<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>\r\nIf you have any issues regarding this mail, you can write us on <a style='color:red'>$$CompanySupportEmailId$$</a></p>\r\n<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'></strong>\r\n<div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px'>\r\n<center>\r\n<img src='http://webmail.clusteroffer.com/imp/themes/default/graphics/spacer_red.png' htmlimgblocked='https://$$CompanyURL$$/images/divider.png'></center>\r\n</div>\r\n\r\n<div style='clear: both'></div>\r\n\r\n<div style='clear: both'></div>\r\n</td>\r\n</tr><tr><td>\r\n<table width='554'><tbody><tr><td>\r\n<p style='font-size: 16px; line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>\r\nSincerely,\r\n<br>\r\n$$CompanyName$$ Team\r\n</p>\r\n</td>\r\n<td style='width: 240px; text-align: right'>\r\n<div style='margin-right: 7px'>\r\n<font style='margin-right:0px; font-size: 16px; color:#000; font-family:  Arial, Helvetica, sans-serif; float: left; margin-top:2px; font-weight: normal; padding-top:3px'>Follow us on </font>\r\n<a href='https://www.facebook.com/ATCShoppingServices/' style='color:#3b5998; border: none; text-decoration: none' target='8SE_b89lng5GVbx5a7NZME9'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-facebook'></i></a>\r\n<a href='https://twitter.com/ATCShoppingServices' style='color:#55acee; border: none; text-decoration: none' target='e3PP7S0O2rDcb5kT5Qxvkl9'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-twitter'></i></a>\r\n<a href='https://plus.google.com/+ATCShoppingServices' style='color:#dd4b39; border: none; text-decoration: none' target='k_lu77WHdSxxe84MTtrgPlD'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-google-plus'></i></a>\r\n<a href=https://www.linkedin.com/company/ATCShoppingServices' style='color: #0072a4;' border: none; text-decoration: none' target='1QtmtsX-zlkY3NH-RX8bXJB'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-linkedin'></i></a>\r\n<a href='https://pinterest.com/ATCShoppingServices/' style='color:#cb2027; border: none; text-decoration: none' target='FTivBEnhJ2wIlo_i9yYL1Xk'>\r\n<i style='margin:4px 0 0 0; font-size:20px;' class='fa fa-pinterest-p'></i></a>\r\n</div>\r\n</td>\r\n</tr></tbody></table></td>\r\n</tr></tbody></table><div class='clear'></div>\r\n</div>\r\n</td>\r\n</tr></tbody></table>\r\n    </div>";
const BODY1_TEMPLATE = "<div>\r\n<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\r\n<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>\r\n<tbody><tr><td>\r\n<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>\r\n<img src='https://$$CompanyURL$$/images/anav-exchange-logo.png' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>\r\n<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'></td>\r\n</tr></tbody></table></td>\r\n</tr><tr><td>\r\n<div>\r\n<div class='clear'></div>\r\n\r\n<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>\r\n<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px15px; color: #000'>\r\nDear Customer, </h1>\r\n<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>\r\nBelow mentioned are the detail of received enquiry </strong>\r\n<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>\r\n<table cellpadding='0' cellspacing='0' width='98%' style='font-size:14px;  font-family:Arial; color:#454545;  border:1px solid #eaeaea; background:#f0ffff;  '>\r\n        <tr>\r\n    <td colspan='3' style='height:10px; line-height:10px;'></td>\r\n    </tr>\r\n\r\n    <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'><span style='float:right;'>Date </span></td>\r\n        <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'><span style='color:#026e85 !important;'>$$lbldate$$</span> </td>\r\n\r\n    </tr>\r\n\r\n     <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'> Name</td>\r\n         <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'> <span style='color:#026e85 !important;'>$$lblname$$</span> </td>\r\n\r\n    </tr>\r\n     <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'>Contact No</td>\r\n         <td style='width:25px; text-align:center;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'> <span style='color:#026e85 !important;'>$$lblphone$$</span> </td>\r\n\r\n    </tr>\r\n\r\n     <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'>Email Id </td>\r\n         <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'> <span style='color:#026e85 !important;'>$$lblemail$$</span> </td>\r\n\r\n    </tr>\r\n      <tr>\r\n        <td style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px;'>Address </td>\r\n         <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'> <span style='color:#026e85 !important;'> <span style='color:#026e85 !important;'>$$lbladdress$$</span> </td>\r\n\r\n    </tr>\r\n     <tr>\r\n        <td  style='text-align:right; width:85px; margin:0px; padding:0px; line-height:25px; height:25px; vertical-align:top'>Message</td>\r\n         <td style='width:25px; text-align:center; line-height:25px; height:25px;'>: </td>\r\n        <td align='left' style='line-height:25px; height:25px;'> <span style='color: #026e85 !important; padding-left:5px;   width: 381px;'>$$lblmessage$$</span> </td>\r\n\r\n    </tr>\r\n    <tr>\r\n    <td colspan='3' style='height:15px; line-height:15px;'></td>\r\n    </tr>\r\n\r\n</table>\r\n</p>\r\n<div style='clear: both'></div>\r\n<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>\r\nIf you have any issues regarding this mail, you can write us on <a style='color:red'>support@$$lblwebsite$$</a></p>\r\n<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'></strong>\r\n<div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px'>\r\n<center>\r\n<img src='' htmlimgblocked='https://$$CompanyURL$$/images/divider.png'></center>\r\n</div>\r\n\r\n<div style='clear: both'></div>\r\n\r\n<div style='clear: both'></div>\r\n</td>\r\n</tr><tr><td>\r\n<table width='554'><tbody><tr><td>\r\n<p style='font-size: 16px; line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>\r\nSincerely,\r\n<br>\r\nAnav Exchange Team\r\n</p>\r\n</td>\r\n<td style='width: 240px; text-align: right'>\r\n<div style='margin-right: 7px'>\r\n<font style='margin-right:0px; font-size: 16px; color:#000; font-family:  Arial, Helvetica, sans-serif; float: left; margin-top:2px; font-weight: normal; padding-top:3px'>Follow us on </font>\r\n<a href='https://www.facebook.com/ATCShoppingServices/' style='color:#3b5998; border: none; text-decoration: none' target='8SE_b89lng5GVbx5a7NZME9'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-facebook'></i></a>\r\n<a href='https://twitter.com/ATCShoppingServices' style='color:#55acee; border: none; text-decoration: none' target='e3PP7S0O2rDcb5kT5Qxvkl9'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-twitter'></i></a>\r\n<a href='https://plus.google.com/+ATCShoppingServices' style='color:#dd4b39; border: none; text-decoration: none' target='k_lu77WHdSxxe84MTtrgPlD'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-google-plus'></i></a>\r\n<a href='https://www.linkedin.com/company/ATCShoppingServices' style='color: #0072a4;' border: none; text-decoration: none' target='1QtmtsX-zlkY3NH-RX8bXJB'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-linkedin'></i></a>\r\n<a href='https://pinterest.com/ATCShoppingServices/' style='color:#cb2027; border: none; text-decoration: none' target='FTivBEnhJ2wIlo_i9yYL1Xk'>\r\n<i style='margin:4px 0 0 0; font-size:20px;' class='fa fa-pinterest-p'></i></a>\r\n</div>\r\n</td>\r\n</tr></tbody></table></td>\r\n</tr></tbody></table><div class='clear'></div>\r\n</div>\r\n</td>\r\n</tr></tbody></table>\r\n    </div>";
/* eslint-enable */

const rep = (str, k, v) => str.split(k).join(cat(v));

/** public void Send(Int64 plid, string Name, string mail, string mob, string susmsg, int portalpmid1) */
async function Send(plid, Name, mail, mob, susmsg, portalpmid1) {
  const format = enquiryDate();
  const website = CompanySettings.CompanyURL;
  try {
    const Name1 = toTitleCase(Name); // eslint-disable-line no-unused-vars
    let body = BODY_TEMPLATE;
    // legacy concatenated PM.PMID=" + portalpmid1 (parameterised here)
    const Result = mapRow(await db.queryOne(DB,
      "select pm.companyname, pm.mobileno, (pm.address || ' ' || pm.areaname) as address, pm.comemailid from portal_master pm where pm.pmid = @pmid limit 1",
      { pmid: portalpmid1 }), PORTAL_RESULT);
    if (Result !== null && Result !== undefined) {
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
      body = rep(body, '$$CompanyURL$$', CompanySettings.CompanyURL); // legacy: replaces in body, not body1
      const result1 = await SendMail.Send(plid, '', mail, '', '', 'Enquiry Details', body1);
      if (result1 !== 's') return;
    }
  } catch (Exp) {
    // ViewBag.Message = Exp.Message (no view)
  }
}

// ================================================================ Index(string title)
// public
async function indexHandler(req, res, fromRoute) {
  // route value {title} wins over the query string (MVC value-provider order)
  const title = fromRoute ? strParam(req.params.title) : g(req, 'title');
  const ViewBag = {};
  const viewOut = () => {
    // _OuterSearchLayout: when Session["COUNTRYID"] == null => GetCountry.SettingVisitor (no-op) + InitializeVisitorCountrySession
    if (ps.sessionGet(req, 'COUNTRYID') === null) ps.initializeVisitorCountrySession(req);
    return view(res, '~/Views/BusinessDetails/Index.cshtml', undefined, ViewBag);
  };
  if (need(title).includes('.')) return viewOut();
  if (title === 'deals') return res.json({ redirect: '/AllOuterDeals' }); // RedirectToAction("Index", "AllOuterDeals") (Default route url)
  let Pmid = 0;
  let Plid = 0;
  ViewBag.ShowAlternateUrl = 0;
  ViewBag.AbsolutePath = legacyAbsolutePath(req).replace(/^\/+|\/+$/g, '');
  if (title !== null && title !== '') {
    const t = title.split('-').join(' ').trim();
    // legacy concatenated TITLE='" + title + "' (parameterised here)
    const r1 = await db.queryOne(DB, 'select pmid from portal_master where active = true and title = @t limit 1', { t });
    Pmid = r1 && r1.pmid !== null ? Number(r1.pmid) : 0;
    if (Pmid === 0) return res.json({ redirect: '/page-not-found' }); // Response.Redirect ends the response
    const r2 = await db.queryOne(DB, 'select plid from portal_master where active = true and title = @t limit 1', { t });
    Plid = r2 && r2.plid !== null ? Number(r2.plid) : 0;
    if (Plid === 0) return res.json({ redirect: '/page-not-found' });
    ViewBag.Plid = Plid;
    ViewBag.pmid = Pmid;
    ps.sessionSet(req, 'reviewPMID', Pmid);
    ps.sessionSet(req, 'FavoriteURL', null);
    ViewBag.Canonical = `${req.protocol}://${req.get('host')}${req.originalUrl}`; // HttpContext.Request.Url.ToString()
    try {
      // legacy concatenated PMID=" + Pmid (parameterised here)
      const O = mapRow(await db.queryOne(DB, `select companyname, areaname, cityname, 'India' as countryname, statename, catname
          from portal_master pm inner join city ct on ct.ctid = pm.ctid inner join country co on co.cid = pm.cid
          inner join state s on s.sid = pm.sid
          left join product_category pc on pc.catid::text = left(pm.catid || ',', position(',' in pm.catid || ',') - 1)
          where pm.active = true and pmid = @Pmid limit 1`, { Pmid }), DETAILS_PAGE_SEO);
      if (O === null || O === undefined) throw NRE();
      ViewBag.Title = cat(O.CompanyName) + ' ' + cat(O.CATNAME) + ' in ' + cat(O.AREANAME) + ' ' + cat(O.CITYNAME) + ' Get Address, Review, Rating - Anav Exchange';
      ViewBag.MetaDesc = cat(O.CompanyName) + ' ' + cat(O.CATNAME) + ' in ' + cat(O.AREANAME) + ' ' + cat(O.CITYNAME)
        + ' Get Contact Deatils, Address, Review, Rating, Offers - Visit Anav Exchange For Business Directories';
      ViewBag.MetaKeyword = cat(O.CompanyName) + ', ' + cat(O.CATNAME) + ', ' + cat(O.CompanyName) + ' ' + cat(O.AREANAME) + ', '
        + cat(O.CompanyName) + ' ' + cat(O.AREANAME) + ' ' + cat(O.CITYNAME);
    } catch (Exp) {
      ViewBag.Message = Exp.message;
      ViewBag.Title = '';
      ViewBag.MetaDesc = '';
      ViewBag.MetaKeyword = '';
    }
  }
  return viewOut();
}

router.all(`${C}/Index{/:id}`, ps.CheckResellerTimeout, asyncHandler((req, res) => indexHandler(req, res, false)));

// ---------------------------------------------------------------- the other actions (registered before the catch-all)

// ================================================================ findDayOfWeek()  (public void)
// public
router.all(`${C}/findDayOfWeek{/:id}`, ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  findDayOfWeek();
  return emptyResult(res);
}));

// ================================================================ SENDMAILENQUIRY(txname, txmob, txemail, mailmsg, Place)
// public (session check commented out in legacy)
router.all(`${C}/SENDMAILENQUIRY{/:id}`, ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  const txname = g(req, 'txname'); const txmob = g(req, 'txmob'); const txemail = g(req, 'txemail'); const mailmsg = g(req, 'mailmsg');
  const Place = g(req, 'Place');
  let msg2 = 0;
  const portalpmid = 0; // private field never assigned in legacy
  let ipcontry = ''; let ipstate = ''; let ipcity = ''; let ipaddress = '';
  const pmid = toInt32(ps.sessionGet(req, 'reviewPMID'));
  const loc = ps.sessionGet(req, 'Propertysessionofcountrystatecity');
  if (loc !== null) {
    ipaddress = need(loc.IPAddress).trim();
    ipcontry = need(loc.CountryName).trim();
    ipstate = need(loc.RegionName).trim();
    ipcity = need(loc.CityName).trim();
  }
  const Name = toTitleCase(txname);
  const portalmaster = mapRow(await db.queryOne(DB, 'select * from portal_master where pmid = @pmid limit 1', { pmid }), Portal_Master.PROPS);
  if (!portalmaster || portalmaster.COMEMAILID === null || portalmaster.COMEMAILID === undefined
    || portalmaster.COMPANYNAME === null || portalmaster.COMPANYNAME === undefined) throw NRE();
  const ret = await obj1.GetPortalInfo('info@clusteroffer.com', 'Cluster Offer', String(portalmaster.COMEMAILID), String(portalmaster.COMPANYNAME),
    Name, txemail, '', mailmsg, ipaddress, ipcontry, ipstate, ipcity, pmid, txmob);
  if (ret === 1) {
    const plid = portalmaster.PLID;
    fire(() => Send(plid, txname, txemail, txmob, mailmsg, portalpmid)); // new Thread(...).Start()
    msg2 = 1;
  }
  // ********************** SMS Section *******************
  let merchatMobile = need(portalmaster.MOBILENO).split('+91-').join('').split('91-').join('');
  merchatMobile = merchatMobile.split('00').join('');
  const smscontent = await UtilityClass.FindingSmsContentWithUserIdPassword(portalmaster.COMPANYNAME, '', txmob, Place, 59);
  fire(() => UtilityClass.SendSMSWithAPI(merchatMobile, smscontent, 1074, '1'));
  // !string.IsNullOrEmpty(portalmaster.DistributorId.ToString())  (int? null => "")
  if (portalmaster.DistributorId !== null && portalmaster.DistributorId !== undefined && String(portalmaster.DistributorId) !== '') {
    const frndata = await getFranchise(String(portalmaster.DistributorId));
    if (frndata === null) throw NRE(); // frndata.COMPANYNAME on a null row
    let franchisename = frndata.COMPANYNAME;
    if (frndata.COMPANYNAME === null || frndata.COMPANYNAME === undefined || frndata.COMPANYNAME === '') franchisename = 'Franchise';
    const messg1 = await UtilityClass.FindingSmsContentWithUserIdPassword(franchisename, '', txmob, Place, 59);
    fire(() => UtilityClass.SendSMSWithAPI(frndata.phone, messg1, 1074, '1'));
  }
  return res.json(msg2);
}));

// ================================================================ getFranchise(string did)  (public Franchisedata => ContentResult)
// public. PORT-NOTE: MVC wrapped the returned object in ContentResult(obj.ToString()) = the CLR type name "Franchisedata" (empty when null).
router.all(`${C}/getFranchise{/:id}`, ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  const frndata = await getFranchise(g(req, 'did'));
  return res.type('text/html').send(frndata === null ? '' : 'Franchisedata');
}));

// ================================================================ bindProductImages(string pmid)
// public
router.all(`${C}/bindProductImages{/:id}`, ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  const details = await obj1.GetProductImage(toInt32(g(req, 'pmid')));
  if (!details || details.length === 0) throw new RangeError('Index was out of range. Must be non-negative and less than the size of the collection.\r\nParameter name: index');
  const strImageWithTitle = need(details[0].imageUrl).split(',');
  let Getimagecount = 0;
  for (const item of strImageWithTitle) {
    if (item.trim() !== '') {
      const str = item.split('!');
      Getimagecount += 1;
      if (str.length < 2) throw new RangeError('Index was outside the bounds of the array.');
      details.push({ rowNumber: Getimagecount, imageUrl: str[0], imageTitle: str[1] });
    }
  }
  return res.json(details);
}));

// ================================================================ SAVEFAVOURITE(int pmid)
// public (returns "3" without a session)
router.all(`${C}/SAVEFAVOURITE{/:id}`, ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  const pmid = bindInt(req.p.pmid, 'pmid');
  let resv = 0; let ret = 0; let plid = 0;
  try {
    const obj2 = new Common();
    if (ps.isCustomer(req)) {
      plid = toInt32(req.user.plid);
      ret = await obj2.SaveFavourite(pmid, plid, 0);
      if (ret > 0) resv = ret;
    } else {
      resv = 3; // login first
    }
  } catch (Exp) {
    resv = 0;
  }
  return res.json(String(resv));
}));

// ================================================================ LoadLocation(int pmid)
// public
router.all(`${C}/LoadLocation{/:id}`, ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  const pmid = bindInt(req.p.pmid, 'pmid');
  const location = await obj1.getLocation(pmid);
  return res.json(location);
}));

// ================================================================ Send(Int64 plid, Name, mail, mob, susmsg, int portalpmid1)  (public void)
// public (same exposure as legacy)
router.all(`${C}/Send{/:id}`, ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  const plid = bindLong(req.p.plid, 'plid');
  const portalpmid1 = bindInt(req.p.portalpmid1, 'portalpmid1');
  await Send(plid, g(req, 'Name'), g(req, 'mail'), g(req, 'mob'), g(req, 'susmsg'), portalpmid1);
  return emptyResult(res);
}));

// ================================================================ route-config "{title}" => BusinessDetails/Index
// public
// PORT-NOTE: in RouteConfig "{title}" comes after every specific url and before the Default route. Here the module is mounted
// alphabetically, so the catch-all only answers when no other registered route matches the same method + path (otherwise next()).
// Single-segment urls that other modules register (e.g. "/portal/<Controller>" for a default Index action) therefore reach those
// modules instead of BusinessDetails/Index as in legacy.
const titleRoute = router.route('/portal/:title');
titleRoute.all((req, res, next) => {
  if (otherRouteHandles(req, titleRoute)) return next('route');
  return next();
}, ps.CheckResellerTimeout, asyncHandler((req, res) => indexHandler(req, res, true)));

module.exports = router;
