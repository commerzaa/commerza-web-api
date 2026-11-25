'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\DashboardRole.cs (class DashboardRoleController => /admin/DashboardRole/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, isAdmin, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'DashboardRole';

/** class DashboradRole */
const DR_PROPS = ['ADCID', 'SECTIONNAME', 'STATUS', 'roledetailstatus'];
// class DashboradRoleName { DBRID, ROLENAME, DESCRIPTION } - declared, unused.

/** public void viewBagColletion() */
function viewBagColletion(ViewBag) {
  ViewBag.rid = '';
  ViewBag.rollName = '';
  ViewBag.discription = '';
}

// ---------------------------------------------------------------- ActionResult Index(string RollNumber)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Dashboard-Role" -> DashboardRole/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Dashboard-Role'], adminAuth, asyncHandler(async (req, res) => {
  const RollNumber = B.nStr(req.p.RollNumber);
  let dbrid = 0;
  try {
    if (RollNumber !== null) dbrid = B.cvtInt(await UtilityClass.Decryptword(RollNumber));
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Index');
    dbrid = 0;
  }
  const EID = req.user.emp_id; void EID;
  const ViewBag = {};
  viewBagColletion(ViewBag);
  if (dbrid > 0) {
    // db._TBL_DASHBOARDROLE.Where(a => a.DBRID == dbrid).FirstOrDefault()
    const r = await db.queryOne(DB, 'select dbrid, rolename, description from tbl_dashboardrole where dbrid = @dbrid limit 1', { dbrid });
    if (r !== null) {
      ViewBag.rid = B.str(r.dbrid);
      ViewBag.rollName = r.rolename;
      ViewBag.discription = r.description;
    }
  }
  const rows = await db.proc(DB, 'USP_DASHBOARDROLELIST', { dbrid });
  const _objList = mapRows(rows, DR_PROPS);
  // PORT-NOTE: @withcommaresult OUT read from the first result row ("" when absent).
  const stringret = B.outStr(rows[0] || null, 'withcommaresult');
  ViewBag.withcomma = stringret;
  return res.json({ view: '~/Views/AdminPanel/DashboardRole/Index.cshtml', Model: _objList, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult AddNewRolls(int Dbrid, string RollName, string description, string getIdColletions, int mode)
// auth-by-check (legacy returned Json("Session Expired. Please login again") without a session - contract kept)
router.all(`/admin/${C}/AddNewRolls{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const Dbrid = B.reqInt(req.p.Dbrid, 'Dbrid');
  const mode = B.reqInt(req.p.mode, 'mode');
  if (!isAdmin(req)) return res.json('Session Expired. Please login again');
  try {
    const empcode = req.user.emp_code; void empcode;
    const EmpId = req.user.emp_id;
    const row = await db.procOne(DB, 'SpCreateEditRole_Dashboard', {
      Emp_Id: EmpId, roleName: B.nStr(req.p.RollName), roleDesc: B.nStr(req.p.description), CollectionOfId: B.nStr(req.p.getIdColletions),
      mode, Dbrid,
    });
    const stringret = B.outStr(row, 'strresult');
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'spCreateEditRole');
    return res.json('Error occurred. Please try later');
  }
}));

// ---------------------------------------------------------------- public void viewBagColletion()
// auth (public method => routable in legacy; only sets ViewBag => empty response. PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/viewBagColletion{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  viewBagColletion({});
  res.send('');
}));

// ---------------------------------------------------------------- JsonResult UpdateStatus(int status, int adcid)
// auth (admin dashboard config write; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/UpdateStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const status = B.reqInt(req.p.status, 'status');
  const adcid = B.reqInt(req.p.adcid, 'adcid');
  // PORT-NOTE: legacy ran "UPDATE TBL_ADMINDASHBOARD_CONTENT SET STATUS = <status> WHERE ADCID = <adcid>" (concatenated ints) through
  // SqlQuery<ADMINDASHBOARD_CONTENT>(...).FirstOrDefault(); the UPDATE returns no rows, so the JSON result is null. Parameterised here.
  await db.exec(DB, 'update tbl_admindashboard_content set status = @status where adcid = @adcid', { status, adcid });
  return res.json(null);
}));

module.exports = router;
