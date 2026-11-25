'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MyCommunity_FileView.cs (class MyCommunity_FileViewController => /MyCommunity_FileView/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/adminSession');
const { DB, nStr } = require('./_shared/batch10_common');
const { UNILEVEL_TREE_MATRIX_PROPS } = require('./_shared/batch10C_tree');

const router = express.Router();
const C = 'MyCommunity_FileView';

// ---------------------------------------------------------------- Index(string Username)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/MyCommunity-FileView" -> MyCommunity_FileView/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/MyCommunity-FileView'], adminAuth, asyncHandler(async (req, res) => {
  const Plid = 1;
  let Username = nStr(req.p.Username); if (Username === null) Username = '';
  const ViewBag = { RegNo: Plid };
  // USP_GENEALOGY_FORCEMATRIX_ONEBYONE @PLID,@USERNAME,@MODE (positional => proc params @REGNO,@USERNAME,@MODE)
  const rows = await db.proc(DB, 'USP_GENEALOGY_FORCEMATRIX_ONEBYONE', { REGNO: Plid, USERNAME: Username, MODE: 1 });
  ViewBag.RegNo = Plid;
  return res.json({ view: '~/Views/AdminPanel/MyCommunity_FileView/Index.cshtml', Model: mapRows(rows, UNILEVEL_TREE_MATRIX_PROPS), ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult Gettreeview(string RegNo)
// auth (legacy had no session check; admin genealogy => adminAuth)
router.all(`/admin/${C}/Gettreeview{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const RegNo = nStr(req.p.RegNo);
  const rows = await db.proc(DB, 'USP_GENEALOGY_FORCEMATRIX_ONEBYONE', { REGNO: RegNo, USERNAME: '', MODE: 2 });
  return res.json(mapRows(rows, UNILEVEL_TREE_MATRIX_PROPS));
}));

// ---------------------------------------------------------------- JsonResult Getparticularmember(string username)
// auth (legacy had no session check; admin genealogy => adminAuth)
router.all(`/admin/${C}/Getparticularmember{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const username = nStr(req.p.username);
  const rows = await db.proc(DB, 'USP_GENEALOGY_FORCEMATRIX_ONEBYONE', { REGNO: 0, USERNAME: username, MODE: 3 });
  return res.json(mapRows(rows, UNILEVEL_TREE_MATRIX_PROPS));
}));

module.exports = router;
