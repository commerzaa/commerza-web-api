'use strict';
/** Port of Member/Controllers/CustomerPanel/MyCommunity_FileView.cs (MyCommunity_FileViewController). Prefix /member. DB: 'affiliate' */
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

// route-config: referral/feEARoUV6e55ln_slash_25TzNpMCjNTsjtMnP -> Index (id optional)
// auth
router.all(['/member/MyCommunity_FileView/Index{/:id}', '/member/referral/feEARoUV6e55ln_slash_25TzNpMCjNTsjtMnP{/:id}'], auth, asyncHandler(async (req, res) => {
  let loginId = req.p.loginId;
  const Plid = Number(req.user.plid);
  let Mode = 0; // legacy computed Mode (6 / 7) but never used it: the proc is always called with MODE 1
  if (loginId === undefined || loginId === null) { loginId = ''; Mode = 6; }
  if (loginId !== '') Mode = 7;
  const rows = await proc(DB, 'usp_genealogy_forcematrix_onebyone', { regno: Plid, username: loginId, mode: 1 });
  res.json({ view: '~/Views/CustomerPanel/MyCommunity_FileView/Index.cshtml', Model: mapRows(rows, TREE_PROPS), ViewBag: { RegNo: Plid } });
}));

// auth
router.all('/member/MyCommunity_FileView/Gettreeview{/:id}', auth, asyncHandler(async (req, res) => {
  const RegNo = req.p.RegNo;
  const rows = await proc(DB, 'usp_genealogy_forcematrix_onebyone', { regno: RegNo, username: '', mode: 2 });
  res.json(mapRows(rows, TREE_PROPS));
}));

// auth
router.all('/member/MyCommunity_FileView/Getparticularmember{/:id}', auth, asyncHandler(async (req, res) => {
  const username = req.p.username;
  const rows = await proc(DB, 'usp_genealogy_forcematrix_onebyone', { regno: 0, username, mode: 3 });
  res.json(mapRows(rows, TREE_PROPS));
}));

module.exports = router;
