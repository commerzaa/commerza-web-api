'use strict';
// Ported from ClusterofferShopingPortal\Controllers\Cart_ListController.cs (class Cart_ListController => /portal/Cart_List/...)
// [DistributerSessionExpireCheck]: body commented out in legacy => no check. The SEO block of the action is commented out in legacy.
// class productdetails {title, value} is a plain property bag (not used by the action).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// public (the cart itself is loaded by other endpoints; the view reads the "pincode" cookie client side)
// route-config: "cart-list" -> Cart_List/Index
router.all(['/portal/Cart_List/Index{/:id}', '/portal/cart-list'], ps.DistributerSessionExpireCheck,
  asyncHandler(async (req, res) => res.json({ view: '~/Views/Cart_List/Index.cshtml' })));

module.exports = router;
