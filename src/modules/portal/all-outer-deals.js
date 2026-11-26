'use strict';
// Ported from ClusterofferShopingPortal\Controllers\AllOuterDealsController.cs (class AllOuterDealsController => /portal/AllOuterDeals/...)
// Database: shopping (Db_Shopping). Procs: Usp_DealsMaster (not in the schema dump), USP_MAKINGSESSIONOF_AREA_CITY.
// [CheckResellerTimeout]: no check in legacy. Route-config entries "deals-offers/..." and "deals/..." are commented out in legacy.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const WebsiteDetail = require('../../lib/portal/WebsiteDetail');
const ps = require('./_shared/portal-session');
const { DB, pageUrl, toTitleCase, content, countrySessionBlock, getCityName } = require('./_shared/batch-01-common');

const router = express.Router();
const C = '/portal/AllOuterDeals';

/** class MostPopularDeals (Models/Portal_Deal_Master.cs) */
const DEAL_PROPS = ['DEALID', 'TITLE', 'DESCRIPTION', 'Discount', 'Offer', 'ADDRESS', 'MOBILENO', 'IMAGES', 'REVIEW', 'REVIEWCOUNT', 'URL', 'STARTPRICE'];

const pv = (req, k) => (req.p[k] === undefined ? null : (req.p[k] === null ? null : String(req.p[k])));

