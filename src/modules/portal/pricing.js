'use strict';
// Ported from ClusterofferShopingPortal\Controllers\Pricing.cs (class pricingController, 2 actions)
// Database: shopping (Db_Shopping; portal DataBaseContext). Procs: Usp_ManageSubscription, USP_GETBUSINESSDETAILS.
const express = require('express');
const db = require('../../db');
const { mapRows, mapRow } = require('../../utils/shape');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { seoViewBag } = require('./_shared/batch-12-common');

const router = express.Router();
const DB = 'shopping';
const P = '/portal/pricing';

const KIT = ['KID', 'PCODE', 'TITLE', 'IMAGE', 'TYPE', 'AMOUNT', 'DAP', 'PV', 'BV', 'DISTAMOUNT', 'VATINPER', 'CMGAMOUNT', 'DIRECTINCOME', 'BINARYINCOME',
  'EPIN_COMMISSION', 'STATUS', 'ROI', 'NOOFMONTH', 'NoOfCities', 'NoOfKeywords'];
const EMAIL = ['TEPMID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'ST', 'TotalAmount', 'NoOfEmail', 'NoOfDaysValidity'];
const SMS = ['TSPMID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'TotalAmount', 'ST', 'NoOfSMS', 'NoOfDaysValidity'];
const SUB = ['TSMID', 'SubscriptionHeading', 'SubscriptionDetails', 'NoOfDaysForActivation', 'IsSMSLIMITS', 'NoOfSms', 'IsEmailLimits', 'NoOfEmail',
  'IsWhatsupLimits', 'NoOfWhatsUpMessage', 'IsNoOfWebsiteLimits', 'NoOfWebsiteSelection', 'IsLeadLandingPageLimits', 'NoOfLeadLandingPage', 'Price',
  'ISDiscountApplicable', 'CommentOrRemark', 'IsActive', 'Status', 'IsTrailSubscription', 'TTSID', 'Discount', 'NetPayable'];
const WA = ['TWUPMID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'TotalAmount', 'ST', 'NoOfMessages', 'NoOfDaysValidity'];
const TB = ['TTBID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'TotalAmount', 'ST', 'NoOfHits', 'NoOfDaysValidity'];
const BILL = ['BILLID', 'PLID', 'BUSINESSNAME', 'CONTACTNAME', 'PHONENUMBER', 'ADDRESS', 'CITY', 'POSTALCODE', 'SID', 'CID', 'BILLINGSTATUS', 'DATE',
  'RECENTBILLINGINFORMATION'];

// ---------------------------------------------------------------- Index()
// public (session optional: TempPlid = 0 when no login). [CheckResellerTimeout] = no check.
// route-config: "pricing" -> pricing/Index ; "advertise-pricing" -> Pricing/index
router.all([P, `${P}/Index{/:id}`, '/portal/advertise-pricing'], ps.portalSession, asyncHandler(async (req, res) => {
  const TempPlid = ps.isCustomer(req) ? Number(req.user.plid) : 0;
  const ViewBag = { IsLogin: TempPlid };
  const sub = async (mode, props) => mapRows(await db.proc(DB, 'usp_managesubscription', { mode: String(mode), plid: TempPlid }), props);
  const ObjGetAllData = {};
  ObjGetAllData.LiKitMaster = await sub(1, KIT);
  ObjGetAllData.LiEmailPackMaster = await sub(2, EMAIL);
  ObjGetAllData.LiSmsPackMaster = await sub(3, SMS);
  ObjGetAllData.LiSubscriptionMaster = await sub(4, SUB);
  ObjGetAllData.LiWhatsUpPackMaster = await sub(5, WA);
  ObjGetAllData.LiTrafficBoosterPackMaster = await sub(6, TB);
  Object.assign(ViewBag, await seoViewBag(req, 23));
  res.json({ view: '~/Views/Pricing/Index.cshtml', Model: ObjGetAllData, ViewBag });
}));

// ---------------------------------------------------------------- BindBillingAddress()
// public (session optional: Plid = 0 when no login, as legacy)
router.all(`${P}/BindBillingAddress{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const Plid = ps.isCustomer(req) ? Number(req.user.plid) : 0;
  const rows = await db.proc(DB, 'usp_getbusinessdetails', { plid: Plid });
  let ObjBillingDetails = rows.length ? mapRow(rows[0], BILL) : null;
  if (ObjBillingDetails == null) {
    ObjBillingDetails = {
      BILLID: 0, PLID: 0, BUSINESSNAME: '', CONTACTNAME: '', PHONENUMBER: '', ADDRESS: '', CITY: '', POSTALCODE: '', SID: 0, CID: 0,
      BILLINGSTATUS: 0, DATE: new Date(), RECENTBILLINGINFORMATION: 0,
    };
  }
  res.json(ObjBillingDetails);
}));

module.exports = router;
