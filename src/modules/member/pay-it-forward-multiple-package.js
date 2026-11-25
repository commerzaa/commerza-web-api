'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\PayItForwardMultiplePackage.cs (PayItForwardMultiplePackageController) */
const express = require('express');
const { queryOne, scalar, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/PayItForwardMultiplePackage';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const P_KIT = ['KID', 'PCODE', 'TITLE', 'IMAGE', 'TYPE', 'AMOUNT', 'DAP', 'PV', 'BV', 'DISTAMOUNT', 'VATINPER', 'CMGAMOUNT', 'DIRECTINCOME', 'BINARYINCOME', 'EPIN_COMMISSION', 'STATUS', 'ROI', 'NOOFMONTH', 'NoOfCities', 'NoOfKeywords'];
const P_EMAIL = ['TEPMID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'ST', 'TotalAmount', 'NoOfEmail', 'NoOfDaysValidity'];
const P_SMS = ['TSPMID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'TotalAmount', 'ST', 'NoOfSMS', 'NoOfDaysValidity'];
const P_SUB = ['TSMID', 'SubscriptionHeading', 'SubscriptionDetails', 'NoOfDaysForActivation', 'IsSMSLIMITS', 'NoOfSms', 'IsEmailLimits', 'NoOfEmail', 'IsWhatsupLimits', 'NoOfWhatsUpMessage', 'IsNoOfWebsiteLimits', 'NoOfWebsiteSelection', 'IsLeadLandingPageLimits', 'NoOfLeadLandingPage', 'Price', 'ISDiscountApplicable', 'CommentOrRemark', 'IsActive', 'Status', 'IsTrailSubscription', 'TTSID', 'Discount', 'NetPayable', 'MININVESTMENT', 'MAXINVESTMENT', 'SERVICE_TAX_PER', 'PackageColor', 'AmountColor', 'IMAGE', 'MRP', 'BV'];
const P_WHATS = ['TWUPMID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'TotalAmount', 'ST', 'NoOfMessages', 'NoOfDaysValidity'];
const P_TRAFFIC = ['TTBID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'TotalAmount', 'ST', 'NoOfHits', 'NoOfDaysValidity'];
const P_CHECK = ['FID', 'Status', 'VALIDATIONACTIVE', 'ACTIVE', 'FIELDNAME'];

// route-config: referral/xRJId8N3iO8ogKWPugtUjCayAGMsBRMZyGX2XAxTRuEolWQkH05VJw==
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/xRJId8N3iO8ogKWPugtUjCayAGMsBRMZyGX2XAxTRuEolWQkH05VJw=='], auth, asyncHandler(async (req, res) => {
  let username = req.p.username;
  if (username === undefined || username === null) username = '';
  const ObjGetAllData = {};
  const ViewBag = {};
  let name = ''; let kitprice = 0; let email = '';
  const Plid = parseInt(req.user.plid, 10);
  let TempPlid = parseInt(req.user.plid, 10);
  if (username !== '') {
    username = UtilityClass.Decryptword(username);
    const row = await queryOne(DB, 'select * from member_master where username = @u limit 1', { u: username });
    if (row) {
      TempPlid = parseInt(row.regno, 10);
      name = str(row.fname) + str(row.lname);
      kitprice = Number(await scalar(DB, 'SELECT coalesce(kitprice,0) as kitprice FROM member_master where username=@u limit 1', { u: username })) || 0;
      email = row.emailid;
    }
    ViewBag.name = name;
    ViewBag.kitprice = kitprice;
    ViewBag.email = email;
    ViewBag.username = username;
    ViewBag.usernameSelf = '';
  } else {
    ViewBag.usernameSelf = req.user.userName || req.user.username;
  }
  ObjGetAllData.LiKitMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: '1', plid: TempPlid }), P_KIT);
  ObjGetAllData.LiEmailPackMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: '2', plid: TempPlid }), P_EMAIL);
  ObjGetAllData.LiSmsPackMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: '3', plid: TempPlid }), P_SMS);
  ObjGetAllData.LiSubscriptionMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: '4', plid: Plid, tempplid: TempPlid }), P_SUB);
  ObjGetAllData.LiWhatsUpPackMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: '5', plid: TempPlid }), P_WHATS);
  ObjGetAllData.LiTrafficBoosterPackMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: '6', plid: TempPlid }), P_TRAFFIC);
  ObjGetAllData.BankListadmin = null;
  res.json({ Model: ObjGetAllData, ViewBag });
}));

// auth
router.all(`${P}/checkusername{/:id}`, auth, asyncHandler(async (req, res) => {
  const USERNAME = await scalar(DB, "Select coalesce(USERNAME,'') As USERNAME From PORTAL_LOGIN Where PLID=@p limit 1", { p: Number(req.user.plid) });
  res.json('Success' + '^' + str(USERNAME));
}));

// auth
router.all(`${P}/CheckCheckboxOnTheBehalfOfPermission{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(mapRows(await proc(DB, 'usp_getdataforregistration', { mode: 1 }), P_CHECK));
}));

module.exports = router;
