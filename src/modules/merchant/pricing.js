'use strict';
/** Port of Merchant Panel Controllers/Pricing.cs (class pricingController, 2 actions). DB: 'shopping' */
const express = require('express');
const { proc } = require('../../db');
const { mapRow } = require('../../utils/shape');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const WebsiteDetail = require('../../lib/merchant/WebsiteDetail');

const router = express.Router();
const DB = 'shopping';
const P = '/merchant/pricing';
const BILL = ['BILLID', 'PLID', 'BUSINESSNAME', 'CONTACTNAME', 'PHONENUMBER', 'ADDRESS', 'CITY', 'POSTALCODE', 'SID', 'CID', 'BILLINGSTATUS', 'DATE', 'RECENTBILLINGINFORMATION'];

// Session["LoginwithMobile"] -> server-side session store (sync get/set); tolerant when no token / store missing
function loginWithMobile(req) {
  try { return require('../../utils/sessionStore').get(req, 'LoginwithMobile'); } catch (e) { return null; }
}

// public (session optional; legacy treated a null session as Plid 0)
// route-config: advertise-pricing -> pricing/index
router.all([`${P}/Index{/:id}`, '/merchant/advertise-pricing'], optionalAuth, asyncHandler(async (req, res) => {
  const masterpageshow = loginWithMobile(req) != null ? 'MobileLogin' : '';
  const TempPlid = parseInt(req.user ? req.user.plid : 0, 10) || 0;
  // Legacy: all six Usp_ManageSubscription queries are commented out, the lists are null.
  const ObjGetAllData = {
    LiKitMaster: null, LiEmailPackMaster: null, LiSmsPackMaster: null,
    LiSubscriptionMaster: null, LiWhatsUpPackMaster: null, LiTrafficBoosterPackMaster: null,
  };
  const out = {
    view: '~/Views/Pricing/Index.cshtml', Model: ObjGetAllData, masterpageshow, IsLogin: TempPlid,
    Canonical: `${req.protocol}://${req.get('host')}${req.originalUrl}`, Title: '', MetaDesc: '', MetaKeyword: '',
  };
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
  const Plid = Number(req.user ? req.user.plid : 0) || 0;
  const rows = await proc(DB, 'usp_getbusinessdetails', { plid: Plid });
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
