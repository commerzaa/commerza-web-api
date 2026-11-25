'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MyPlan.cs (class MyPlanController => /MyPlan/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const LEVEL_INCOME_SLAB = require('../../lib/admin/LEVEL_INCOME_SLAB');
const GROWTH_LEVEL_INCOME_SLAB = require('../../lib/admin/GROWTH_LEVEL_INCOME_SLAB');
const { adminAuth, getAdminMenu } = require('./_shared/admin-session');
const { DB, firstCol } = require('./_shared/batch10-common');

const router = express.Router();
const C = 'MyPlan';

const KIT_PROPS = ['KID', 'PCODE', 'TITLE', 'MININVESTMENT', 'MAXINVESTMENT', 'BVPERCENTAGE', 'NOOFDAYSFORACTIVATION', 'ROI_PERCENTAGEPERDAY',
  'CAPPING', 'SUBSCRIPTIONDETAILS', 'ISACTIVE'];
const ROLLUP_PROPS = ['TRISID', 'Row', 'InvestmentFromSlot', 'InvestmentToSlot', 'RollupIncomePercentage', 'Emp_Name', 'ActivityReport',
  'NOOfRequiredMember', 'MinInvestMents'];
const DIRECT_PROPS = ['Row', 'TKSMID', 'InvestmentFromSlot', 'InvestmentToSlot', 'ReferralIncomePercentage', 'Emp_Name', 'ActivityReport',
  'NoOfDirectActiveMember'];
const BINARY_PROPS = ['TBISID', 'LeftVolume', 'RightVolume', 'MatchingVolume', 'Type', 'TypeDescription', 'Active', 'Status', 'Row', 'Emp_Name',
  'ActivityReport'];
const BINARY_LEVEL_PROPS = ['Row', 'Title', 'Income', 'NoOfDownlineMember', 'ActivityReport', 'Emp_Name', 'TBLISID', 'LEVEL', 'Type', 'Status',
  'GPV', 'REFLISID', 'REFCOUNT', 'SelfInvestments', 'SelfActivation'];
const SUBMENU_PROPS = ['INT_ID', 'SECTION', 'SECTION_NAME', 'TDS_WITHKYC', 'INT_STATUS', 'DTM_DATE', 'DTM_UPDATE_DATE', 'TDS_WITHOUTKYC',
  'ADMINCHARGE_WITHKYC', 'ADMINCHARGE_WITHOUTKYC', 'DEDUCTION_TIME_ID', 'DEDUCTION_TIME_NAME', 'IS_VISIBLE', 'CreditedInWalletTypeName',
  'CreditedInWalletTypeid', 'IsWithdrawalIncome', 'TITLE'];

/** SqlQuery<decimal>(...).FirstOrDefault() => 0 when no row */
const decOrZero = (v) => (v === null || v === undefined ? 0 : v);

// public decimal GST()
async function GST() {
  return decOrZero(firstCol(await db.query(DB,
    "select (limits)::numeric(10,2) as value from settings where active = 1 and caption = 'IsTaxApplicableOnPackagePrice' limit 1", {})));
}
// public decimal CoinRates()
async function CoinRates() {
  return decOrZero(firstCol(await db.query(DB, 'select inr from tbl_atc_inr_ratio_master where status = 1 limit 1', {})));
}
// public decimal BinaryIncome()
async function BinaryIncome() {
  return decOrZero(firstCol(await db.query(DB,
    "select (limits)::numeric(10,2) as value from settings where active = 1 and caption = 'BinaryIncome' limit 1", {})));
}

// ---------------------------------------------------------------- Index(string sortOrder, string currentFilter, string searchString, string ddlOption, int? page)
// auth (Session["Admin_User"] == null || Session["Admin_User_Menu"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/My-Plan" -> MyPlan/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/My-Plan'], adminAuth, asyncHandler(async (req, res) => {
  if ((await getAdminMenu(req)) === null) return res.json({ redirect: '/adminlogin/Index' });
  const ViewBag = {};
  ViewBag.GST = await GST();
  ViewBag.COINRATE = await CoinRates();
  ViewBag.BinaryIncome = await BinaryIncome();
  const ObjKit_Master = mapRows(await db.proc(DB, 'USP_EDITPACKAGE', { KID: '0' }), KIT_PROPS);
  ViewBag.RollupIncomes = mapRows(await db.query(DB,
    'select trisid, investmentfromslot, investmenttoslot, rollupincomepercentage, noofrequiredmember, mininvestments from tbl_rollup_income_slab where active = 1',
    {}), ROLLUP_PROPS);
  await db.proc(DB, 'Usp_RollupIncomeSlab', { Mode: 2 }); // result assigned to a local and never used (kept for side effects)
  ViewBag.DirectIncome = mapRows(await db.query(DB,
    'select tksmid, investmentfromslot, investmenttoslot, referralincomepercentage, noofdirectactivemember from tbl_direct_income_slab where active = 1',
    {}), DIRECT_PROPS);
  await db.proc(DB, 'Usp_DirectIncomeSlab', { Mode: 2 }); // result never used (kept)
  // DB._LEVEL_INCOME_SLAB.Where(a => a.STATUS)
  ViewBag.ObjLevel = LEVEL_INCOME_SLAB.mapAll(await db.query(DB, 'select * from level_income_slab where status = true', {}));
  // DB._GROWTH_LEVEL_INCOME_SLAB.Where(a => a.STATUS)
  ViewBag.Roi = GROWTH_LEVEL_INCOME_SLAB.mapAll(await db.query(DB, 'select * from growth_level_income_slab where status = true', {}));
  ViewBag.BinaryIncomes = mapRows(await db.query(DB,
    'select tbisid, typedescription, leftvolume, rightvolume, matchingvolume, type, active, status from tbl_binary_income_slab', {}), BINARY_PROPS);
  ViewBag.BinaryIncomeLevel = mapRows(await db.query(DB,
    'select tblisid, level, title, type, income, status, gpv, reflisid, refcount, noofdownlinemember, selfinvestments, selfactivation from tbl_binary_level_income_slab',
    {}), BINARY_LEVEL_PROPS);
  ViewBag.SubMenuTitle = mapRows(await db.proc(DB, 'USP_GETSUBMENUTITLEBYSID', {}), SUBMENU_PROPS);
  ViewBag.Logintype = 'Admin';
  return res.json({ view: '~/Views/AdminPanel/MyPlan/Index.cshtml', Model: ObjKit_Master, ...ViewBag });
}));

// ---------------------------------------------------------------- public decimal GST() / CoinRates() / BinaryIncome()
// (public non-ActionResult methods are MVC actions: the decimal is written as text/plain content)
// auth (legacy had no session check; admin settings => adminAuth)
router.all(`/admin/${C}/GST{/:id}`, adminAuth, asyncHandler(async (req, res) => { res.type('text/plain').send(String(await GST())); }));
// auth
router.all(`/admin/${C}/CoinRates{/:id}`, adminAuth, asyncHandler(async (req, res) => { res.type('text/plain').send(String(await CoinRates())); }));
// auth
router.all(`/admin/${C}/BinaryIncome{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  res.type('text/plain').send(String(await BinaryIncome()));
}));

module.exports = router;
