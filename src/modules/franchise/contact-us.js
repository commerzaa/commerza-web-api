'use strict';
// Ported from Franchise\Controllers\ContactUsController.cs
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const WebsiteDescriptionLib = require('../../lib/franchise/WebsiteDescription');
const WebsiteDetail = WebsiteDescriptionLib.WebsiteDetail || WebsiteDescriptionLib;

const router = express.Router();
const P = '/franchise/ContactUs';

// public
router.all(P + '/Index{/:id}', asyncHandler(async (req, res) => {
  const ViewBag = {};
  const PageUrl = req.protocol + '://' + req.get('host') + req.originalUrl; // HttpContext.Request.Url.ToString()
  ViewBag.Canonical = PageUrl;
  ViewBag.Title = '';
  ViewBag.MetaDesc = '';
  ViewBag.MetaKeyword = '';
  const ObjWebsiteDescription = await WebsiteDetail.GetWebsiteInfo(13);
  if (ObjWebsiteDescription != null) {
    ViewBag.Title = ObjWebsiteDescription.SeoTitle;
    ViewBag.MetaDesc = ObjWebsiteDescription.SeoDescription;
    ViewBag.MetaKeyword = ObjWebsiteDescription.SeoKeyword;
  }
  res.json({ ViewBag, ...ViewBag });
}));

module.exports = router;
