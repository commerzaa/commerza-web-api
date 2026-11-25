'use strict';
/**
 * Port of Member/Common/Controllers/SearchNotFoundController.cs (SearchNotFoundController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const GetIP = require('../../lib/member/GetIP');

const router = express.Router();
const DB = 'affiliate';

// public. route-config: "search-not-found/{action}" (default action Index)
router.all(['/member/SearchNotFound/Index{/:id}', '/member/search-not-found', '/member/search-not-found/Index'], (req, res) => {
  // Session["SelectedCity"] / Session["SearchedItem"]
  const City = sessionStore.get(req, 'SelectedCity');
  const keyword = sessionStore.get(req, 'SearchedItem');
  const PageUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  res.json({
    view: '~/Views/SearchNotFound/Index.cshtml',
    ViewBag: {
      City: City === undefined ? null : City,
      keyword: keyword === undefined ? null : keyword,
      Canonical: PageUrl,
      Title: 'Search Not Found',
      MetaDesc: 'Search Not Found',
      MetaKeyword: 'Search Not Found',
      PageNotFound: 'Ok',
    },
  });
});

// public. route-config: "search-not-found/{action}"
router.all(['/member/SearchNotFound/SearchQueryTip{/:id}', '/member/search-not-found/SearchQueryTip'], asyncHandler(async (req, res) => {
  const { Name, Mobile, EmailId, search, city, area } = req.p;
  let IpCountry = '', IpState = '', IpCity = '';
  let CID = 0;
  const loc = sessionStore.get(req, 'Propertysessionofcountrystatecity');
  if (loc) {
    IpCountry = String(loc.CountryName || '').trim();
    IpState = String(loc.RegionName || '').trim();
    IpCity = String(loc.CityName || '').trim();
  }
  let ipaddress = await GetIP.GetLocalIP(req);
  if (ipaddress.includes(',')) ipaddress = ipaddress.substring(0, ipaddress.indexOf(','));
  const cidSess = sessionStore.get(req, 'COUNTRYID');
  if (cidSess !== undefined && cidSess !== null) CID = parseInt(cidSess, 10);

  // PORT-NOTE: ExecuteSqlCommand returned the affected-row count; the number of rows returned by the function is used here.
  // Usp_Search_Suggestions was not found in affilate.sql.
  const rows = await db.proc(DB, 'usp_search_suggestions', {
    name: Name, mobile: Mobile, email: EmailId, search, city, area, active: 1, ipaddress,
    ipcontry: IpCountry, ipstate: IpState, ipcity: IpCity, countryid: CID, mode: 1,
  });
  res.json(String(rows.length));
}));

module.exports = router;
