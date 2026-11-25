'use strict';
// Ported from Franchise\Controllers\CustomerPanel\OuterFreeBusinessKeywords.cs  (database: shopping — Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const DAL_BusinessListing = require('../../lib/franchise/DAL_BusinessListing');

const router = express.Router();

async function Index(req, res) {
  // Session["PLID"] == null -> auth middleware
  let CountryId = 0;
  CountryId = req.user.cid;
  const Obj = {};
  Obj.LiGetKeywordForBusinessListing = await DAL_BusinessListing.GetKeyword();
  Obj.LiSTATE = await DAL_BusinessListing.GetSTATE(CountryId);
  Obj.LiCity = await DAL_BusinessListing.GetCity(CountryId);
  res.json({ Model: Obj });
}

// auth
router.all('/franchise/OuterFreeBusinessKeywords/Index{/:id}', auth, asyncHandler(Index));
// route-config: outer-business-listing
router.all('/franchise/outer-business-listing{/:id}', auth, asyncHandler(Index));

module.exports = router;
