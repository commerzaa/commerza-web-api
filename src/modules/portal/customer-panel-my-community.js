'use strict';
// Ported from C:/Users/MY ASUS/cluster/ClusterofferShopingPortal/ClusterofferShopingPortal/Controllers/CustomerPanel/MyCommunity.cs
// (class MyCommunityController => /portal/MyCommunity/...). Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { DB, view, toInt32 } = require('./_shared/batch-06-common');

const router = express.Router();

/** class UnilevelTree */
const UNILEVELTREE_PROPS = ['RegNo', 'LoginId', 'Name', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount',
  'TotalReferralCount'];

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "referral/mycommunity" -> MyCommunity/Index
router.all(['/portal/MyCommunity/Index{/:id}', '/portal/MyCommunity', '/portal/referral/mycommunity{/:id}'], ps.customerAuth,
  asyncHandler(async (req, res) => {
    const Plid = toInt32(req.user.plid);
    const ViewBag = { RegNo: Plid };
    // CONVERT(VARCHAR(30),PL.DOC,105) => dd-mm-yyyy
    const rows = await db.query(DB, `SELECT pl.regno, pl.loginid, pl.plid, pl.intro_refid, coalesce(pl.username, '') AS name,
        pl.imagename AS imagename, to_char(pl.doc, 'DD-MM-YYYY') AS regdate, mp.ppv, coalesce(mp.pdap, 0) AS pdap,
        (SELECT count(1) FROM portal_login WHERE isreferralaccepted = true AND intro_refid = pl.plid) AS totaldirectcount,
        (SELECT count(1) FROM fun_all_downline_memberlist_left_side_withlrcount(mm.loginid) f WHERE f.loginid <> '') AS totalreferralcount
      FROM portal_login pl INNER JOIN member_master mm ON mm.plid = pl.plid INNER JOIN member_performance mp ON mm.regno = mp.regno
      WHERE mm.plid = @Plid AND mm.isreferralaccepted = true`, { Plid });
    const unitree = mapRows(rows, UNILEVELTREE_PROPS);
    view(res, '~/Views/CustomerPanel/MyCommunity/Index.cshtml', unitree, ViewBag);
  }));

// ---------------------------------------------------------------- Gettreeview(string RegNo) : JsonResult
// auth: legacy had no session check (anyone could list any member's direct downline by RegNo); protected here because it
// is the logged-in customer's community tree (PORTING_GUIDE_MVC lesson 8).
router.all('/portal/MyCommunity/Gettreeview{/:id}', ps.customerAuth, asyncHandler(async (req, res) => {
  const RegNo = req.p.RegNo;
  // legacy concatenated RegNo into the SQL ("PL.INTRO_REFID=" + RegNo); now a bound parameter (a non-numeric value fails as before)
  // OPTION(MAXRECURSION 0) has no PostgreSQL equivalent (not needed).
  const rows = await db.query(DB, `SELECT pl.regno, pl.loginid, pl.plid, pl.intro_refid, coalesce(pl.username, '') AS name,
      coalesce(pl.imagename, '') AS imagename, to_char(pl.doc, 'DD-MM-YYYY') AS regdate, mp.ppv, coalesce(mp.pdap, 0) AS pdap,
      (SELECT count(1) FROM portal_login WHERE isreferralaccepted = true AND intro_refid = pl.plid) AS totaldirectcount,
      (SELECT count(1) FROM fun_all_downline_memberlist_left_side_withlrcount(mm.loginid) f WHERE f.loginid <> '') AS totalreferralcount
    FROM portal_login pl INNER JOIN member_master mm ON mm.plid = pl.plid INNER JOIN member_performance mp ON mp.regno = mm.regno
    WHERE pl.intro_refid = (@RegNo)::bigint AND mm.isreferralaccepted = true`, { RegNo: RegNo === undefined ? null : RegNo });
  res.json(mapRows(rows, UNILEVELTREE_PROPS));
}));

module.exports = router;
