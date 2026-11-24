'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Default1_New_Dashboard.cs (Default1_New_DashboardController)
 * Prefix: /member   DB: affiliate (no DB access in this controller)
 */
const express = require('express');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');

const router = express.Router();

const toInt = (v, d) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: referral/PQ_slash_o_plus_j_plus_QNFZ5r4CiihK9Cwdsfsdfers==  (Default1_New_Dashboard / Index)
// auth (legacy: Session["Plid"] == null => RedirectToAction("Index","Home"))
router.all(['/member/Default1_New_Dashboard/Index{/:id}', '/member/referral/PQ_slash_o_plus_j_plus_QNFZ5r4CiihK9Cwdsfsdfers=='], auth, asyncHandler(async (req, res) => {
  const page = toInt(req.p.page, 0);
  const ActivationStatus = toInt(req.p.ActivationStatus, 0);
  // Session["FavoriteURL"] kept in the server-side store
  const FavoriteURL = sessionStore.get(req, 'FavoriteURL');
  if (FavoriteURL !== undefined && FavoriteURL !== null) {
    return res.json({ redirect: String(FavoriteURL) }); // Response.Redirect(Session["FavoriteURL"])
  }
  return res.json({ view: '~/Views/CustomerPanel/Default1_New_Dashboard/Index.cshtml', ViewBag: { page, ActivationStatus } });
}));

module.exports = router;
