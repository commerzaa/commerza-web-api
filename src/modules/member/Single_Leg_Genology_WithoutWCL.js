'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Single_Leg_Genology_WithoutWCL.cs (Single_Leg_Genology_WithoutWCLController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const router = express.Router();
const DB = 'affiliate';

const TREE_PROPS = ['REGNO', 'LoginId', 'Name', 'USERNAME', 'SPONSOR', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount', 'TotalReferralCount',
  'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'ACTIVE', 'STATUS', 'Downlinecount', 'RANKID'];

// PORT-NOTE: the legacy SQL text passes the three values positionally (@PLID,@USERNAME,@MODE) to USP_GENEALOGY_FORCEMATRIX whose first parameter is @REGNO.

// auth
// route-config: "referral/8FTN_plus_WYOT_slash_Leg_Genology_wclUdq91TGJMNm_slash_fzMy5u1tRa" -> Index
router.all(['/member/Single_Leg_Genology_WithoutWCL/Index{/:id}', '/member/referral/8FTN_plus_WYOT_slash_Leg_Genology_wclUdq91TGJMNm_slash_fzMy5u1tRa'], auth, asyncHandler(async (req, res) => {
  let loginId = req.p.loginId;
  const Plid = Number(req.user.plid);
  // legacy computed an unused "Mode" (6 / 7) here; the proc is always called with MODE 1
  if (loginId === undefined || loginId === null) loginId = '';
  const rows = await db.proc(DB, 'usp_genealogy_forcematrix', { regno: Plid, username: loginId, mode: 1 });
  res.json({ view: '~/Views/CustomerPanel/Single_Leg_Genology_WithoutWCL/Index.cshtml', Model: mapRows(rows, TREE_PROPS), ViewBag: { RegNo: Plid } });
}));

// auth
router.all('/member/Single_Leg_Genology_WithoutWCL/Gettreeview{/:id}', auth, asyncHandler(async (req, res) => {
  const RegNo = req.p.RegNo;
  const rows = await db.proc(DB, 'usp_genealogy_forcematrix', { regno: RegNo, username: '', mode: 2 });
  res.json(mapRows(rows, TREE_PROPS));
}));

// auth
router.all('/member/Single_Leg_Genology_WithoutWCL/Getparticularmember{/:id}', auth, asyncHandler(async (req, res) => {
  const username = req.p.username;
  const rows = await db.proc(DB, 'usp_genealogy_forcematrix', { regno: 0, username, mode: 3 });
  res.json(mapRows(rows, TREE_PROPS));
}));

module.exports = router;
