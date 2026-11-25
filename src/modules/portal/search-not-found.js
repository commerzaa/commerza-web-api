'use strict';
// Ported from ClusterofferShopingPortal\Controllers\SearchNotFoundController.cs (class SearchNotFoundController, [CheckResellerTimeout] = no check)
// Database: shopping (Db_Shopping; legacy DataBaseContext).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const GetIP = require('../../lib/portal/GetIP');
const ps = require('./_shared/portal-session');
const { DB, pageUrl, toInt32, NRE } = require('./_shared/batch-13-common');

const router = express.Router();
const C = 'SearchNotFound';

// ---------------------------------------------------------------- Index()
// public (outer page)
// route-config: "search-not-found/{action}" (action default Index)
router.all([`/portal/${C}`, `/portal/${C}/Index{/:id}`, '/portal/search-not-found', '/portal/search-not-found/Index'], ps.portalSession,
  asyncHandler(async (req, res) => {
    const ViewBag = {};
    ViewBag.City = ps.sessionGet(req, 'SelectedCity');
    ViewBag.keyword = ps.sessionGet(req, 'SearchedItem');
    const PageUrl = pageUrl(req);
    ViewBag.Canonical = PageUrl;
    ViewBag.Title = 'Search Not Found';
    ViewBag.MetaDesc = 'Search Not Found';
    ViewBag.MetaKeyword = 'Search Not Found';
    ViewBag.PageNotFound = 'Ok';
    return res.json({ view: `~/Views/${C}/Index.cshtml`, ...ViewBag });
  }));

// ---------------------------------------------------------------- SearchQueryTip(string Name, string Mobile, string EmailId, string search, string city, string area)
// public (anonymous suggestion form, no session check in legacy)
// route-config: "search-not-found/{action}"
router.all([`/portal/${C}/SearchQueryTip{/:id}`, '/portal/search-not-found/SearchQueryTip'], ps.portalSession, asyncHandler(async (req, res) => {
  const { Name, Mobile, EmailId, search, city, area } = req.p;
  let IpCountry = ''; let IpState = ''; let IpCity = ''; let ret = '';
  let CID = 0;
  const loc = ps.sessionGet(req, 'Propertysessionofcountrystatecity'); // never written in active code => null
  if (loc != null) {
    const t = (v) => { if (v === null || v === undefined) throw NRE(); return String(v).trim(); };
    IpCountry = t(loc.CountryName);
    IpState = t(loc.RegionName);
    IpCity = t(loc.CityName);
  }
  let ipaddress = await GetIP.GetLocalIP(req);
  if (String(ipaddress).includes(',')) {
    const indexof = ipaddress.indexOf(',');
    ipaddress = ipaddress.substring(0, indexof);
  }
  if (ps.sessionGet(req, 'COUNTRYID') != null) {
    CID = toInt32(ps.sessionGet(req, 'COUNTRYID'));
  }
  await db.proc(DB, 'Usp_Search_Suggestions', {
    Name: Name ?? null, Mobile: Mobile ?? null, email: EmailId ?? null, search: search ?? null, city: city ?? null, area: area ?? null,
    active: 1, ipaddress, ipcontry: IpCountry, ipstate: IpState, ipcity: IpCity, countryid: CID, Mode: 1,
  });
  // PORT-NOTE: legacy returned ExecuteSqlCommand's affected-row count as string; the proc (no SET NOCOUNT) does one INSERT => "1".
  ret = '1';
  return res.json(ret);
}));

module.exports = router;
