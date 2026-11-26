'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Single_Leg_genology.cs (class Single_Leg_genologyController => /admin/Single_Leg_genology/...)
// Database: affiliate (Db_Affiliate).
// PORT-NOTE: the legacy command text "USP_GENEALOGY_SINGLELEG @PLID,@USERNAME,@MODE" binds POSITIONALLY; the proc's first parameter is
// @REGNO, so the value is passed as REGNO in PostgreSQL named notation.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nStr, need, UNILEVEL_TREE_MATRIX_PROPS } = require('./_shared/batch13-06-common');

const router = express.Router();
const C = 'Single_Leg_genology';

// ---------------------------------------------------------------- Index(string Username)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Single-Leg-genology" -> Single_Leg_genology/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Single-Leg-genology'], adminAuth, asyncHandler(async (req, res) => {
  let Username = nStr(req.p.Username);
  const Plid = 1; // Convert.ToInt32(1)
  if (Username === null) Username = '';
  const ViewBag = {};
  ViewBag.RegNo = Plid;
  const rows = await db.proc(DB, 'USP_GENEALOGY_SINGLELEG', { REGNO: Plid, USERNAME: Username, MODE: 1 });
  const ForceMatrix_Fileview = mapRows(rows, UNILEVEL_TREE_MATRIX_PROPS);
  ViewBag.RegNo = Plid;
  return res.json({ view: '~/Views/AdminPanel/Single_Leg_genology/Index.cshtml', Model: ForceMatrix_Fileview, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult Gettreeview(string RegNo)
// auth (PORT-NOTE: legacy had no session check on this member-tree lookup - protected here)
router.all(`/admin/${C}/Gettreeview{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const p = need({ PLID: nStr(req.p.RegNo) }); // null => "parameter not supplied" (500), like legacy
  const rows = await db.proc(DB, 'USP_GENEALOGY_SINGLELEG', { REGNO: p.PLID, USERNAME: '', MODE: 2 });
  return res.json(mapRows(rows, UNILEVEL_TREE_MATRIX_PROPS));
}));

// ---------------------------------------------------------------- JsonResult Getparticularmember(string username)
// auth (PORT-NOTE: legacy had no session check - protected here)
router.all(`/admin/${C}/Getparticularmember{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const p = need({ USERNAME: nStr(req.p.username) });
  const rows = await db.proc(DB, 'USP_GENEALOGY_SINGLELEG', { REGNO: 0, USERNAME: p.USERNAME, MODE: 3 });
  return res.json(mapRows(rows, UNILEVEL_TREE_MATRIX_PROPS));
}));

module.exports = router;
