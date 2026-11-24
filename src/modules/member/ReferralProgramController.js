'use strict';
// Port of Member\Common\Controllers\ReferralProgramController.cs (referralprogramController)
const express = require('express');
const router = express.Router();
const asyncHandler = require('../../middleware/asyncHandler');
const DataUtility = require('../../lib/member/DataUtility');
const WebsiteDetail = require('../../lib/member/WebsiteDescription');

// public (outer landing page)
router.all('/member/referralprogram/Index{/:id}', asyncHandler(async (req, res) => {
  // domain management code: all redirects are commented out in legacy; only the absolute URI is read
  try {
    void (req.protocol + '://' + req.get('host') + req.originalUrl);
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'Index', 0, req.path); } catch (_) { /* ignore */ }
  }
  const PageUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
  const ViewBag = { Canonical: PageUrl, Title: '', MetaDesc: '', MetaKeyword: '' };
  const ObjWebsiteDescription = await WebsiteDetail.GetWebsiteInfo(3);
  if (ObjWebsiteDescription !== null && ObjWebsiteDescription !== undefined) {
    ViewBag.Title = ObjWebsiteDescription.SeoTitle;
    ViewBag.MetaDesc = ObjWebsiteDescription.SeoDescription;
    ViewBag.MetaKeyword = ObjWebsiteDescription.SeoKeyword;
  }
  res.json(ViewBag);
}));

module.exports = router;
