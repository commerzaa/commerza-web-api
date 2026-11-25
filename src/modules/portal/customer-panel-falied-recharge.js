'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Falied_Recharge.cs (Falied_RechargeController)
// Actions: Index (1). [DistributerSessionExpireCheck] has a commented-out body in legacy => no extra check.
const express = require('express');
const ps = require('./_shared/portal-session');
const asyncHandler = require('../../middleware/asyncHandler');
const { rechargeReport } = require('./_shared/batch-04-common');

const router = express.Router();

// auth (legacy: Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: customer/Falied_Recharge -> Falied_Recharge/Index
router.all(['/portal/Falied_Recharge/Index{/:id}', '/portal/Falied_Recharge', '/portal/customer/Falied_Recharge{/:id}'], ps.customerAuth, asyncHandler(async (req, res) => {
  // DBO.USP_GET_CUSTOMER_ALLRECHARGE_REPORTS with @STATUS = "2"
  const { Model, ViewBag } = await rechargeReport(req, '2');
  res.json({ view: '~/Views/CustomerPanel/Falied_Recharge/Index.cshtml', Model, ...ViewBag });
}));

module.exports = router;
