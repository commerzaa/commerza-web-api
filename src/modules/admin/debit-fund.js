'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Debit_Fund.cs (class Debit_FundController, no namespace => /Debit_Fund/...)
// Database: affiliate (Db_Affiliate). Proc Usp_Fund_Transfer; tables member_master, tbl_smsaction, tbl_emailaction.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth } = require('./_shared/admin-session');
const { debitFunds } = require('./_shared/batch06-fund-transfer');

const router = express.Router();
const C = 'Debit_Fund';

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? page, string fromdate, string todate, string Username)
// auth ([SessionExpireCheck] => adminAuth). The parameters are unused by the legacy action.
// route-config: "AdminPanel/debit-fund" -> Debit_Fund/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/debit-fund'], adminAuth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/Debit_Fund/Index.cshtml' });
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult DebitFunds(string Username, decimal Amount, long Id, string Remark, string GAKEY)
// auth ([SessionExpireCheck] => adminAuth)
router.all(`/admin/${C}/DebitFunds{/:id}`, adminAuth, asyncHandler(async (req, res) => debitFunds(req, res, 'Usp_Fund_Transfer')));

module.exports = router;
