'use strict';
// Ported from ClusterofferShopingPortal\Controllers\AllSellerListController.cs (class AllSellerListController => /portal/AllSellerList/...)
// Database: shopping (Db_Shopping). Procs: USP_PORTALMASTER_SEARCHING_M_NEW, USP_MAKINGSESSIONOF_AREA_CITY.
// Tables: KEYWORD_MASTER, PRODUCT_CATEGORY (CategoryRelatedTo = 2). No filter attribute in legacy.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { listingIndex, content, getCityName, getAreaName } = require('./_shared/batch-01-common');

const router = express.Router();
const C = '/portal/AllSellerList';
const pv = (req, k) => (req.p[k] === undefined || req.p[k] === null ? null : String(req.p[k]));

// ---------------------------------------------------------------- Index(string keywordid, string city, string area)  [GET|POST]
// public
// route-config: "all-seller/{keywordid}/{city}/{area}" (all optional) -> AllSellerList/Index
router.all([`${C}/Index{/:id}`, '/portal/all-seller{/:keywordid}{/:city}{/:area}'], ps.portalSession, asyncHandler(async (req, res) => listingIndex(req, res, {
  procName: 'usp_portalmaster_searching_m_new', relatedTo: 2, view: '~/Views/AllSellerList/Index.cshtml',
})));

// ---------------------------------------------------------------- GetCityName(string cityname) : string
// public (public controller method => MVC action; string returned as content)
router.all(`${C}/GetCityName{/:id}`, ps.portalSession, asyncHandler(async (req, res) => content(res, await getCityName(req, pv(req, 'cityname')))));

// ---------------------------------------------------------------- GetAreaName(string cityname) : string
// public
router.all(`${C}/GetAreaName{/:id}`, ps.portalSession, asyncHandler(async (req, res) => content(res, await getAreaName(req, pv(req, 'cityname')))));

module.exports = router;
