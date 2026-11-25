'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\DebitIncomeWallet.cs
// (class Common.Controllers.AdminPanel.DebitIncomeWalletController => /DebitIncomeWallet/...). Database: affiliate (Db_Affiliate).
// Proc USP_Income_TRANSFER; tables member_master, member_performance, tbl_smsaction, tbl_emailaction.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const { nStr, col, str } = require('./_shared/batch06-common');
const { debitFunds } = require('./_shared/batch06-fund-transfer');

const router = express.Router();
const DB = 'affiliate';
const C = 'DebitIncomeWallet';

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? page, string fromdate, string todate, string Username)
// auth ([SessionExpireCheck] => adminAuth). The parameters are unused by the legacy action.
// route-config: "AdminPanel/Debit-Commission" -> DebitIncomeWallet/Index (this route precedes the identical url mapped to Debit_Commission)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Debit-Commission'], adminAuth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/DebitIncomeWallet/Index.cshtml' });
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult DebitFunds(string Username, decimal Amount, long Id, string Remark, string GAKEY)
// auth ([SessionExpireCheck] => adminAuth)
router.all(`/admin/${C}/DebitFunds{/:id}`, adminAuth, asyncHandler(async (req, res) => debitFunds(req, res, 'USP_Income_TRANSFER')));

// ---------------------------------------------------------------- JsonResult GetUsernameAndEmail(string memberid)
// auth (PORT-NOTE: legacy had no session check; exposes member e-mail / wallet balances => adminAuth)
router.all(`/admin/${C}/GetUsernameAndEmail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const memberid = nStr(req.p.memberid);
  let getval = 'Invalid';
  try {
    // legacy concatenated memberid into the SQL (injection) - parameterised here
    const dr = await db.queryOne(DB, `select mm.regno, coalesce(mm.fname,'') || ' ' || coalesce(mm.mname,'') || ' ' || coalesce(mm.lname,'') as mmbername,
        mm.emailid, coalesce(mp.availablecommissionwallet,0) as availablecommissionwallet, coalesce(availablecoinwallet,0) as availablecoinwallet,
        coalesce(available_fund,0) as available_fund
      from member_master mm inner join member_performance mp on mp.regno = mm.regno where mm.username = @memberid limit 1`, { memberid });
    if (dr) {
      getval = str(col(dr, 'regNo')) + '^' + str(col(dr, 'MMBERNAME')) + '^' + str(col(dr, 'EMAILID')) + '^' + str(col(dr, 'AVAILABLECOMMISSIONWALLET'))
        + '^' + str(col(dr, 'AvailableCoinWallet')) + '^' + str(col(dr, 'AVAILABLE_FUND'));
    } else {
      getval = 'Invalid';
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'GetUsernameAndEmail');
  }
  return res.json(getval);
}));

module.exports = router;
