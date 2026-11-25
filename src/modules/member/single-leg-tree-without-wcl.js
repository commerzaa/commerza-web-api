'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Single_Leg_Tree_WithoutWCL.cs (Single_Leg_Tree_WithoutWCLController)
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

// auth (legacy checked Session["PLID"])
// route-config: "referral/8FTN_plus_WYOT_slash_single_tree_wclUdq91TGJMNm_slash_fzMy5u1tRa" -> Index
router.all(['/member/Single_Leg_Tree_WithoutWCL/Index{/:id}', '/member/referral/8FTN_plus_WYOT_slash_single_tree_wclUdq91TGJMNm_slash_fzMy5u1tRa'], auth, asyncHandler(async (req, res) => {
  let username = req.p.username;
  if (username === undefined || username === null) username = '';
  let Plid = Math.trunc(Number(req.user.plid)) || 0;

  if (Plid === 0) {
    const r = await db.proc(DB, 'usp_createsinglelegtree', { plid: 0, username, mode: 1 });
    const f = r[0];
    Plid = f ? (Number(f[Object.keys(f)[0]]) || 0) : 0;
  }

  const rows = await db.proc(DB, 'usp_createsinglelegtree', { plid: Plid, username, mode: 2 });
  res.json({ view: '~/Views/CustomerPanel/Single_Leg_Tree_WithoutWCL/Index.cshtml', Model: mapRows(rows, TREE_PROPS) });
}));

// auth (served to the logged-in tree page)
router.all('/member/Single_Leg_Tree_WithoutWCL/Gettreeview{/:id}', auth, asyncHandler(async (req, res) => {
  const RegNo = req.p.RegNo;
  const rows = await db.proc(DB, 'usp_createsinglelegtree', { plid: RegNo, username: '', mode: 3 });
  res.json(mapRows(rows, TREE_PROPS));
}));

// auth
router.all('/member/Single_Leg_Tree_WithoutWCL/GetUserdetails{/:id}', auth, asyncHandler(async (req, res) => {
  const username = req.p.username;
  const rows = await db.proc(DB, 'usp_createsinglelegtree', { plid: 0, username, mode: 4 });
  res.json(mapRows(rows, TREE_PROPS));
}));

module.exports = router;
