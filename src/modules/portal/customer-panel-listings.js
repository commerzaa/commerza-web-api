'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Listings.cs (ListingsController)
// Actions: Index, removefavDealid, removefavrite (3)
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const common = require('../../lib/portal/common');
const { mvcInt } = require('./_shared/batch-04-common');

const router = express.Router();

// auth (legacy: Session["Plid"] == null => Json("expired"))
// route-config: customer/listings -> Listings/Index
router.all(['/portal/Listings/Index{/:id}', '/portal/Listings', '/portal/customer/listings{/:id}'], ...ps.customerOr('expired'), (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/Listings/Index.cshtml' });
});

// auth (legacy: Session["Plid"] == null => Json("expired"))
router.all('/portal/Listings/removefavDealid{/:id}', ...ps.customerOr('expired'), asyncHandler(async (req, res) => {
  const dealid = mvcInt(req.p.dealid, 'dealid', 'System.Web.Mvc.JsonResult removefavDealid(Int32)');
  const plid = Number(req.user.plid);
  let str = ''; // eslint-disable-line no-unused-vars
  const dal = new common();
  str = await dal.RemoveFavouriteDeal(dealid, plid);
  res.json(dealid);
}));

// auth (legacy: Session["Plid"] == null => Json("expired"))
router.all('/portal/Listings/removefavrite{/:id}', ...ps.customerOr('expired'), asyncHandler(async (req, res) => {
  const pmid = mvcInt(req.p.pmid, 'pmid', 'System.Web.Mvc.JsonResult removefavrite(Int32)');
  const plid = Number(req.user.plid);
  let str = ''; // eslint-disable-line no-unused-vars
  const dal = new common();
  str = await dal.RemoveFavourite(pmid, plid);
  res.json(pmid);
}));

module.exports = router;
