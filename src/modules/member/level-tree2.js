'use strict';
/** Port of Member/Controllers/CustomerPanel/Level_Tree2.cs (Level_Tree2Controller). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';

// UnilevelTreeMatrix (Controllers/CustomerPanel/LevelTree.cs)
const TREE_PROPS = ['REGNO', 'LoginId', 'Name', 'USERNAME', 'SPONSOR', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount',
  'TotalReferralCount', 'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'ACTIVE', 'STATUS', 'Downlinecount', 'RANKID'];

// route-config: referral/4RYQwa12_plus_d_slash_mTOSm1LXk0A== -> Index (id optional)
// auth
router.all(['/member/Level_Tree2/Index{/:id}', '/member/referral/4RYQwa12_plus_d_slash_mTOSm1LXk0A=={/:id}'], auth, asyncHandler(async (req, res) => {
  let Plid = Number(req.user.plid);
  let username = req.p.username;
  if (username === undefined || username === null) username = '';

  if (username !== '') {
    const r = await proc(DB, 'usp_createleveltree', { plid: 0, username, mode: 1 });
    const first = r && r[0];
    const v = first ? Object.values(first)[0] : 0; // SqlQuery<Int64>().FirstOrDefault()
    Plid = v === null || v === undefined ? 0 : Number(v);
  }
  const rows = await proc(DB, 'usp_createleveltreematrix_level', { plid: Math.trunc(Plid), username, mode: 2 });
  res.json({ view: '~/Views/CustomerPanel/Level_Tree2/Index.cshtml', Model: mapRows(rows, TREE_PROPS) });
}));

// auth
router.all('/member/Level_Tree2/Gettreeview{/:id}', auth, asyncHandler(async (req, res) => {
  const RegNo = req.p.RegNo;
  const rows = await proc(DB, 'usp_createleveltreematrix_level', { plid: RegNo, username: '', mode: 3 });
  res.json(mapRows(rows, TREE_PROPS));
}));

// auth
router.all('/member/Level_Tree2/GetUserdetails{/:id}', auth, asyncHandler(async (req, res) => {
  const username = req.p.username;
  const rows = await proc(DB, 'usp_createleveltreematrix_level', { plid: 0, username, mode: 4 });
  res.json(mapRows(rows, TREE_PROPS));
}));

module.exports = router;
