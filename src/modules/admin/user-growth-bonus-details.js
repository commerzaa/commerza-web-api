'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\UserGrowthBonusDetails.cs (class UserGrowthBonusDetailsController => /admin/UserGrowthBonusDetails/...)
// Database: affiliate (Db_Affiliate). Proc USP_WALLERT_STATEMENT (@MODE = 6). Shared body: _shared/batch13-10-common.js userBonusDetails().
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth } = require('./_shared/admin-session');
const { userBonusDetails } = require('./_shared/batch13-10-common');

const router = express.Router();
const C = 'UserGrowthBonusDetails';

// ---------------------------------------------------------------- ActionResult Index(int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/user-growth-bonus-details" -> UserGrowthBonusDetails/Index
// Request.QueryString["myquery"] missing => Response.Redirect("/AdminPanel/ewallet-report"); Convert.ToInt64(Decryptword(myquery)) failing
//   => ErrorInsert('Index') + Response.Redirect("/AdminPanel/ewallet-report"). ViewBag.TOTALGROWTHBONUS = Convert.ToDecimal(@TOTALGROWTHBONUS OUT).
//   No try around the DB part in legacy: errors are unhandled (500).
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/user-growth-bonus-details'], adminAuth, asyncHandler(async (req, res) => {
  return userBonusDetails(req, res, {
    mode: 6, total: 'TOTALGROWTHBONUS', view: '~/Views/AdminPanel/UserGrowthBonusDetails/Index.cshtml', decryptErrorInsert: true, tryWrap: false,
  });
}));

module.exports = router;
