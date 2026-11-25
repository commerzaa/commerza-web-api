'use strict';
// Ported from ClusterofferShopingPortal\Controllers\ContactUsController.cs (class contact_usController => /portal/contact_us/...)
// Database: shopping (Db_Shopping) - only via WebsiteDetail.
// [CheckResellerTimeout] / [DistributerSessionExpireCheck]: bodies commented out in legacy => no check (ps.portalSession).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const WebsiteDetail = require('../../lib/portal/WebsiteDetail');
const ps = require('./_shared/portal-session');
const { view } = require('./_shared/batch-02-common');

const router = express.Router();
const C = '/portal/contact_us';

// ---------------------------------------------------------------- Index()
// public
// route-config: "contact-us/{action}" (action default Index) -> contact_us/Index
router.all([`${C}/Index{/:id}`, C, '/portal/contact-us', '/portal/contact-us/Index'], ps.portalSession, asyncHandler(async (req, res) => {
  const ViewBag = {};
  // For Domain Management Code Start Here (the redirect logic is commented out in legacy)
  let CompleteUrl = '';
  try {
    CompleteUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    void CompleteUrl;
  } catch (Exp) {
    ViewBag.Message = Exp.message;
  }
  // For Domain Management Code End Here
  const PageUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  ViewBag.Canonical = PageUrl;
  ViewBag.Title = '';
  ViewBag.MetaDesc = '';
  ViewBag.MetaKeyword = '';
  const ObjWebsiteDescription = await WebsiteDetail.GetWebsiteInfo(13);
  if (ObjWebsiteDescription !== null && ObjWebsiteDescription !== undefined) {
    ViewBag.Title = ObjWebsiteDescription.SeoTitle;
    ViewBag.MetaDesc = ObjWebsiteDescription.SeoDescription;
    ViewBag.MetaKeyword = ObjWebsiteDescription.SeoKeyword;
  }
  return view(res, '~/Views/contact_us/Index.cshtml', undefined, ViewBag);
}));

module.exports = router;
