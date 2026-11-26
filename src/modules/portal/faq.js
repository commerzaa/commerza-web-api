'use strict';
// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\FaqController.cs (class faqController => /portal/faq/...)
// Database: shopping (Db_Shopping). [CheckResellerTimeout]/[DistributerSessionExpireCheck] = no check (bodies commented out in legacy).
// FAQMaster / FAQTopic / FAQAnswer are plain property bags (not ported).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const DAL_RegistrationOrLogin = require('../../lib/portal/DAL_RegistrationOrLogin');
const { masterpageshow } = require('./_shared/batch-09-common');

const router = express.Router();

// ---------------------------------------------------------------- Index(string id)
// route-config: "faq/{action}" (default action Index) -> /portal/faq
// public
router.all(['/portal/faq/Index{/:id}', '/portal/faq'], ps.DistributerSessionExpireCheck, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const objFAQ_Topic = await DAL_RegistrationOrLogin.GET_FAQTPOIC();
  ViewBag.FAQTopic = objFAQ_Topic;
  ViewBag.masterpageshow = masterpageshow(req);
  return res.json({ view: '~/Views/faq/Index.cshtml', ...ViewBag });
}));

module.exports = router;
