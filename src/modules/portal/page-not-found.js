'use strict';
// Ported from ClusterofferShopingPortal\Controllers\PageNotFoundController.cs (class PageNotFoundController, 1 action)
// Database: shopping (Db_Shopping) - not used.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { requestUrl } = require('./_shared/batch-12-common');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// "Domain Management" block only read Request.Url parts inside try/catch (redirect logic is commented out) -> nothing to port.
async function Index(req, res) {
  const PageUrl = requestUrl(req);
  const ViewBag = {
    Canonical: PageUrl,
    Title: 'Page Not Found : 404 Error',
    MetaDesc: 'Page Not Found : 404 Error',
    MetaKeyword: 'Page Not Found',
    PageNotFound: 'Ok',
  };
  res.json({ view: '~/Views/PageNotFound/Index.cshtml', ViewBag });
}

// public
// route-config: "page-not-found/{action}" (default action Index) -> PageNotFound
router.all(['/portal/PageNotFound', '/portal/PageNotFound/Index{/:id}', '/portal/page-not-found{/Index}'], asyncHandler(Index));

module.exports = router;
