'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Completed_Recharge.cs (Completed_RechargeController)
// Actions: Index (1). [DistributerSessionExpireCheck] has a commented-out body in legacy => no extra check.
const express = require('express');
const ps = require('./_shared/portal-session');
const asyncHandler = require('../../middleware/asyncHandler');
const { rechargeReport } = require('./_shared/batch-04-common');

const router = express.Router();

// auth (legacy: Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: customer/Completed_Recharge -> Completed_Recharge/Index
router.all(['/portal/Completed_Recharge/Index{/:id}', '/portal/Completed_Recharge', '/portal/customer/Completed_Recharge{/:id}'], ps.customerAuth, asyncHandler(async (req, res) => {
  // DBO.USP_GET_CUSTOMER_ALLRECHARGE_REPORTS with @STATUS = "1"
  const { Model, ViewBag } = await rechargeReport(req, '1');
  res.json({ view: '~/Views/CustomerPanel/Completed_Recharge/Index.cshtml', Model, ...ViewBag });
}));

module.exports = router;
