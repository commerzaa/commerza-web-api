'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/BuyPackage.cs  (BuyPackageController, 1 action)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const BASE = '/member/BuyPackage';

// Index: Session["Plid"] == null => RedirectToAction("Index","Home") => auth middleware
// auth
router.all([`${BASE}/Index{/:id}`, BASE], auth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/BuyPackage/Index.cshtml' });
}));

module.exports = router;
