'use strict';
// Ported from Member/Common/Controllers/ReferToFriendController.cs  (ReferToFriendController, 1 action)
const express = require('express');
const router = express.Router();
const asyncHandler = require('../../middleware/asyncHandler');
const WebsiteDetail = require('../../lib/member/WebsiteDescription');

const BASE = '/member/ReferToFriend';

// Index: no session check -> public. The "Domain Management" try/catch only reads the request URL, it cannot fail in Express.
// route-config: refer-to-friend
// public
router.all([`${BASE}/Index{/:id}`, BASE, '/member/refer-to-friend'], asyncHandler(async (req, res) => {
  const ViewBag = {};
  ViewBag.Canonical = req.protocol + '://' + req.get('host') + req.originalUrl; // HttpContext.Request.Url.ToString()
  ViewBag.Title = '';
  ViewBag.MetaDesc = '';
  ViewBag.MetaKeyword = '';
  const ObjWebsiteDescription = await WebsiteDetail.GetWebsiteInfo(0);
  if (ObjWebsiteDescription) {
    ViewBag.Title = ObjWebsiteDescription.SeoTitle;
    ViewBag.MetaDesc = ObjWebsiteDescription.SeoDescription;
    ViewBag.MetaKeyword = ObjWebsiteDescription.SeoKeyword;
  }
  res.json({ view: '~/Views/ReferToFriend/Index.cshtml', ViewBag });
}));

module.exports = router;
