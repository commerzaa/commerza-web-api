'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Manager_Rank.cs (class Manager_RankController => /Manager_Rank/...)
// Database: affiliate (Db_Affiliate). Procs: Usp_Memeber_Rank, Usp_Add_Manager.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nStr, outStr } = require('./_shared/batch09-common');

const router = express.Router();
const C = 'Manager_Rank';

/** class ManagerRank */
const PROPS = ['Mobile', 'USERNAME', 'EMAILID', 'SPONSERID', 'totalCount', 'Help_Amount', 'Pending_Amount', 'Process_AmountPH', 'Confirm_AmountPH',
  'Total_GH', 'GHPAmount', 'GHTAmount', 'GHCAmount', 'GHRAmount', 'RANKID'];

// ---------------------------------------------------------------- Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Manager-Rank" -> Manager_Rank/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Manager-Rank'], adminAuth, asyncHandler(async (req, res) => {
  return res.json({ view: '~/Views/AdminPanel/Manager_Rank/Index.cshtml' });
}));

// ---------------------------------------------------------------- JsonResult GetManagerReankDetail(string UserName)
// auth (PORT-NOTE: legacy had no session check - protected)
router.all(`/admin/${C}/GetManagerReankDetail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let UserName = nStr(req.p.UserName); if (UserName === null) UserName = '';
  const rows = await db.proc(DB, 'Usp_Memeber_Rank', { UserName });
  return res.json(mapRows(rows, PROPS));
}));

// ---------------------------------------------------------------- JsonResult InsertManagerRank(string USername)
// auth (PORT-NOTE: legacy had no session check on this admin write - protected)
router.all(`/admin/${C}/InsertManagerRank{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  // [Usp_Add_Manager] @username,@Mode,@strresult OUT
  const row = await db.procOne(DB, 'Usp_Add_Manager', { username: nStr(req.p.USername), Mode: 'add' });
  return res.json(outStr(row, 'strresult'));
}));

module.exports = router;
