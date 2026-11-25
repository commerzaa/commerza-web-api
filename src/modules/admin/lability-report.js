'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\LabilityReport.cs (class LabilityReportController => /admin/LabilityReport/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');

const router = express.Router();
const DB = 'affiliate';
const C = 'LabilityReport';

/** class LabilityReport */
const LABILITY_PROPS = ['Lability', 'Investment', 'Profit', 'Date', 'COLOR'];

// ---------------------------------------------------------------- Index(string fromdate, string todate)  => View only (parameters unused)
// public (legacy had no session check and no server-side logic)
// route-config: "AdminPanel/LabilityReport" -> LabilityReport/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/LabilityReport'], adminAuth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/LabilityReport/Index.cshtml' });
}));

// ---------------------------------------------------------------- JsonResult Lability()
// auth (legacy had NO session check; it returns company-wide liability/investment/profit figures => protected, see report)
router.all(`/admin/${C}/Lability{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  // DBO.USP_LABILITYREPORT @MODE  (@MODE = "1")
  const rows = await db.proc(DB, 'USP_LABILITYREPORT', { MODE: '1' });
  res.json(mapRows(rows, LABILITY_PROPS));
}));

module.exports = router;
