'use strict';
/**
 * Port of Merchant Panel Controllers/OuterBusinessKeywords.cs (OuterBusinessKeywordsController) - 1 action
 * DB access is inside DAL_BusinessListing (lib).
 */
const express = require('express');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DAL_BusinessListing = require('../../lib/merchant/DAL_BusinessListing');

const router = express.Router();

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: outer-business-keywords -> Index ; merchant/my-category -> Index
// auth  (legacy: Session["PLID"] null => RedirectToAction("Index","Home"))
router.all(['/merchant/OuterBusinessKeywords/Index{/:id}', '/merchant/outer-business-keywords', '/merchant/merchant/my-category', '/merchant/my-category'], auth, asyncHandler(async (req, res) => {
  let CountryId = 0;
  if (req.user) CountryId = Number(req.user.cid || 0);
  const Obj = {};
  Obj.LiGetKeywordForBusinessListing = await DAL_BusinessListing.GetKeyword(Number(req.user.plid));
  Obj.LiSTATE = await DAL_BusinessListing.GetSTATE(CountryId);
  Obj.LiCity = await DAL_BusinessListing.GetCity(CountryId);
  if (sessionStore.get(req, 'LoginwithMobile') !== undefined && sessionStore.get(req, 'LoginwithMobile') !== null) {
    return res.json({ view: '~/Views/OuterBusinessKeywords/Index.cshtml', Model: Obj });
  }
  return res.json({ view: '~/Views/OuterBusinessKeywords/Index.cshtml', Layout: '~/Views/Shared/_DealsRecordNotFoundLayout.cshtml', Model: Obj });
}));

module.exports = router;
