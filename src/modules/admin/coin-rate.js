'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\CoinRate.cs (class CoinRateController => /CoinRate/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch04-b-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'CoinRate';

/** class CoinRate */
const PROPS = ['Row', 'TAIRM', 'INR', 'Emp_Name', 'ActivityReport', 'Status'];

// ---------------------------------------------------------------- Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Coin-Rate" -> CoinRate/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Coin-Rate'], adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  try {
    // Select INR From Tbl_Atc_INR_Ratio_Master where Status=1  (SqlQuery<decimal>().FirstOrDefault() => 0 when no row)
    const r = await db.queryOne(DB, 'select inr from tbl_atc_inr_ratio_master where status = 1 limit 1', {});
    ViewBag.COINRATE = r ? r.inr : 0;
    const coinrate = mapRows(await db.proc(DB, 'Usp_CoinRate', { Mode: '2' }), PROPS);
    return res.json({ view: '~/Views/AdminPanel/CoinRate/Index.cshtml', Model: coinrate, ...ViewBag });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'ChangePassword');
    return res.json({ view: '~/Views/AdminPanel/CoinRate/Index.cshtml', Model: null, ...ViewBag });
  }
}));

// ---------------------------------------------------------------- JsonResult UpdateATCRateAndWithdrawalSettings(string ATCRate, string ATCRates)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/UpdateATCRateAndWithdrawalSettings{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const userid = req.user.emp_id;
  const out = await db.proc(DB, 'Usp_CoinRate', {
    ATCRate: B.sp(req, 'ATCRate'), ATCRates: B.sp(req, 'ATCRates'), UserId: userid, Mode: '1',
  });
  const OutPutMessage = B.str(B.outVal(out, 'IntResult')); // IntResult.Value.ToString() (DBNull => "")
  return res.json(OutPutMessage);
}));

module.exports = router;
