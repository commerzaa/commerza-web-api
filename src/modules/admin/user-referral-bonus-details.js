'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\UserReferralBonusDetails.cs (class UserReferralBonusDetailsController => /admin/UserReferralBonusDetails/...)
// Database: affiliate (Db_Affiliate). Proc USP_WALLERT_STATEMENT (@MODE = 2). Shared body: _shared/batch13-10-common.js userBonusDetails().
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth } = require('./_shared/admin-session');
const { userBonusDetails } = require('./_shared/batch13-10-common');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { nStr } = require('./_shared/batch11-common');

const router = express.Router();
const C = 'UserReferralBonusDetails';

// ---------------------------------------------------------------- ActionResult Index(int? page, string myquery)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/user-referral-bonus-details" -> UserReferralBonusDetails/Index
// Request.QueryString["myquery"] missing => Response.Redirect("/AdminPanel/ewallet-report"); Convert.ToInt64(Decryptword(myquery)) failing
//   => ErrorInsert('Index') + Response.Redirect("/AdminPanel/ewallet-report"). ViewBag.TOTALREFERRAL = Convert.ToDecimal(@TOTALREFERRAL OUT).
//   DB errors => ErrorInsert('USP_WALLERT_STATEMENT') + PageNotFound view.
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/user-referral-bonus-details'], adminAuth, asyncHandler(async (req, res) => {
  // string QueryString = UtilityClass.Decryptword(myquery);  (result overwritten below; runs before the session check in legacy)
  const QueryString = await UtilityClass.Decryptword(nStr(req.p.myquery)); // eslint-disable-line no-unused-vars
  return userBonusDetails(req, res, {
    mode: 2, total: 'TOTALREFERRAL', view: '~/Views/AdminPanel/UserReferralBonusDetails/Index.cshtml', decryptErrorInsert: true, tryWrap: true,
  });
}));

module.exports = router;
