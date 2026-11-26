'use strict';
// Ported from C:/Users/MY ASUS/cluster/ClusterofferShopingPortal/ClusterofferShopingPortal/Controllers/CustomerPanel/NewsLetterSubscription.cs
// (class NewsLetterSubscriptionController => /portal/NewsLetterSubscription/...). Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const GetCountry = require('../../lib/portal/GetCountry');
const ps = require('./_shared/portal-session');
const { DB, view, outVal, str } = require('./_shared/batch-06-common');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// public (no session check). RouteConfig entry "NewsLetterSubscription" is commented out.
router.all(['/portal/NewsLetterSubscription/Index{/:id}', '/portal/NewsLetterSubscription'], ps.portalSession, asyncHandler(async (req, res) => {
  view(res, '~/Views/CustomerPanel/NewsLetterSubscription/Index.cshtml');
}));

// ---------------------------------------------------------------- insert_email_newsletter(string emaild) : JsonResult
// public (newsletter subscription for visitors; uses Session["COUNTRYID"/"COUNTRYNAME"/"IPADDRESS"] and Session.SessionID)
router.all('/portal/NewsLetterSubscription/insert_email_newsletter{/:id}', ps.portalSession, asyncHandler(async (req, res) => {
  const emaild = req.p.emaild;
  let Result = '';
  const ViewBag = {};
  if (ps.sessionGet(req, 'COUNTRYID') === null || ps.sessionGet(req, 'COUNTRYID') === undefined) {
    try {
      const Sessionid = ps.getSid(req);
      await GetCountry.SettingVisitor(Sessionid);
      ps.initializeVisitorCountrySession(req);
    } catch (ex) {
      ViewBag.Message = ex.message;
    }
  }
  const CountryName = str(ps.sessionGet(req, 'COUNTRYNAME'));
  const IPAddress = str(ps.sessionGet(req, 'IPADDRESS'));
  if (str(emaild).trim() !== '') {
    const row = await db.procOne(DB, 'usp_subscribenewsletter', { EMAILID: emaild, IPADDRESS: IPAddress, IPCOUNTRY: CountryName });
    Result = str(outVal(row, 'strresult'));
  } else {
    // legacy: Json("Enter Email ID ") was created but not returned => falls through with Result = ""
  }
  res.json(Result);
}));

module.exports = router;
