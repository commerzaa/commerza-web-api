'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MyCommunity_Matrix.cs (class MyCommunity_MatrixController => /MyCommunity_Matrix/...)
// Database: affiliate (Db_Affiliate).
// (RouteConfig "AdminPanel/MyCommunity-Matrix" is commented out in legacy => not registered; Binary_Tree.js owns that path.)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nStr, col, firstCol } = require('./_shared/batch10-common');
const { UNILEVEL_TREE_MATRIX_PROPS } = require('./_shared/batch10-c-tree');

const router = express.Router();
const C = 'MyCommunity_Matrix';

/** class UnsettledBusiness (My_Tree.cs) */
const UNSETTLED_PROPS = ['RIGHTINSERTEDDATE', 'RIGHTPACKAGE_AMT', 'RIGHTPACKAGE_SALESVOLUME', 'LEFTINSERTEDDATE', 'LEFTPACKAGE_AMT',
  'LEFTPACKAGE_SALESVOLUME'];

/** Convert.ToDecimal(<decimal OUT>.Value.ToString()).ToString(): DBNull => FormatException.
 *  PORT-NOTE: ADO.NET decimal OUT params without Scale come back rounded to scale 0 (kept). */
function decOutString(rows, name) {
  const v = col(rows && rows[0], name);
  if (v === undefined || v === null || v === '') throw new Error('Input string was not in a correct format.');
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return String(Math.round(n));
}

// ---------------------------------------------------------------- Index(string username)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  const Plid = 1;
  // (username parameter unused)
  const rows = await db.proc(DB, 'USP_CREATELEVELTREEMATRIX', { PLID: Plid, USERNAME: '', MODE: 2 });
  return res.json({ view: '~/Views/AdminPanel/MyCommunity_Matrix/Index.cshtml', Model: mapRows(rows, UNILEVEL_TREE_MATRIX_PROPS), RegNo: 1 });
}));

// ---------------------------------------------------------------- JsonResult Gettreeview(string RegNo)
// auth (legacy had no session check; admin genealogy => adminAuth)
router.all(`/admin/${C}/Gettreeview{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const RegNo = nStr(req.p.RegNo);
  const rows = await db.proc(DB, 'USP_CREATELEVELTREEMATRIX', { PLID: RegNo, USERNAME: '', MODE: 3 });
  return res.json(mapRows(rows, UNILEVEL_TREE_MATRIX_PROPS));
}));

// ---------------------------------------------------------------- JsonResult GetUserdetails(string username)
// auth (legacy had no session check; admin genealogy => adminAuth)
router.all(`/admin/${C}/GetUserdetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const username = nStr(req.p.username);
  const rows = await db.proc(DB, 'USP_CREATELEVELTREEMATRIX', { PLID: 0, USERNAME: username, MODE: 4 });
  return res.json(mapRows(rows, UNILEVEL_TREE_MATRIX_PROPS));
}));

// ---------------------------------------------------------------- JsonResult GetPerticularUnsettledBusiness(string username)
// auth (legacy had no session check; admin genealogy => adminAuth)
router.all(`/admin/${C}/GetPerticularUnsettledBusiness{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const username = nStr(req.p.username);
  const LoginId = firstCol(await db.query(DB, 'select loginid from member_master where username = @username limit 1', { username }));
  // UNSETTLED_BUSINESS @LOGINID,@TATALLEFTVALUE OUT,@TATALRIGHTVALUE out
  const rows = await db.proc(DB, 'UNSETTLED_BUSINESS', { LOGINID: LoginId });
  const UnsettledBusiness = mapRows(rows, UNSETTLED_PROPS);
  const ViewBag = {};
  if (UnsettledBusiness.length > 0) {
    ViewBag.TotalLeftValume = decOutString(rows, 'tatalleftvalue');
    ViewBag.TotalRightValume = decOutString(rows, 'tatalrightvalue');
  } else {
    ViewBag.TotalLeftValume = 0;
    ViewBag.TotalRightValume = 0;
  }
  return res.json({ LeftBusiness: ViewBag.TotalLeftValume, RighBusiness: ViewBag.TotalRightValume });
}));

module.exports = router;
