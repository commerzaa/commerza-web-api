'use strict';
// Ported from Shoping Portal Merchant Panel\Controllers\CustomerPanel\OuterFreeBusinessKeywords.cs  (database: shopping - Db_Shopping)
const express = require('express');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const DAL_BusinessListing = require('../../lib/merchant/DAL_BusinessListing');

const router = express.Router();

async function Index(req, res) {
  // Session["PLID"] == null -> auth middleware
  let CountryId = 0;
  CountryId = req.user.cid;
  const Obj = {};
  Obj.LiGetKeywordForBusinessListing = await DAL_BusinessListing.GetKeyword(req.user.plid);
  Obj.LiSTATE = await DAL_BusinessListing.GetSTATE(CountryId);
  Obj.LiCity = await DAL_BusinessListing.GetCity(CountryId);
  res.json({ view: '~/Views/OuterFreeBusinessKeywords/Index.cshtml', Model: Obj });
}

// auth
router.all('/merchant/OuterFreeBusinessKeywords/Index{/:id}', auth, asyncHandler(Index));

module.exports = router;