// ---------------------------------------------------------------- Index(string keyword, string city, string area)  [GET|POST]
// public
router.all(`${C}/Index{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const ViewBag = {};
  let keyword = pv(req, 'keyword');
  let city = pv(req, 'city');
  const area = pv(req, 'area');

  await countrySessionBlock(req, ViewBag);

  // For Domain Management Code Start Here
  let keywordUrl = '';
  if (keyword !== null) keywordUrl = keyword.split('-').join(' ');
  else keyword = '';
  let CityUrl = ''; let areaUrl = '';

  try {
    const CountryName = 'India';
    if (keyword === null) {
      // unreachable (keyword defaulted above): legacy Response.Redirect("/page-not-found")
      keyword = '';
      return res.json({ redirect: '/page-not-found' });
    }
    keyword = keyword.split('-').join(' ');
    keyword = keyword.split('(').join('');
    keyword = keyword.split(')').join('');
    keyword = keyword.trim();
    ViewBag.Keyword = keyword;
    keywordUrl = toTitleCase(keywordUrl);
    if (city !== null) {
      city = await getCityName(req, city);
      CityUrl = city.split('-').join(' ');
      CityUrl = toTitleCase(CityUrl);
    }
    if (area !== null) {
      areaUrl = area.split('-').join(' ');
      areaUrl = toTitleCase(areaUrl);
    }
    // For SEO Management Code Start Here
    if (city === null && area === null && (keywordUrl === null || keywordUrl === '')) {
      ViewBag.Title = 'Anav Exchange - Best Deals, Offers, Coupon, Discounts in India - Details, Directory and Companies';
      ViewBag.MetaDesc = 'Anav Exchange - Best Deals, Offers, Discounts in India. Online business & companies deal, offer, coupon directory of indian companies, Free deal list yourself at largest & most trusted deals website in india.';
      ViewBag.MetaKeyword = 'Best Deals, Best Deals in india';
    } else if (city === null && area === null) {
      ViewBag.IsFotterShow = 1;
      const ObjWebsiteDescription = await WebsiteDetail.GetDealsPageDetails(keyword.trim());
      if (ObjWebsiteDescription !== null && ObjWebsiteDescription !== undefined) {
        ViewBag.Heading = ObjWebsiteDescription.Heading;
        ViewBag.Description = ObjWebsiteDescription.Description;
        ViewBag.Title = ObjWebsiteDescription.SeoTitle;
        ViewBag.MetaDesc = ObjWebsiteDescription.SeoDescription;
        ViewBag.MetaKeyword = ObjWebsiteDescription.SeoKeyword;
      } else {
        const c = (CountryName === 'india' ? 'India' : 'USA'); // CountryName is "India" (capital I) => always "USA", as legacy
        ViewBag.Title = 'Best ' + keywordUrl + ' in ' + c + ' - Anav Exchange';
        ViewBag.MetaDesc = 'Best ' + keywordUrl + ' in ' + c + '. Get  ' + keywordUrl + ' Deals phone numbers, address, reviews, ratings on Anav Exchange';
        ViewBag.MetaKeyword = 'Best ' + keywordUrl + ', Best ' + keywordUrl + ' ' + c + '';
      }
    } else if (city !== null && area === null) {
      ViewBag.ShowAlternateUrl = 0;
      ViewBag.Title = 'Best ' + keywordUrl + ' in ' + CityUrl + ' - Anav Exchange';
      ViewBag.MetaDesc = 'Best ' + keywordUrl + ' in ' + CityUrl + '. Get  ' + keywordUrl + ' Deals phone numbers, address, reviews, ratings on Anav Exchange';
      ViewBag.MetaKeyword = 'Best ' + keywordUrl + ', Best ' + keywordUrl + ' ' + CityUrl + ' ';
    } else if (city === null && area !== null) {
      ViewBag.ShowAlternateUrl = 0;
      ViewBag.Title = 'Best ' + keywordUrl + ' in ' + areaUrl + ' - Anav Exchange';
      ViewBag.MetaDesc = 'Best ' + keywordUrl + ' in ' + areaUrl + '. Get  ' + keywordUrl + ' Deals phone numbers, address, reviews, ratings on Anav Exchange';
      ViewBag.MetaKeyword = 'Best ' + keywordUrl + ', Best ' + keywordUrl + ' ' + areaUrl + ' ';
    } else if (city !== null && area !== null) {
      ViewBag.ShowAlternateUrl = 0;
      ViewBag.Title = 'Best ' + keywordUrl + ' in ' + CityUrl + ' ' + areaUrl + ' - Anav Exchange';
      ViewBag.MetaDesc = 'Best ' + keywordUrl + ' in ' + CityUrl + ' ' + areaUrl + '. Get  ' + keywordUrl + ' Deals phone numbers, address, reviews, ratings on Anav Exchange';
      ViewBag.MetaKeyword = 'Best ' + keywordUrl + ', Best ' + keywordUrl + ' ' + CityUrl + ' ' + areaUrl;
    }
  } catch (ex) {
    ViewBag.Message = ex.message;
  }
  ViewBag.Canonical = pageUrl(req);
  // Random ObjR = new Random(); int RandomNo = ObjR.Next(1, 999);  (unused)
  const PageNo = '1'; const PageSize = '100';
  let CID = ps.sessionGet(req, 'COUNTRYID');
  CID = CID === null ? '' : String(CID); // Convert.ToString(Session["COUNTRYID"])
  const ObjMostPopularDeals = mapRows(await db.proc(DB, 'usp_dealsmaster', {
    mode: '4', dealid: '0', cid: CID, city: CityUrl, area: areaUrl, keywordurl: keywordUrl, pageno: PageNo, pagesize: PageSize,
  }), DEAL_PROPS);
  if (ObjMostPopularDeals === null || ObjMostPopularDeals.length === 0) {
    // Response.Redirect("/search-not-found") ends the response
    return res.json({ redirect: '/search-not-found' });
  }
  return res.json({ view: '~/Views/AllOuterDeals/Index.cshtml', Model: ObjMostPopularDeals, ViewBag });
}));

// ---------------------------------------------------------------- GetCityName(string cityname) : string
// public (public controller method => MVC action; returns the string as content)
router.all(`${C}/GetCityName{/:id}`, ps.portalSession, asyncHandler(async (req, res) => content(res, await getCityName(req, pv(req, 'cityname')))));

module.exports = router;
