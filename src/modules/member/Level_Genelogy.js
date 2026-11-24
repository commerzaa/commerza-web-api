'use strict';
// Ported from Member\Controllers\CustomerPanel\Level_Genelogy.cs (Level_GenelogyController) - database: affiliate (Db_Affiliate)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/Level_Genelogy';
const DB = 'affiliate';
// UnilevelTree2 (MyCommunity.cs)
const TREE2 = ['RegNo', 'LoginId', 'Name', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount', 'TotalReferralCount', 'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'STATUS', 'ACTIVE', 'USERNAME'];
// UnilevelTreeMatrix (LevelTree.cs)
const MATRIX = ['REGNO', 'LoginId', 'Name', 'USERNAME', 'SPONSOR', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount', 'TotalReferralCount', 'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'ACTIVE', 'STATUS', 'Downlinecount', 'RANKID'];

// route-config: referral/20_slash_w_slash_e4zV43RFNBXSN2AGg==
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/20_slash_w_slash_e4zV43RFNBXSN2AGg=='], ...guard, asyncHandler(async (req, res) => {
  const loginId = req.p.loginId;
  let Plid = Number(req.user.plid);
  const ViewBag = { RegNo: Plid };
  if (Plid === 0) {
    const rows = await db.proc(DB, 'usp_createautomatrixtree', { PLID: 0, USERNAME: loginId, MODE: 1 });
    const v = rows && rows.length ? rows[0][Object.keys(rows[0])[0]] : null;
    Plid = v === null || v === undefined ? 0 : Number(v);
  }
  const rows = await db.proc(DB, 'usp_genealogy', { REGNO: Plid, USERNAME: '', MODE: 1 });
  res.json({ Model: mapRows(rows, TREE2), ViewBag });
}));

// auth
router.all(`${P}/Gettreeview{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_genealogy', { REGNO: req.p.RegNo, USERNAME: '', MODE: 2 });
  res.json(mapRows(rows, TREE2));
}));

// auth
router.all(`${P}/Getparticularmember{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_genealogy', { REGNO: 0, USERNAME: req.p.username, MODE: 3 });
  res.json(mapRows(rows, MATRIX));
}));

module.exports = router;
