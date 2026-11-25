'use strict';
/**
 * Port of Member/Common/Controllers/PageNotFoundController.cs (PageNotFoundController)
 * Prefix: /member   DB: affiliate (error log only, via DataUtility.ErrorInsert)
 */
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: page-not-found/{action}  (PageNotFound / Index)
// public
router.all(['/member/PageNotFound/Index{/:id}', '/member/page-not-found{/:action}'], asyncHandler(async (req, res) => {
  // The C# try block only reads Request.Url parts (the domain-redirect code is commented out), so it cannot throw here.
  const PageUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  return res.json({
    view: '~/Views/PageNotFound/Index.cshtml',
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
