'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\add_Admin_Role_Systemtype.cs (class add_Admin_Role_SystemtypeController)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth } = require('./_shared/adminSession');
const { DB, nstr, outStr, col, view, mapRows } = require('./_shared/batch02_common');

const router = express.Router();
const C = 'add_Admin_Role_Systemtype';

const SYSTEMTYPELIST_PROPS = ['SYSTEMNAME', 'STID', 'ACTIVE', 'STATUS'];
const ROLELIST_PROPS = ['ROLENAME', 'RID', 'STATUS'];

// ---------------------------------------------------------------- Index(string RollNumber)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/System-Type" -> add_Admin_Role_Systemtype/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/System-Type'], adminAuth, asyncHandler(async (req, res) => {
  const SYSTEMTYPE = mapRows(await db.proc(DB, 'USP_SYSTEMTYPELIST', {}), SYSTEMTYPELIST_PROPS);
  const ROLELIST = mapRows(await db.proc(DB, 'USP_ROLELIST_systemType', {}), ROLELIST_PROPS);
  return view(res, '~/Views/AdminPanel/add_Admin_Role_Systemtype/Index.cshtml', SYSTEMTYPE, { ROLELIST });
}));

// DBO.USP_INSERSYSTEMTYPE @RID,@MODE,@STRRESULT out
async function insertSystemType(RID, MODE) {
  const row = await db.procOne(DB, 'USP_INSERSYSTEMTYPE', { RID, MODE });
  return outStr(col(row, 'strresult'));
}

// ---------------------------------------------------------------- JsonResult InsertRole(string RID)
// auth (legacy had no session check; admin-only write => adminAuth, see report)
router.all(`/admin/${C}/InsertRole{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  res.json(await insertSystemType(nstr(req.p.RID), 0));
}));

// ---------------------------------------------------------------- JsonResult subadminInsertRole(string RID)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/subadminInsertRole{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  res.json(await insertSystemType(nstr(req.p.RID), 1));
}));

// ---------------------------------------------------------------- JsonResult Bindsaverole()
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/Bindsaverole{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const ROLELIST = mapRows(await db.proc(DB, 'USP_ROLELIST_systemType', { MODE: 1 }), ROLELIST_PROPS);
  res.json(ROLELIST);
}));

module.exports = router;
