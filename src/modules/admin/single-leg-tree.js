'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Single_Leg_Tree.cs (class Single_Leg_TreeController => /admin/Single_Leg_Tree/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nStr, need, UNILEVEL_TREE_PROPS } = require('./_shared/batch13-06-common');

const router = express.Router();
const C = 'Single_Leg_Tree';

// ---------------------------------------------------------------- Index(string loginId)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/single-leg-tree" -> Single_Leg_Tree/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/single-leg-tree'], adminAuth, asyncHandler(async (req, res) => {
  const loginId = nStr(req.p.loginId);
  const Plid = 1;
  const ViewBag = { RegNo: Plid };
  // loginId null => SqlParameter not supplied => exception (500), like legacy
  const p = need({ PLID: Plid, USERNAME: loginId });
  const rows = await db.proc(DB, 'USP_CREATESINGLELEGTREE', { PLID: p.PLID, USERNAME: p.USERNAME, MODE: 2 });
  return res.json({ view: '~/Views/AdminPanel/Single_Leg_Tree/Index.cshtml', Model: mapRows(rows, UNILEVEL_TREE_PROPS), ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult Gettreeview(string RegNo)
// auth (PORT-NOTE: legacy had no session check on this member-tree lookup - protected here)
router.all(`/admin/${C}/Gettreeview{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const RegNo = nStr(req.p.RegNo);
  // PORT-NOTE: legacy concatenated RegNo into "WHERE MM.PARENTREGNO=<RegNo>" (SQL injection); parameterised here. A missing RegNo
  // was a SQL syntax error (500) in legacy => reproduced with the same "not supplied" exception.
  need({ RegNo });
  // OPTION(MAXRECURSION 0) dropped (T-SQL hint).
  const rows = await db.query(DB, `select pl.regno, pl.loginid, pl.plid, pl.intro_refid, coalesce(pl.username, '') as name,
      coalesce(pl.imagename, '') as imagename, to_char(pl.doc, 'DD-MM-YYYY') as regdate, mp.ppv, coalesce(mp.pdap, 0) as pdap,
      (select count(1) from portal_login where isreferralaccepted = 1 and intro_refid = pl.plid) as totaldirectcount,
      (select count(1) from fun_all_downline_memberlist_count(mm.loginid) where loginid != '') as totalreferralcount
    from portal_login pl inner join member_master mm on mm.plid = pl.plid inner join member_performance mp on mp.regno = mm.regno
    where mm.parentregno = cast(@RegNo as bigint) and mm.isreferralaccepted = 1`, { RegNo });
  return res.json(mapRows(rows, UNILEVEL_TREE_PROPS));
}));

module.exports = router;
