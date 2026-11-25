'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MyCommunity_Matrix_Level.cs (class MyCommunity_Matrix_LevelController => /MyCommunity_Matrix_Level/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/adminSession');
const { DB, nStr, firstCol } = require('./_shared/batch10_common');
const { UNILEVEL_TREE_MATRIX_PROPS } = require('./_shared/batch10C_tree');

const router = express.Router();
const C = 'MyCommunity_Matrix_Level';

// ---------------------------------------------------------------- Index(string username)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/MyCommunity-Matrix-Level" -> MyCommunity_Matrix_Level/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/MyCommunity-Matrix-Level'], adminAuth, asyncHandler(async (req, res) => {
  let Plid = 0;
  let username = nStr(req.p.username);
  if (username === null) {
    username = '';
    Plid = 1;
  }
  if (Plid === 0) {
    // SqlQuery<Int64>(...).FirstOrDefault() => 0 when no row
    const v = firstCol(await db.proc(DB, 'USP_CREATEFORCEMATRIX_ONYBYONE_TREE', { PLID: 0, USERNAME: username, MODE: 1 }));
    Plid = v === null || v === undefined ? 0 : Number(v);
  }
  const rows = await db.proc(DB, 'USP_CREATEFORCEMATRIX_ONYBYONE_TREE', { PLID: Plid, USERNAME: username, MODE: 2 });
  return res.json({ view: '~/Views/AdminPanel/MyCommunity_Matrix_Level/Index.cshtml', Model: mapRows(rows, UNILEVEL_TREE_MATRIX_PROPS) });
}));

// ---------------------------------------------------------------- JsonResult Gettreeview(string RegNo)
// auth (legacy had no session check; admin genealogy => adminAuth)
router.all(`/admin/${C}/Gettreeview{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const RegNo = nStr(req.p.RegNo);
  const rows = await db.proc(DB, 'USP_CREATEFORCEMATRIX_ONYBYONE_TREE', { PLID: RegNo, USERNAME: '', MODE: 3 });
  return res.json(mapRows(rows, UNILEVEL_TREE_MATRIX_PROPS));
}));

// ---------------------------------------------------------------- JsonResult GetUserdetails(string username)
// auth (legacy had no session check; admin genealogy => adminAuth)
router.all(`/admin/${C}/GetUserdetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const username = nStr(req.p.username);
  const rows = await db.proc(DB, 'USP_CREATEFORCEMATRIX_ONYBYONE_TREE', { PLID: 0, USERNAME: username, MODE: 4 });
  return res.json(mapRows(rows, UNILEVEL_TREE_MATRIX_PROPS));
}));

module.exports = router;
