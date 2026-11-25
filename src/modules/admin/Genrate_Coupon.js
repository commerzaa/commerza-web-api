'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Genrate_Coupon.cs (class Genrate_CouponController => /admin/Genrate_Coupon/...)
// Database: affiliate (Db_Affiliate).
//
// Coverage: Index -> route ; Genrate_Coupne -> route.
const express = require('express');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth, isAdmin } = require('./_shared/adminSession');
const B = require('./_shared/batch07_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Genrate_Coupon';

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Genrate-Coupon" -> Genrate_Coupon/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Genrate-Coupon'], adminAuth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/Genrate_Coupon/Index.cshtml' });
}));

// ---------------------------------------------------------------- JsonResult Genrate_Coupne(int NoOfCoupon, int KID)
// auth-by-check (legacy: Session["Admin_User"] == null => Response.Redirect("/") (ends the request) - contract kept)
router.all(`/admin/${C}/Genrate_Coupne{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const NoOfCoupon = B.reqInt(req.p.NoOfCoupon, 'NoOfCoupon');
  const KID = B.reqInt(req.p.KID, 'KID');
  if (!isAdmin(req)) return res.json({ redirect: '/' });
  // var Emp_Master = (Employee_Master)Session["Admin_User"]; (unused)
  // [USP_GENRATECOUPPON] @NOOFCOUPON,@KID,@STRRESULT OUT
  const row = await db.procOne(DB, 'USP_GENRATECOUPPON', { NOOFCOUPON: NoOfCoupon, KID });
  const OutputResult = B.outStr(row, 'strresult');
  return res.json(OutputResult);
}));

module.exports = router;
