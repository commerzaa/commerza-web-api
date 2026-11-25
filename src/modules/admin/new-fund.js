'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\NewFundController.cs (class NewFundController => /NewFund/...)
// Database: affiliate (Db_Affiliate) - no DB access in this controller.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth } = require('./_shared/admin-session');

const router = express.Router();
const C = 'NewFund';

// ---------------------------------------------------------------- Index() => return View();
// auth (PORT-NOTE: legacy had no session check; admin panel page => adminAuth per coordinator auth rule)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/NewFund/Index.cshtml' });
}));

module.exports = router;
