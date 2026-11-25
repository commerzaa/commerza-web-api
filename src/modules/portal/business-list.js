'use strict';
// Ported from ClusterofferShopingPortal\Controllers\BusinessListController.cs (class BusinessListController => /portal/BusinessList/...)
// Database: shopping (Db_Shopping). Procs: USP_PORTALMASTER_SEARCHING_M, USP_MAKINGSESSIONOF_AREA_CITY.
// Tables: KEYWORD_MASTER, PRODUCT_CATEGORY (CategoryRelatedTo = 1). Classes BusinessList / BusinessListLi / RelatedKeywords:
// property lists in _shared/batch-01-common.js. ([CheckResellerTimeout] is on class BusinessList, not on the controller: no check.)
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { listingIndex, content, getCityName, getAreaName } = require('./_shared/batch-01-common');

const router = express.Router();
const C = '/portal/BusinessList';
const pv = (req, k) => (req.p[k] === undefined || req.p[k] === null ? null : String(req.p[k]));

// ---------------------------------------------------------------- Index(string keywordid, string city, string area)  [GET|POST]
// public
// route-config: "all-listing/{keywordid}/{city}/{area}" and "listing/{keywordid}/{city}/{area}" (all optional) -> BusinessList/Index
router.all([`${C}/Index{/:id}`, '/portal/all-listing{/:keywordid}{/:city}{/:area}', '/portal/listing{/:keywordid}{/:city}{/:area}'],
  ps.portalSession, asyncHandler(async (req, res) => listingIndex(req, res, {
    procName: 'usp_portalmaster_searching_m', relatedTo: 1, view: '~/Views/BusinessList/Index.cshtml',
  })));

// ---------------------------------------------------------------- GetCityName(string cityname) : string
// public (public controller method => MVC action; string returned as content)
router.all(`${C}/GetCityName{/:id}`, ps.portalSession, asyncHandler(async (req, res) => content(res, await getCityName(req, pv(req, 'cityname')))));

// ---------------------------------------------------------------- GetAreaName(string cityname) : string
// public
router.all(`${C}/GetAreaName{/:id}`, ps.portalSession, asyncHandler(async (req, res) => content(res, await getAreaName(req, pv(req, 'cityname')))));

module.exports = router;
