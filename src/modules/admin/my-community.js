'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MyCommunity.cs (class MyCommunityController => /MyCommunity/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nStr, firstCol } = require('./_shared/batch10-common');
const { UNILEVEL_TREE_PROPS } = require('./_shared/batch10-c-tree');

const router = express.Router();
const C = 'MyCommunity';

// ---------------------------------------------------------------- Index(string Username)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/team-hierarchy" -> MyCommunity/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/team-hierarchy'], adminAuth, asyncHandler(async (req, res) => {
  let Plid = 0;
  let Username = nStr(req.p.Username);
  if (Username === null) {
    Username = '';
    Plid = 1;
  }
  const ViewBag = { RegNo: Plid };
  if (Plid === 0) {
    const v = firstCol(await db.proc(DB, 'USP_CREATEAUTOMATRIXTREE', { PLID: 0, USERNAME: Username, MODE: 1 }));
    Plid = v === null || v === undefined ? 0 : Number(v);
  }
  // USP_GENEALOGY @REGNO,@USERNAME,@MODE  (class UnilevelTree from Level_Tree.cs)
  const rows = await db.proc(DB, 'USP_GENEALOGY', { REGNO: Plid, USERNAME: '', MODE: 1 });
  return res.json({ view: '~/Views/AdminPanel/MyCommunity/Index.cshtml', Model: mapRows(rows, UNILEVEL_TREE_PROPS), ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult Gettreeview(string RegNo)
// auth (legacy had no session check; admin genealogy => adminAuth)
router.all(`/admin/${C}/Gettreeview{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const RegNo = nStr(req.p.RegNo);
  const rows = await db.proc(DB, 'USP_GENEALOGY', { REGNO: RegNo, USERNAME: '', MODE: 2 });
  return res.json(mapRows(rows, UNILEVEL_TREE_PROPS));
}));

// ---------------------------------------------------------------- JsonResult Getparticularmember(string username)
// auth (legacy had no session check; admin genealogy => adminAuth)
router.all(`/admin/${C}/Getparticularmember{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const username = nStr(req.p.username);
  const rows = await db.proc(DB, 'USP_GENEALOGY', { REGNO: 0, USERNAME: username, MODE: 3 });
  return res.json(mapRows(rows, UNILEVEL_TREE_PROPS));
}));

module.exports = router;
