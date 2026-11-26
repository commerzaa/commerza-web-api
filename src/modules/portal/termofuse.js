'use strict';
// Ported from ClusterofferShopingPortal\Controllers\TermofuseController.cs (class termofuseController => /portal/termofuse/...)
// Database: shopping (Db_Shopping), via WebsiteDetail.GetWebsiteInfo.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { seoViewBag, masterpageshow } = require('./_shared/batch-14-common');

const router = express.Router();
const C = 'termofuse';

// ---------------------------------------------------------------- ActionResult Index()
// public ([CheckResellerTimeout], [DistributerSessionExpireCheck] = no check; reads Session["LoginwithMobile"])
// route-config: "terms-of-use/{action}" -> termofuse/Index (default action)
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, '/portal/terms-of-use', '/portal/terms-of-use/Index'], ps.CheckResellerTimeout,
  ps.DistributerSessionExpireCheck, asyncHandler(async (req, res) => {
    const ViewBag = {};
    ViewBag.masterpageshow = masterpageshow(req);
    Object.assign(ViewBag, await seoViewBag(req, 28));
    return res.json({ view: '~/Views/termofuse/Index.cshtml', ...ViewBag });
  }));

// ---------------------------------------------------------------- ActionResult Policy()
// public ([CheckResellerTimeout] = no check)
// route-config: "terms-of-use/{action}" with action Policy (the second MapRoute with the same url; MVC resolves {action} from the URL)
router.all([`/portal/${C}/Policy{/:id}`, '/portal/terms-of-use/Policy'], ps.CheckResellerTimeout, (req, res) => {
  res.json({ view: '~/Views/termofuse/Policy.cshtml' });
});

module.exports = router;
