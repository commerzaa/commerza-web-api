'use strict';
/** Ported from Member\Common\Controllers\PartnersController.cs (PartnersController) - 1 action: Index */
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const DataUtility = require('../../lib/member/DataUtility');
const WebsiteDetail = require('../../lib/member/WebsiteDetail');

const router = express.Router();
const P = '/member/Partners';

// route-config: partners
// public
router.all([`${P}/Index{/:id}`, '/member/partners'], asyncHandler(async (req, res) => {
  const ViewBag = {};
  try {
    // "Domain Management" block: only reads the request URL; the catch logs via ErrorInsert
    const CompleteUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    void CompleteUrl;
  } catch (ExpObj) {
    ViewBag.Message = ExpObj.message;
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'Index', 0, req.path); } catch (_) { /* ignore */ }
  }
  const PageUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  ViewBag.Canonical = PageUrl;
  ViewBag.Title = '';
  ViewBag.MetaDesc = '';
  ViewBag.MetaKeyword = '';

  const ObjWebsiteDescription = await WebsiteDetail.GetWebsiteInfo(0);
  if (ObjWebsiteDescription != null) {
    ViewBag.Title = ObjWebsiteDescription.SeoTitle;
    ViewBag.MetaDesc = ObjWebsiteDescription.SeoDescription;
    ViewBag.MetaKeyword = ObjWebsiteDescription.SeoKeyword;
  }
  res.json(ViewBag);
}));

module.exports = router;
