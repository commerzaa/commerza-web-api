'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Single_Leg_tree_Wthoutwcl.cs (class Single_Leg_tree_WthoutwclController => /admin/Single_Leg_tree_Wthoutwcl/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nStr, need, firstCol, UNILEVEL_TREE_MATRIX_PROPS } = require('./_shared/batch13-06-common');

const router = express.Router();
const C = 'Single_Leg_tree_Wthoutwcl';

// ---------------------------------------------------------------- [SessionExpireCheck] Index(string username)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/Single-LegTree" -> Single_Leg_tree_Wthoutwcl/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Single-LegTree'], adminAuth, asyncHandler(async (req, res) => {
  let username = nStr(req.p.username);
  let Plid = 0;
  if (username === null) {
    username = '';
    Plid = 1;
  }
  if (Plid === 0) {
    // SqlQuery<Int64>("USP_CREATESINGLELEGTREE @PLID,@USERNAME,@MODE", 0, username, 1).FirstOrDefault()
    const v = firstCol(await db.proc(DB, 'USP_CREATESINGLELEGTREE', { PLID: 0, USERNAME: username, MODE: 1 }));
    Plid = v === null || v === undefined ? 0 : Number(v);
  }
  const rows = await db.proc(DB, 'USP_CREATESINGLELEGTREE', { PLID: Plid, USERNAME: username, MODE: 2 });
  return res.json({ view: '~/Views/AdminPanel/Single_Leg_tree_Wthoutwcl/Index.cshtml', Model: mapRows(rows, UNILEVEL_TREE_MATRIX_PROPS) });
}));

// ---------------------------------------------------------------- JsonResult Gettreeview(string RegNo)
// auth (PORT-NOTE: legacy had no session check on this member-tree lookup - protected here)
router.all(`/admin/${C}/Gettreeview{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const p = need({ PLID: nStr(req.p.RegNo) }); // null => "parameter not supplied" (500), like legacy
  const rows = await db.proc(DB, 'USP_CREATESINGLELEGTREE', { PLID: p.PLID, USERNAME: '', MODE: 3 });
  return res.json(mapRows(rows, UNILEVEL_TREE_MATRIX_PROPS));
}));

// ---------------------------------------------------------------- JsonResult GetUserdetails(string username)
// auth (PORT-NOTE: legacy had no session check - protected here)
router.all(`/admin/${C}/GetUserdetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const p = need({ USERNAME: nStr(req.p.username) });
  const rows = await db.proc(DB, 'USP_CREATESINGLELEGTREE', { PLID: 0, USERNAME: p.USERNAME, MODE: 4 });
  return res.json(mapRows(rows, UNILEVEL_TREE_MATRIX_PROPS));
}));

module.exports = router;
