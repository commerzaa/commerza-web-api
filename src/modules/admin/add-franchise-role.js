'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\add_Franchise_Role.cs (class add_Franchise_RoleController)
// Database: affiliate (Db_Affiliate). Table: tbl_rolemaster_franchisepanel (Franchise_Roll_master).
const express = require('express');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, isAdmin, errorInsert } = require('./_shared/admin-session');
const { DB, nstr, nre, toInt32, outStr, col, view, mapRows } = require('./_shared/batch02-common');

const router = express.Router();
const C = 'add_Franchise_Role';

/** class Franchise_Roll_Right_menu */
const FRANCHISE_ROLL_RIGHT_MENU_PROPS = ['mid', 'mainMenuTitle', 'mainhref', 'aiClass', 'bClass', 'sid', 'subMenuTitle', 'subhref', 'active',
  'userRight_isEdit', 'rollDelete', 'mainMenuView', 'mainMenuEdit', 'subMenuView', 'subMenuEdit', 'submenuChecked'];

// public void viewBagColletion()
function viewBagColletion(ViewBag) {
  ViewBag.rid = '';
  ViewBag.rollName = '';
  ViewBag.discription = '';
}

// ---------------------------------------------------------------- Index(string RollNumber)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/add-Franchise-Role" -> add_Franchise_Role/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/add-Franchise-Role'], adminAuth, asyncHandler(async (req, res) => {
  const RollNumber = nstr(req.p.RollNumber);
  let rid = 0;
  try {
    rid = toInt32(await UtilityClass.Decryptword(RollNumber));
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Index');
    rid = 0;
  }
  const ViewBag = {};
  viewBagColletion(ViewBag);
  if (rid > 0) {
    const GEtorlldetails = await db.queryOne(DB, 'select rid, rolename, description, date, status from tbl_rolemaster_franchisepanel where rid = @rid limit 1', { rid });
    if (GEtorlldetails) {
      ViewBag.rid = rid;
      if (col(GEtorlldetails, 'rolename') == null || col(GEtorlldetails, 'description') == null) throw nre();
      ViewBag.rollName = String(col(GEtorlldetails, 'rolename')).trim();
      ViewBag.discription = String(col(GEtorlldetails, 'description')).trim();
    }
  }
  const _objList = mapRows(await db.proc(DB, 'USP_FRANCHISEPANEL_ROLL_LIST', { rid }), FRANCHISE_ROLL_RIGHT_MENU_PROPS);
  return view(res, '~/Views/AdminPanel/add_Franchise_Role/Index.cshtml', _objList, ViewBag);
}));

// ---------------------------------------------------------------- JsonResult AddNewRolls(string rid, string RollName, string description, string getIdColletions)
// auth-by-check (legacy returned Json("Session Expired. Please login again") - contract kept)
router.all(`/admin/${C}/AddNewRolls{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  if (!isAdmin(req)) return res.json('Session Expired. Please login again');
  try {
    // SpCreateEditRole_From_Franchise @rid,@roleName,@roleDesc,@CollectionOfId,@mode,@chageStates,@strResult out
    const row = await db.procOne(DB, 'SpCreateEditRole_From_Franchise', {
      rid: nstr(req.p.rid), roleName: nstr(req.p.RollName), roleDesc: nstr(req.p.description), CollectionOfId: nstr(req.p.getIdColletions),
      chageStates: 0, // PORT-NOTE: legacy passed "" to an int parameter (SQL Server converts '' to 0)
      mode: 1,
    });
    return res.json(outStr(col(row, 'strresult')));
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'SpCreateEditRole_From_Member');
    return res.json('Error occurred. Please try later');
  }
}));

// ---------------------------------------------------------------- public void viewBagColletion()
// auth (public method => routable in legacy; void => empty response)
router.all(`/admin/${C}/viewBagColletion{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  viewBagColletion({});
  res.send('');
}));

module.exports = router;
