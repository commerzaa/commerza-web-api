'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\UserGrowthReferralBonusDetails.cs (class UserGrowthReferralBonusDetailsController => /admin/UserGrowthReferralBonusDetails/...)
// Database: affiliate (Db_Affiliate). Proc USP_WALLERT_STATEMENT (@MODE = 3). Shared body: _shared/batch13-10-common.js userBonusDetails().
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth } = require('./_shared/admin-session');
const { userBonusDetails } = require('./_shared/batch13-10-common');

const router = express.Router();
const C = 'UserGrowthReferralBonusDetails';

// ---------------------------------------------------------------- ActionResult Index(int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/user-growth-referral-bonus-details" -> UserGrowthReferralBonusDetails/Index
// Request.QueryString["myquery"] missing => Response.Redirect("/AdminPanel/ewallet-report"); Convert.ToInt64(Decryptword(myquery)) failing
//   => (no ErrorInsert) Response.Redirect("/AdminPanel/ewallet-report"). ViewBag.TOTALGROWTHREFERRAL = Convert.ToDecimal(@TOTALGROWTHREFERRAL OUT).
//   DB errors => ErrorInsert('USP_WALLERT_STATEMENT') + PageNotFound view.
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/user-growth-referral-bonus-details'], adminAuth, asyncHandler(async (req, res) => {
  return userBonusDetails(req, res, {
    mode: 3, total: 'TOTALGROWTHREFERRAL', view: '~/Views/AdminPanel/UserGrowthReferralBonusDetails/Index.cshtml', decryptErrorInsert: false, tryWrap: true,
  });
}));

module.exports = router;
