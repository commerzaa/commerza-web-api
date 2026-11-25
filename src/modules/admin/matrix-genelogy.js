'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Matrix_Genelogy.cs (class Matrix_GenelogyController => /Matrix_Genelogy/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nStr } = require('./_shared/batch09-common');
const { UNILEVEL_TREE } = require('./level-tree');

const router = express.Router();
const C = 'Matrix_Genelogy';

// ---------------------------------------------------------------- Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Matrix-Genelogy" -> Matrix_Genelogy/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Matrix-Genelogy'], adminAuth, asyncHandler(async (req, res) => {
  const Plid = 1;
  const ViewBag = { RegNo: Plid };
  const rows = await db.query(DB, `select pl.regno, mm.loginid, pl.plid, coalesce(pl.intro_refid, 0) as intro_refid, coalesce(pl.username, '') as name,
      pl.imagename as imagename, to_char(pl.doc, 'DD-MM-YYYY') as regdate, mp.ppv, coalesce(mp.pdap, 0) as pdap,
      (select count(1) from portal_login where isreferralaccepted = 1 and intro_refid = pl.plid) as totaldirectcount,
      (select count(1) from fun_all_downline_memberlist_binary(mm.loginid, 0) where loginid != '') as totalreferralcount
    from portal_login pl inner join member_master mm on mm.plid = pl.plid inner join member_performance mp on mm.regno = mp.regno
    where mm.plid = @Plid and mm.isreferralaccepted = 1`, { Plid });
  return res.json({ view: '~/Views/AdminPanel/Matrix_Genelogy/Index.cshtml', Model: mapRows(rows, UNILEVEL_TREE), ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult Gettreeview(string RegNo)
// auth (PORT-NOTE: legacy had no session check - protected here)
router.all(`/admin/${C}/Gettreeview{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.query(DB, `select pl.regno, pl.loginid, pl.plid, pl.intro_refid, coalesce(pl.username, '') as name,
      coalesce(pl.imagename, '') as imagename, to_char(pl.doc, 'DD-MM-YYYY') as regdate, mp.ppv, coalesce(mp.pdap, 0) as pdap,
      (select count(1) from portal_login where isreferralaccepted = 1 and intro_refid = pl.plid) as totaldirectcount,
      (select count(1) from fun_all_downline_memberlist_binary(mm.loginid, 0) where loginid != '') as totalreferralcount
    from portal_login pl inner join member_master mm on mm.plid = pl.plid inner join member_performance mp on mp.regno = mm.regno
    where mm.rootid::text = @RegNo and mm.isreferralaccepted = 1`, { RegNo: nStr(req.p.RegNo) === null ? '' : nStr(req.p.RegNo) });
  return res.json(mapRows(rows, UNILEVEL_TREE));
}));

module.exports = router;
