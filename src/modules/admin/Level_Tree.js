'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Level_Tree.cs (class Level_TreeController => /Level_Tree/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/adminSession');
const { DB, nStr } = require('./_shared/batch09_common');

const router = express.Router();
const C = 'Level_Tree';

/** class UnilevelTree (Level_Tree.cs) */
const UNILEVEL_TREE = ['RegNo', 'LoginId', 'Name', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount',
  'TotalReferralCount', 'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'STATUS', 'ACTIVE', 'USERNAME'];
/** class UnilevelTrees (Level_Tree.cs) - same as UnilevelTree without USERNAME (STATUS/ACTIVE are int there) */
const UNILEVEL_TREES = ['RegNo', 'LoginId', 'Name', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount',
  'TotalReferralCount', 'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'STATUS', 'ACTIVE'];

// ---------------------------------------------------------------- Index(string username)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Level-Tree" -> Level_Tree/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Level-Tree'], adminAuth, asyncHandler(async (req, res) => {
  const username = nStr(req.p.username);
  let Plid = 0;
  if (username === null) Plid = 1;
  if (Plid === 0) {
    // SqlQuery<Int64>("USP_CREATELEVELTREE @PLID,@USERNAME,@MODE", 0, username, 1).FirstOrDefault()
    const r = await db.procOne(DB, 'USP_CREATELEVELTREE', { PLID: 0, USERNAME: username, MODE: 1 });
    const v = r ? r[Object.keys(r)[0]] : null;
    Plid = v === null || v === undefined ? 0 : Number(v);
  }
  const unitree = mapRows(await db.proc(DB, 'USP_CREATELEVELTREE', { PLID: Plid, USERNAME: '', MODE: 2 }), UNILEVEL_TREE);
  return res.json({ view: '~/Views/AdminPanel/Level_Tree/Index.cshtml', Model: unitree });
}));

// ---------------------------------------------------------------- JsonResult Gettreeview(string RegNo)
// auth (PORT-NOTE: legacy had no session check on this member-tree lookup - protected here)
router.all(`/admin/${C}/Gettreeview{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_CREATELEVELTREE', { PLID: nStr(req.p.RegNo), USERNAME: '', MODE: 3 });
  return res.json(mapRows(rows, UNILEVEL_TREES));
}));

// ---------------------------------------------------------------- JsonResult GetUserdetails(string username)
// auth (PORT-NOTE: legacy had no session check - protected here)
router.all(`/admin/${C}/GetUserdetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_CREATELEVELTREE', { PLID: 0, USERNAME: nStr(req.p.username), MODE: 4 });
  return res.json(mapRows(rows, UNILEVEL_TREE));
}));

module.exports = router;
module.exports.UNILEVEL_TREE = UNILEVEL_TREE;
