'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/LeadershipBonus.cs (LeadershipBonusController)
const express = require('express');
const ps = require('./_shared/portal-session');
const asyncHandler = require('../../middleware/asyncHandler');
const { earningHistory } = require('./_shared/batch-04-common');

const router = express.Router();

// auth (legacy: Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: referral/leadership-bonus -> LeadershipBonus/Index
router.all(['/portal/LeadershipBonus/Index{/:id}', '/portal/LeadershipBonus', '/portal/referral/leadership-bonus{/:id}'], ps.customerAuth, asyncHandler(async (req, res) => {
  // [usp_member_Earning_history] paged history (Member_Master lookup of LOGINID kept, value unused)
  const { Model, ViewBag } = await earningHistory(req);
  res.json({ view: '~/Views/CustomerPanel/LeadershipBonus/Index.cshtml', Model, ...ViewBag });
}));

module.exports = router;
