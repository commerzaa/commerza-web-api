'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MemberStyleMapping.cs (class MemberStyleMappingController => /MemberStyleMapping/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, isAdmin, errorInsert } = require('./_shared/adminSession');
const { DB, nInt, reqInt, col } = require('./_shared/batch10_common');

const router = express.Router();
const C = 'MemberStyleMapping';

/** class DashboardCssRole */
const PROPS = ['ROWNUMBER', 'SCID', 'CSSNAME', 'ISMANDOTORY'];

// ---------------------------------------------------------------- Index(int? id)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Member-Style-Mapping/{id}" -> MemberStyleMapping/Index (id optional)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Member-Style-Mapping{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  const id = nInt(req.p.id);
  const ViewBag = {};
  let _objList = [];
  try {
    const EID = req.user.emp_id; void EID; // read but unused in legacy
    // db._TBL_DASHBOARDS.Where(a => a.TDID == id).FirstOrDefault()
    const t = await db.queryOne(DB, 'select * from tbl_dashboards where tdid = @id limit 1', { id });
    if (t) {
      ViewBag.DashboardName = col(t, 'DASHBOARDNAME');
      ViewBag.url = col(t, 'URL');
      ViewBag.id = id;
    }
    // USP_DASHBOARDCSSROLE @mode,@TDID,@SCID,@STATUS  ("0" strings => int 0)
    _objList = mapRows(await db.proc(DB, 'USP_DASHBOARDCSSROLE', { mode: 1, TDID: 0, SCID: 0, STATUS: 0 }), PROPS);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Index');
  }
  return res.json({ view: '~/Views/AdminPanel/MemberStyleMapping/Index.cshtml', Model: _objList, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult AddCssRolls(int tdid, int scid, int status)
// auth-by-check (legacy returned Json("Session Expired. Please login again") without a session - contract kept)
router.all(`/admin/${C}/AddCssRolls{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const tdid = reqInt(req.p.tdid, 'tdid');
  const scid = reqInt(req.p.scid, 'scid');
  const status = reqInt(req.p.status, 'status');
  if (!isAdmin(req)) return res.json('Session Expired. Please login again');
  try {
    // new UtilityClass() (unused); @strResult declared but not passed
    await db.proc(DB, 'USP_DASHBOARDCSSROLE', { mode: 2, TDID: tdid, SCID: scid, STATUS: status });
    return res.json('1');
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'spCreateEditRole');
    return res.json('Error occurred. Please try later');
  }
}));

module.exports = router;
