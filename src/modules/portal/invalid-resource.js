'use strict';
// Ported from ClusterofferShopingPortal/Controllers/InvalidResourceController.cs
// Actions: Index (1)   DB: Db_Shopping => 'shopping' (unused)
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const c10 = require('./_shared/batch-10-common');

const router = express.Router();

// ---- Index(string URL) -----------------------------------------------------------------------------------
// public
router.all(['/portal/InvalidResource/Index{/:id}', '/portal/InvalidResource',
  '/portal/unauthorized-access', // route-config: "unauthorized-access" -> InvalidResource/Index
], asyncHandler(async (req, res) => {
  const PageUrl = c10.fullUrl(req);
  res.json({
    ViewBag: {
      Canonical: PageUrl,
      Title: 'Page Not Found : 404 Error',
      MetaDesc: 'Page Not Found : 404 Error',
      MetaKeyword: 'Page Not Found',
      PageNotFound: 'Ok',
    },
  });
}));

module.exports = router;
