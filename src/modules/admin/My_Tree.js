'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\My_Tree.cs (class My_TreeController => /My_Tree/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const { adminAuth } = require('./_shared/adminSession');
const { DB, nStr, reqInt, col, cvtInt, firstCol, nullRef } = require('./_shared/batch10_common');

const router = express.Router();
const C = 'My_Tree';

/** class BindDetailsByUserName */
const BIND_PROPS = ['PARENTREGNO', 'CHILDREGNO', 'side', 'loginID', 'NAME', 'regNo', 'spID', 'SPNAME', 'RegDate', 'DOC', 'Title', 'leftMembers',
  'rightMembers', 'directMembers', 'totalMember', 'leftIncome', 'rightIncome', 'parentID', 'childID', 'Active', 'ImageName', 'PBV', 'DLBV', 'DRBV',
  'TOTAL_LBV', 'TOTAL_RBV', 'CURRENT_LBV', 'CURRENT_RBV', 'PAIDBV', 'FLUSHBV', 'PPV', 'TOTAL_LPV', 'TOTAL_RPV', 'CURRENT_LPV', 'CURRENT_RPV',
  'PAIDPV', 'USERNAME', 'FLUSHPV', 'LCOUNT', 'LROUNT', 'ActivationDate', 'SPUSERNAME', 'FLUSHINCOME', 'GENDER', 'TOTALLEFTCOUNT',
  'TOTALRIGHTCOUNT', 'TOTALLEFTDEACTIVECOUNT', 'TOTALRIGHTACTIVECOUNT', 'memStatus', 'TOTALLEFTMEMBER', 'TOTALRIGHTMEMBER'];
/** class UnsettledBusiness */
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

// ---------------------------------------------------------------- Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","Home"))
// route-config: "AdminPanel/My-Tree" -> My_Tree/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/My-Tree'], adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const Regno = req.user.emp_id === null || req.user.emp_id === undefined ? '' : String(req.user.emp_id);
  void req.user.emp_name; // string Name = Convert.ToString(Emp_Name) (unused)
  if (Regno !== '') {
    const regid = cvtInt(Regno);
    // PORT-NOTE: legacy looked up Member_Master by regNo == the admin's Emp_ID (kept).
    const id = await db.queryOne(DB, 'select username from member_master where regno = @regid limit 1', { regid });
    if (!id) throw nullRef(); // id.userName on null
    ViewBag.Name = col(id, 'username');
  }
  ViewBag.RegNo = 1;
  return res.json({ view: '~/Views/AdminPanel/My_Tree/Index.cshtml', ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult bindParentId(string parentRegno, int side)
// auth (legacy had no session check; admin tree tool => adminAuth)
router.all(`/admin/${C}/bindParentId{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const parentRegno = nStr(req.p.parentRegno);
  const side = reqInt(req.p.side, 'side');
  // TempData["ParentID"] / TempData["side"] (session-backed) => sessionStore keys 'ParentID' / 'side'
  sessionStore.set(req, 'ParentID', parentRegno);
  sessionStore.set(req, 'side', side);
  return res.json('ok');
}));

// ---------------------------------------------------------------- JsonResult getmemberregno(string Regno)
// auth (legacy had no session check; admin tree tool => adminAuth)
router.all(`/admin/${C}/getmemberregno{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Regno = nStr(req.p.Regno);
  const mm = await db.queryOne(DB, 'select regno from member_master where loginid = @Regno limit 1', { Regno });
  if (!mm) throw nullRef(); // mm.regNo on null
  return res.json(Number(col(mm, 'regno')));
}));

// ---------------------------------------------------------------- JsonResult BindDetailsByUser(string username)
// auth (legacy had no session check; admin tree tool => adminAuth)
router.all(`/admin/${C}/BindDetailsByUser{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let username = nStr(req.p.username);
  const userid = await db.queryOne(DB, 'select username from member_master where loginid = @username limit 1', { username });
  if (userid) username = col(userid, 'username');
  const rows = await db.proc(DB, 'USP_BINDdETAILSBYUSERNAME', { USERNAME: username });
  return res.json(mapRows(rows, BIND_PROPS));
}));

// ---------------------------------------------------------------- JsonResult GetPerticularUnsettledBusiness(string name)
// auth (legacy had no session check; admin tree tool => adminAuth)
router.all(`/admin/${C}/GetPerticularUnsettledBusiness{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const name = nStr(req.p.name);
  const LoginId = firstCol(await db.query(DB, 'select loginid from member_master where username = @name limit 1', { name }));
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

// ---------------------------------------------------------------- JsonResult GetUserName(string mode)
// auth (legacy had no session check; admin tree tool => adminAuth)
router.all(`/admin/${C}/GetUserName{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Mode = cvtInt(nStr(req.p.mode));
  let UserName = firstCol(await db.proc(DB, 'USP_GetUSERNAME', { Regno: 1, Mode }));
  if (UserName === null || UserName === undefined) {
    UserName = 'N/A';
    return res.json(UserName);
  }
  return res.json(UserName);
}));

module.exports = router;
