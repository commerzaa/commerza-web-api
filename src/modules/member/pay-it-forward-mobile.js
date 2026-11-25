'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/PayItForward_mobile.cs  (PayItForward_mobileController, 3 actions)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
// Session["Plid"] -> req.user.plid / req.user.username
const express = require('express');
const router = express.Router();
const { queryOne, scalar, proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const DB = 'affiliate';
const BASE = '/member/PayItForward_mobile';
const KIT = ['KID', 'PCODE', 'TITLE', 'IMAGE', 'TYPE', 'AMOUNT', 'DAP', 'PV', 'BV', 'DISTAMOUNT', 'VATINPER', 'CMGAMOUNT', 'DIRECTINCOME', 'BINARYINCOME', 'EPIN_COMMISSION', 'STATUS', 'ROI', 'NOOFMONTH', 'NoOfCities', 'NoOfKeywords'];
const EMAIL = ['TEPMID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'ST', 'TotalAmount', 'NoOfEmail', 'NoOfDaysValidity'];
const SMS = ['TSPMID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'TotalAmount', 'ST', 'NoOfSMS', 'NoOfDaysValidity'];
const SUBSCRIPTION = ['TSMID', 'SubscriptionHeading', 'SubscriptionDetails', 'NoOfDaysForActivation', 'IsSMSLIMITS', 'NoOfSms', 'IsEmailLimits', 'NoOfEmail', 'IsWhatsupLimits', 'NoOfWhatsUpMessage',
  'IsNoOfWebsiteLimits', 'NoOfWebsiteSelection', 'IsLeadLandingPageLimits', 'NoOfLeadLandingPage', 'Price', 'ISDiscountApplicable', 'CommentOrRemark', 'IsActive', 'Status', 'IsTrailSubscription',
  'TTSID', 'Discount', 'NetPayable', 'MININVESTMENT', 'MAXINVESTMENT', 'SERVICE_TAX_PER', 'PackageColor', 'AmountColor', 'IMAGE', 'MRP', 'BV'];
const WHATSUP = ['TWUPMID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'TotalAmount', 'ST', 'NoOfMessages', 'NoOfDaysValidity'];
const TRAFFIC = ['TTBID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'TotalAmount', 'ST', 'NoOfHits', 'NoOfDaysValidity'];

// Index(string username)  - Session check => auth
// route-config: referral/PayItForward-mobile  (id optional)
// auth
router.all([`${BASE}/Index{/:id}`, BASE, '/member/referral/PayItForward-mobile{/:id}'], auth, asyncHandler(async (req, res) => {
  let username = req.p.username;
  if (username === undefined || username === null) username = '';
  const ObjGetAllData = {};
  const ViewBag = {};
  let name = '';
  let kitprice = 0;
  let email = '';
  const Plid = parseInt(req.user.plid, 10);
  let TempPlid = parseInt(req.user.plid, 10);
  if (username !== '') {
    username = UtilityClass.Decryptword(username);
    const row = await queryOne(DB, 'select regno, fname, lname, emailid from member_master where username = @username limit 1', { username });
    if (row) {
      TempPlid = parseInt(row.regno, 10);
      name = (row.fname === null || row.fname === undefined ? '' : row.fname) + (row.lname === null || row.lname === undefined ? '' : row.lname);
      const kp = await scalar(DB, 'SELECT coalesce(kitprice, 0) as kitprice FROM member_master where username = @username limit 1', { username });
      kitprice = kp === null || kp === undefined ? 0 : kp;
      email = row.emailid;
    }
    ViewBag.name = name;
    ViewBag.kitprice = kitprice;
    ViewBag.email = email;
    ViewBag.username = username;
    ViewBag.usernameSelf = '';
  } else {
    ViewBag.usernameSelf = req.user.username;
  }
  ObjGetAllData.LiKitMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: '1', plid: TempPlid }), KIT);
  ObjGetAllData.LiEmailPackMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: '2', plid: TempPlid }), EMAIL);
  ObjGetAllData.LiSmsPackMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: '3', plid: TempPlid }), SMS);
  ObjGetAllData.LiSubscriptionMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: '4', plid: Plid, tempplid: TempPlid }), SUBSCRIPTION);
  ObjGetAllData.LiWhatsUpPackMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: '5', plid: TempPlid }), WHATSUP);
  ObjGetAllData.LiTrafficBoosterPackMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: '6', plid: TempPlid }), TRAFFIC);
  ObjGetAllData.BankListadmin = null;
  const act = await scalar(DB, 'select coalesce(isverify, false) from member_login where regno = @plid limit 1', { plid: Plid });
  ViewBag.IsActive = act === null || act === undefined ? false : act;
  res.json({ view: '~/Views/CustomerPanel/PayItForward_mobile/Index.cshtml', Model: ObjGetAllData, ViewBag });
}));

// checkusername()
// auth
router.all(`${BASE}/checkusername{/:id}`, auth, asyncHandler(async (req, res) => {
  const USERNAME = await scalar(DB, "Select coalesce(username, '') As username From portal_login Where plid = @plid limit 1", { plid: req.user.plid });
  res.json('Success' + '^' + (USERNAME === null || USERNAME === undefined ? '' : USERNAME));
}));

// CheckTranspasswordOnOrOff()
// auth
router.all(`${BASE}/CheckTranspasswordOnOrOff{/:id}`, auth, asyncHandler(async (req, res) => {
  const v = await scalar(DB, 'select isverify from member_login where regno = @plid limit 1', { plid: req.user.plid });
  res.json(v === null || v === undefined ? false : v);
}));

module.exports = router;
