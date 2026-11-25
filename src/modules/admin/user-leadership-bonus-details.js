'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\UserLeadershipBonusDetails.cs (class UserLeadershipBonusDetailsController => /admin/UserLeadershipBonusDetails/...)
// Database: affiliate (Db_Affiliate). Proc USP_WALLERT_STATEMENT (@MODE = 4). Shared body: _shared/batch13-10-common.js userBonusDetails().
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth } = require('./_shared/admin-session');
const { userBonusDetails } = require('./_shared/batch13-10-common');

const router = express.Router();
const C = 'UserLeadershipBonusDetails';

// ---------------------------------------------------------------- ActionResult Index(int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/user-leadership-bonus-details" -> UserLeadershipBonusDetails/Index
// Request.QueryString["myquery"] missing => Response.Redirect("/AdminPanel/ewallet-report"); Convert.ToInt64(Decryptword(myquery)) failing
//   => ErrorInsert('Index') + Response.Redirect("/AdminPanel/ewallet-report"). ViewBag.TOTALLEADERSHIP = Convert.ToDecimal(@TOTALLEADERSHIP OUT).
//   DB errors => ErrorInsert('USP_WALLERT_STATEMENT') + PageNotFound view.
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/user-leadership-bonus-details'], adminAuth, asyncHandler(async (req, res) => {
  return userBonusDetails(req, res, {
    mode: 4, total: 'TOTALLEADERSHIP', view: '~/Views/AdminPanel/UserLeadershipBonusDetails/Index.cshtml', decryptErrorInsert: true, tryWrap: true,
  });
}));

module.exports = router;
