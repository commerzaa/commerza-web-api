'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\add_Admin_Role.cs (class add_Admin_RoleController)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Roll_Right_menu = require('../../lib/admin/Roll_Right_menu');
const { adminAuth, isAdmin, errorInsert } = require('./_shared/admin-session');
const { DB, nstr, toInt32, outStr, col, view, mapRows } = require('./_shared/batch02-common');

const router = express.Router();
const C = 'add_Admin_Role';

// public void viewBagColletion()  (routable in legacy: sets ViewBag only, renders nothing)
function viewBagColletion(ViewBag) {
  ViewBag.rid = '';
  ViewBag.rollName = '';
  ViewBag.discription = '';
}

// ---------------------------------------------------------------- Index(string RollNumber)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/add-Admin-Role" -> add_Admin_Role/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/add-Admin-Role'], adminAuth, asyncHandler(async (req, res) => {
  const RollNumber = nstr(req.p.RollNumber);
  let rid = 0;
  try {
    if (RollNumber !== null) {
      rid = toInt32(await UtilityClass.Decryptword(RollNumber));
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Index');
    rid = 0;
  }
  const EID = req.user.emp_id;
  const ViewBag = {};
  viewBagColletion(ViewBag);
  if (rid > 0) {
    // db._tbl_rolemaster.Where(a => a.rid == rid).FirstOrDefault()
    const GEtorlldetails = await db.queryOne(DB, 'select rid, rolename, description, date, status from tbl_rolemaster where rid = @rid limit 1', { rid });
    if (GEtorlldetails) {
      ViewBag.rid = rid;
      if (col(GEtorlldetails, 'rolename') == null || col(GEtorlldetails, 'description') == null) throw new Error('Object reference not set to an instance of an object.');
      ViewBag.rollName = String(col(GEtorlldetails, 'rolename')).trim();
      ViewBag.discription = String(col(GEtorlldetails, 'description')).trim();
    }
  }
  // USP_ROLELIST @rid,@EID
  const _objList = mapRows(await db.proc(DB, 'USP_ROLELIST', { rid, EID }), Roll_Right_menu.PROPS || Object.keys(new Roll_Right_menu()));
  return view(res, '~/Views/AdminPanel/add_Admin_Role/Index.cshtml', _objList, ViewBag);
}));

// ---------------------------------------------------------------- JsonResult AddNewRolls(string rid, string RollName, string description, string getIdColletions)
// auth-by-check (legacy returned Json("Session Expired. Please login again") - contract kept)
router.all(`/admin/${C}/AddNewRolls{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  if (!isAdmin(req)) return res.json('Session Expired. Please login again');
  try {
    const Empid = req.user.emp_id;
    // spCreateEditRole @Emp_Id,@rid,@roleName,@roleDesc,@CollectionOfId,@mode,@chageStates,@strResult out
    const row = await db.procOne(DB, 'spCreateEditRole', {
      Emp_Id: Empid, rid: nstr(req.p.rid), roleName: nstr(req.p.RollName), roleDesc: nstr(req.p.description),
      CollectionOfId: nstr(req.p.getIdColletions),
      chageStates: 0, // PORT-NOTE: legacy passed "" to an int parameter (SQL Server converts '' to 0)
      mode: 1,
    });
    return res.json(outStr(col(row, 'strresult')));
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'spCreateEditRole');
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
