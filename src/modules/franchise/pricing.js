'use strict';
/** Ported from Franchise\Controllers\Pricing.cs (pricingController) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows, mapRow } = require('../../utils/shape');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const WebsiteDetail = require('../../lib/franchise/WebsiteDetail');

const router = express.Router();
const P = '/franchise/pricing';

const KIT = ['KID', 'PCODE', 'TITLE', 'IMAGE', 'TYPE', 'AMOUNT', 'DAP', 'PV', 'BV', 'DISTAMOUNT', 'VATINPER', 'CMGAMOUNT', 'DIRECTINCOME', 'BINARYINCOME',
  'EPIN_COMMISSION', 'STATUS', 'ROI', 'NOOFMONTH', 'NoOfCities', 'NoOfKeywords'];
const EMAIL = ['TEPMID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'ST', 'TotalAmount', 'NoOfEmail', 'NoOfDaysValidity'];
const SMS = ['TSPMID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'TotalAmount', 'ST', 'NoOfSMS', 'NoOfDaysValidity'];
const SUB = ['TSMID', 'SubscriptionHeading', 'SubscriptionDetails', 'NoOfDaysForActivation', 'IsSMSLIMITS', 'NoOfSms', 'IsEmailLimits', 'NoOfEmail',
  'IsWhatsupLimits', 'NoOfWhatsUpMessage', 'IsNoOfWebsiteLimits', 'NoOfWebsiteSelection', 'IsLeadLandingPageLimits', 'NoOfLeadLandingPage', 'Price',
  'ISDiscountApplicable', 'CommentOrRemark', 'IsActive', 'Status', 'IsTrailSubscription', 'TTSID', 'Discount', 'NetPayable'];
const WA = ['TWUPMID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'TotalAmount', 'ST', 'NoOfMessages', 'NoOfDaysValidity'];
const TB = ['TTBID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'TotalAmount', 'ST', 'NoOfHits', 'NoOfDaysValidity'];
const BILL = ['BILLID', 'PLID', 'BUSINESSNAME', 'CONTACTNAME', 'PHONENUMBER', 'ADDRESS', 'CITY', 'POSTALCODE', 'SID', 'CID', 'BILLINGSTATUS', 'DATE', 'RECENTBILLINGINFORMATION'];

// public (session optional; legacy treated a null session as Plid 0) // route-config: advertise-pricing -> Pricing/index
router.all([`${P}/Index{/:id}`, '/franchise/advertise-pricing'], optionalAuth, asyncHandler(async (req, res) => {
  const TempPlid = parseInt(req.user ? req.user.did : 0, 10) || 0;
  const sub = async (mode, props) => mapRows(await proc('shopping', 'Usp_ManageSubscription', { mode: String(mode), plid: TempPlid }), props);
  const ObjGetAllData = {
    LiKitMaster: await sub(1, KIT),
    LiEmailPackMaster: await sub(2, EMAIL),
    LiSmsPackMaster: await sub(3, SMS),
    LiSubscriptionMaster: await sub(4, SUB),
    LiWhatsUpPackMaster: await sub(5, WA),
    LiTrafficBoosterPackMaster: await sub(6, TB),
  };
  const out = { Model: ObjGetAllData, IsLogin: TempPlid, Canonical: `${req.protocol}://${req.get('host')}${req.originalUrl}`, Title: '', MetaDesc: '', MetaKeyword: '' };
  const ObjWebsiteDescription = await WebsiteDetail.GetWebsiteInfo(23);
  if (ObjWebsiteDescription) {
    out.Title = ObjWebsiteDescription.SeoTitle;
    out.MetaDesc = ObjWebsiteDescription.SeoDescription;
    out.MetaKeyword = ObjWebsiteDescription.SeoKeyword;
  }
  res.json(out);
}));

// public (session optional)
router.all(`${P}/BindBillingAddress{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user ? req.user.did : 0) || 0;
  const rows = await proc('shopping', 'USP_GETBUSINESSDETAILS', { plid: Plid });
  let ObjBillingDetails = mapRow(rows[0] || null, BILL);
  if (!ObjBillingDetails) {
    ObjBillingDetails = {
      BILLID: 0, PLID: 0, BUSINESSNAME: '', CONTACTNAME: '', PHONENUMBER: '', ADDRESS: '', CITY: '', POSTALCODE: '', SID: 0, CID: 0,
      BILLINGSTATUS: 0, DATE: new Date().toISOString().replace(/\.\d{3}Z$/, ''), RECENTBILLINGINFORMATION: 0,
    };
  }
  res.json(ObjBillingDetails);
}));

module.exports = router;
