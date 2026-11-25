'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\PayItForward.cs (PayItForwardController) */
const express = require('express');
const { query, queryOne, scalar, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/PayItForward';
const KIT_PROPS = ['KID', 'PCODE', 'TITLE', 'IMAGE', 'TYPE', 'AMOUNT', 'DAP', 'PV', 'BV', 'DISTAMOUNT', 'VATINPER', 'CMGAMOUNT', 'DIRECTINCOME',
  'BINARYINCOME', 'EPIN_COMMISSION', 'STATUS', 'ROI', 'NOOFMONTH', 'NoOfCities', 'NoOfKeywords'];
const SUB_PROPS = ['TSMID', 'SubscriptionHeading', 'SubscriptionDetails', 'NoOfDaysForActivation', 'IsSMSLIMITS', 'NoOfSms', 'IsEmailLimits', 'NoOfEmail',
  'IsWhatsupLimits', 'NoOfWhatsUpMessage', 'IsNoOfWebsiteLimits', 'NoOfWebsiteSelection', 'IsLeadLandingPageLimits', 'NoOfLeadLandingPage', 'Price',
  'ISDiscountApplicable', 'CommentOrRemark', 'IsActive', 'Status', 'IsTrailSubscription', 'TTSID', 'Discount', 'NetPayable', 'MININVESTMENT',
  'MAXINVESTMENT', 'SERVICE_TAX_PER', 'PackageColor', 'AmountColor', 'IMAGE', 'MRP', 'BV'];

// auth (null session => RedirectToAction("Index","Home"))
// route-config: "referral/package-purchase" -> PayItForward/Index
router.all([`${P}/Index{/:id}`, P, '/member/referral/package-purchase'], auth, asyncHandler(async (req, res) => {
  let username = req.p.username;
  if (username == null) username = '';
  const ViewBag = {};
  const ObjGetAllData = {};
  const name = '';
  let sponserid = '';
  let rootid = '';
  const Plid = Math.trunc(Number(req.user.plid));
  let TempPlid = Plid;
  const mem = await queryOne(DB, 'select * from member_master where regno = @plid limit 1', { plid: Plid });
  if (!mem) throw new Error('Object reference not set to an instance of an object.');
  ViewBag.UserName = mem.username;
  ViewBag.Address = mem.address;
  ViewBag.fatherOrMotherName = mem.fath_hus_name;
  ViewBag.fullname = (mem.fname == null ? '' : mem.fname) + ' ' + (mem.lname == null ? '' : mem.lname);
  ViewBag.Side = mem.side;
  sponserid = mem.sponserid;
  rootid = mem.rootid;
  ViewBag.regno = mem.regno;
  if (username !== '') {
    username = await UtilityClass.Decryptword(username);
    const Downline_Member = await queryOne(DB, 'select * from member_master where username = @u limit 1', { u: username });
    if (Downline_Member) {
      ViewBag.UserName = Downline_Member.username;
      ViewBag.Address = Downline_Member.address;
      ViewBag.fatherOrMotherName = Downline_Member.fath_hus_name;
      ViewBag.fullname = (Downline_Member.fname == null ? '' : Downline_Member.fname) + ' ' + (Downline_Member.lname == null ? '' : Downline_Member.lname);
      ViewBag.name = name;
      ViewBag.kitprice = Downline_Member.kitprice;
      ViewBag.email = Downline_Member.emailid;
      ViewBag.kycstatus = Downline_Member.kycstatus;
      ViewBag.username = username;
      ViewBag.usernameSelf = '';
      ViewBag.Side = Downline_Member.side;
      sponserid = Downline_Member.sponserid;
      rootid = Downline_Member.rootid;
      ViewBag.regno = Downline_Member.regno;
      TempPlid = Math.trunc(Number(Downline_Member.regno));
    }
  } else {
    ViewBag.usernameSelf = req.user.username === undefined ? null : req.user.username; // ((Login)Session["Plid"]).UserName
  }
  ViewBag.sponserid = '';
  ViewBag.rootid = '';

  const Downline_Member1 = await queryOne(DB, 'select username from member_master where loginid = @l limit 1', { l: sponserid });
  if (Downline_Member1) ViewBag.sponserid = Downline_Member1.username;

  const Downline_Member2 = await queryOne(DB, 'select username from member_master where loginid = @l limit 1', { l: rootid });
  if (Downline_Member2) ViewBag.rootid = Downline_Member2.username;

  const statusgst = await queryOne(DB, "select active from settings where active::int = 1 and caption = 'PackagewiseGST' limit 1", {});
  ViewBag.gstatstatus = statusgst ? Boolean(statusgst.active) : false;

  ObjGetAllData.LiKitMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: 1, plid: TempPlid }), KIT_PROPS);
  ObjGetAllData.LiEmailPackMaster = null;
  ObjGetAllData.LiSmsPackMaster = null;
  ObjGetAllData.LiSubscriptionMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: 4, plid: Plid, tempplid: TempPlid }), SUB_PROPS);
  ObjGetAllData.LiWhatsUpPackMaster = null;
  ObjGetAllData.LiTrafficBoosterPackMaster = null;
  ObjGetAllData.BankListadmin = null;

  const isv = await queryOne(DB, 'select coalesce(isverify, 0) as v from member_login where regno = @plid limit 1', { plid: Plid });
  ViewBag.IsActive = isv ? Boolean(Number(isv.v === true ? 1 : isv.v === false ? 0 : isv.v)) : false;
  res.json({ Model: ObjGetAllData, ViewBag });
}));

// auth (legacy had no session check but dereferenced the session)
router.all(`${P}/checkusername{/:id}`, auth, asyncHandler(async (req, res) => {
  let ret = 'invalid';
  const row = await queryOne(DB, "select coalesce(username, '') as username from member_master where regno = @plid limit 1", { plid: Number(req.user.plid) });
  const USERNAME = row ? row.username : null;
  ret = 'Success' + '^' + (USERNAME === null ? '' : USERNAME);
  res.json(ret);
}));

// (CheckCheckboxOnTheBehalfOfPermission is commented out in the legacy controller)

// auth (legacy had no session check but dereferenced the session)
router.all(`${P}/CheckTranspasswordOnOrOff{/:id}`, auth, asyncHandler(async (req, res) => {
  const r = await queryOne(DB, 'select isverify from member_login where regno = @plid limit 1', { plid: Number(req.user.plid) });
  const result = r ? Boolean(r.isverify === true || Number(r.isverify) === 1) : false;
  res.json(result);
}));

module.exports = router;
