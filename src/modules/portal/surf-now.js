'use strict';
// Ported from ClusterofferShopingPortal\Controllers\SurfNowController.cs (class SurfNowController => /portal/SurfNow/...)
// Database: shopping (Db_Shopping; legacy DataBaseContext).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { DB, strParam, outStr, toInt32 } = require('./_shared/batch-14-common');

const router = express.Router();
const C = 'SurfNow';

/** class LinkManagement */
const newLinkManagement = () => ({ Link: null });

// ---------------------------------------------------------------- ActionResult Index(string PLID, string TATBID, string UserPLID)
// public (no session check; writes Session["PlidSurfing"])
// route-config: "surf-now/{PLID}/{TATBID}/{UserPLID}" -> SurfNow/Index (all optional)
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, '/portal/surf-now{/:PLID{/:TATBID{/:UserPLID}}}'], ps.portalSession,
  asyncHandler(async (req, res) => {
    const PLID = strParam(req.p.PLID);
    const TATBID = strParam(req.p.TATBID);
    const UserPLID = strParam(req.p.UserPLID);
    const ObjLinkManagement = newLinkManagement();
    const ViewBag = {};
    if (UserPLID !== null) {
      ps.sessionSet(req, 'PlidSurfing', UtilityClass.Decryptword(UserPLID));
    }
    if (PLID !== null) {
      if (TATBID !== null) {
        ViewBag.PLID = UtilityClass.Decryptword(PLID);
        ViewBag.TATBID = UtilityClass.Decryptword(TATBID);
      } else {
        ViewBag.PLID = '0';
        ViewBag.TATBID = '0';
      }
      // Legacy: "Select ISNULL(URL,'') From Tbl_AddTrafficBooster Where TATBID=" + Decryptword(TATBID) (concatenated; parameterised here).
      // A value that is not a number made the legacy statement invalid (SqlException) -> same failure here.
      const tatbid = UtilityClass.Decryptword(TATBID === null ? '' : TATBID).trim();
      if (!/^[+-]?\d+$/.test(tatbid)) throw new Error(tatbid === '' ? "Incorrect syntax near '='." : `Invalid column name '${tatbid}'.`);
      const row = await db.queryOne(DB, "select coalesce(url, '') as url from tbl_addtrafficbooster where tatbid = @tatbid limit 1", { tatbid: Number(tatbid) });
      const Link = row ? row.url : null;
      ObjLinkManagement.Link = Link;
      ViewBag.NoOfSecond = '30';
      return res.json({ view: '~/Views/SurfNow/SurfNow.cshtml', Model: ObjLinkManagement, ...ViewBag });
    }
    // Response.Redirect("/page-not-found")
    return res.json({ redirect: '/page-not-found' });
  }));

// ---------------------------------------------------------------- JsonResult ManageHistoryOfSessionForEachUser(string PLID, string TATBID)
// public (no session check; reads Session["PlidSurfing"])
router.all(`/portal/${C}/ManageHistoryOfSessionForEachUser{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const PLID = strParam(req.p.PLID);
  const TATBID = strParam(req.p.TATBID);
  const MemberPLID = toInt32(ps.sessionGet(req, 'PlidSurfing'));
  const row = await db.procOne(DB, 'Usp_ClickManagements', { Mode: 2, PLID, MemberPLID, TATBID });
  const ReturnOutPut = outStr(row, 'StrResult');
  return res.json(ReturnOutPut);
}));

module.exports = router;
