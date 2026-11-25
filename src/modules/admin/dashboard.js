'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Dashboard.cs (class DashboardController => /admin/Dashboard/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');

const router = express.Router();
const DB = 'affiliate';
const C = 'Dashboard';

/** C# model property lists (Dashboard.cs) */
const MEMBER_DETAILS_PROPS = ['ID', 'DATE', 'ACTIVEMEMBER', 'INACTIVEMEMBER', 'BLOCKMEMBER'];
const ADMINDASHBOARD_CONTENT_PROPS = ['ADCID', 'SECTIONNAME', 'STATUS'];
const WALLET_SUMMARY_PROPS = ['Ewallet', 'GrowthWallet', 'ShoppingWallet', 'CommissionWallet', 'PerEwallet', 'PerGrowthWallet', 'PerShoppingWallet',
  'PerCommissionWallet'];
const EWALLET_MEMBER_PROPS = ['USERNAME', 'Available_Fund'];
const GROWTHWA_MEMBER_PROPS = ['USERNAME', 'AvailableCoinWallet'];
const SHOPPINGWA_MEMBER_PROPS = ['USERNAME', 'TotalAvailableShoppingPoints'];
const COMMISSIONWA_MEMBER_PROPS = ['USERNAME', 'AvailableCommissionWallet'];
const DIRECT_INCOMEEARNER_PROPS = ['USERNAME', 'DIRECTINCOME', 'PERCENTAGE'];
const ROI_INCOMEEARNER_PROPS = ['USERNAME', 'ROI', 'PERCENTAGE'];
const LEVEL_INCOMEEARNER_PROPS = ['USERNAME', 'LEVELINCOME', 'PERCENTAGE'];
// (MemberLogHistory1, VISITORGRAPH, IncomeType, INCOMEREPORT, status, Dynamic_wallet: model classes declared in Dashboard.cs, unused here)

/** DBO.USPALLMEMBERDETAILS @MODE */
const mode = (m) => db.proc(DB, 'USPALLMEMBERDETAILS', { MODE: m });

/** SqlQuery<T>(...).FirstOrDefault() for a scalar T: first column of the first row; no row => default(T) */
async function first(m, kind) {
  const rows = await mode(m);
  if (!rows.length) return kind === 'string' ? null : 0;
  const v = rows[0][Object.keys(rows[0])[0]];
  if (kind === 'string') return v === null || v === undefined ? null : String(v);
  if (v === null || v === undefined) {
    throw new Error(`The cast to value type 'System.${kind === 'int' ? 'Int32' : 'Decimal'}' failed because the materialized value is null.`);
  }
  return Number(v);
}

// ---------------------------------------------------------------- ActionResult Index()
// auth (admin dashboard; legacy had no session check - PORT-NOTE: protected with adminAuth)
// route-config: "AdminPanel/Dashboard" -> Dashboard/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Dashboard'], adminAuth, asyncHandler(async (req, res) => {
  const ds = {}; // new DataSet() (empty model)
  const ViewBag = {};
  ViewBag.TotalMember = await first(1, 'int');
  ViewBag.InactiveMember = await first(2, 'int');
  ViewBag.ActiveMember = await first(3, 'int');
  ViewBag.BlockMember = await first(4, 'int');
  ViewBag.EWalletRequestPending = await first(5, 'int');
  ViewBag.TotalSales = await first(6, 'decimal');
  ViewBag.PendingKYC = await first(7, 'int');
  ViewBag.ApprovedKYC = await first(8, 'int');
  ViewBag.NonKYC = await first(9, 'int');
  ViewBag.PerPendingKYC = await first(10, 'decimal');
  ViewBag.PerApprovedKYC = await first(11, 'decimal');
  ViewBag.PerNonKYC = await first(12, 'decimal');
  ViewBag.MaxLoginCount = await first(13, 'int');
  ViewBag.MaxLoginDate = await first(14, 'string');
  ViewBag.MinLoginCount = await first(15, 'int');
  ViewBag.MinLoginDate = await first(16, 'string');
  ViewBag.DirectIncome = await first(17, 'decimal');
  ViewBag.BinaryIncome = await first(18, 'decimal');
  ViewBag.ROI = await first(19, 'decimal');
  ViewBag.LevelIncome = await first(20, 'decimal');
  ViewBag.DirectIncomePer = await first(21, 'decimal');
  ViewBag.BinaryIncomePer = await first(22, 'decimal');
  ViewBag.ROIPer = await first(23, 'decimal');
  ViewBag.LevelIncomePer = await first(24, 'decimal');
  ViewBag.RejectedKYC = await first(25, 'int');
  ViewBag.PerRejectedKYC = await first(26, 'decimal');
  const ws = await mode(27);
  ViewBag.Wallet_Summary = ws.length ? mapRow(ws[0], WALLET_SUMMARY_PROPS) : null;
  ViewBag.Ewallet_Member = mapRows(await mode(28), EWALLET_MEMBER_PROPS);
  ViewBag.GrowthWa_Member = mapRows(await mode(29), GROWTHWA_MEMBER_PROPS);
  ViewBag.ShoppingWa_Member = mapRows(await mode(30), SHOPPINGWA_MEMBER_PROPS);
  ViewBag.CommissionWa_Member = mapRows(await mode(31), COMMISSIONWA_MEMBER_PROPS);
  ViewBag.Direct_IncomeEarner = mapRows(await mode(32), DIRECT_INCOMEEARNER_PROPS);
  ViewBag.Roi_IncomeEarner = mapRows(await mode(33), ROI_INCOMEEARNER_PROPS);
  ViewBag.Levle_IncomeEarner = mapRows(await mode(34), LEVEL_INCOMEEARNER_PROPS); // (sic) key "Levle_IncomeEarner"
  ViewBag.LastRunPayout = await first(35, 'string');
  return res.json({ view: '~/Views/AdminPanel/Dashboard/Index.cshtml', Model: ds, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult MemberDetails()
// auth (admin dashboard data; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/MemberDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const LoginGraph = mapRows(await db.proc(DB, 'USP_Member_DETAILS_Dashboard', {}), MEMBER_DETAILS_PROPS);
  return res.json(LoginGraph);
}));

// ---------------------------------------------------------------- JsonResult DashboardDetail()
// auth (admin dashboard config; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/DashboardDetail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.query(DB, 'select adcid, sectionname, status from tbl_admindashboard_content where status = 1', {});
  return res.json(mapRows(rows, ADMINDASHBOARD_CONTENT_PROPS));
}));

module.exports = router;
