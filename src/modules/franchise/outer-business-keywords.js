'use strict';
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const DAL_BusinessListing = require('../../lib/franchise/DAL_BusinessListing');
// Port of Franchise\Controllers\OuterBusinessKeywords.cs (1 action)
// route-config: outer-business-keywords -> Index ; franchisee/my-category -> Index
// auth
router.all(['/franchise/OuterBusinessKeywords/Index{/:id}', '/franchise/outer-business-keywords', '/franchise/franchisee/my-category'], auth, asyncHandler(async (req, res) => {
  const CountryId = req.user.cid !== undefined && req.user.cid !== null ? req.user.cid : 0;
  const Obj = {};
  Obj.LiGetKeywordForBusinessListing = await DAL_BusinessListing.GetKeyword();
  Obj.LiSTATE = await DAL_BusinessListing.GetSTATE(CountryId);
  Obj.LiCity = await DAL_BusinessListing.GetCity(CountryId);
  res.json({ Model: Obj, Layout: '~/Views/Shared/_DealsRecordNotFoundLayout.cshtml' });
}));

module.exports = router;
