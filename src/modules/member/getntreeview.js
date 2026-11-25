'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Getntreeview.cs (GetntreeviewController) - 1 action: Index */
const express = require('express');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const P = '/member/Getntreeview';

// route-config: referral/tlJCMfGMKLIZLcyQtkL5uQ==
// auth (Session["Plid"] == null => RedirectToAction("Index","Home") handled by the auth middleware)
router.all([`${P}/Index{/:id}`, '/member/referral/tlJCMfGMKLIZLcyQtkL5uQ=='], auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  res.json({ Plid }); // ViewBag.Plid (View ~/Views/CustomerPanel/Getntreeview/Index.cshtml)
}));

module.exports = router;
