'use strict';
// Ported from Member\Controllers\CustomerPanel\Auto_Matrix_Genelogy.cs (Auto_Matrix_GenelogyController) - database: affiliate (Db_Affiliate)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/Auto_Matrix_Genelogy';
const DB = 'affiliate';
// UnilevelTree (MyCommunity.cs)
const TREE = ['RegNo', 'LoginId', 'Name', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount', 'TotalReferralCount', 'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'STATUS', 'ACTIVE', 'USERNAME'];

// route-config: referral/8wy1UOO1qRgoCeNfTDxbtQgJR_slash_nDQmSZ
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/8wy1UOO1qRgoCeNfTDxbtQgJR_slash_nDQmSZ{/:id}'], ...guard, asyncHandler(async (req, res) => {
  let loginId = req.p.loginId;
  if (loginId === undefined || loginId === null) loginId = '';
  const Plid = Number(req.user.plid);
  const ViewBag = { RegNo: Plid };
  let rows;
  if (loginId !== '') {
    rows = await db.proc(DB, 'usp_genealogy_automatrix', { PLID: 0, USERNAME: loginId.trim(), MODE: 3 });
  } else {
    rows = await db.proc(DB, 'usp_genealogy_automatrix', { PLID: Plid, USERNAME: '', MODE: 1 });
  }
  res.json({ Model: mapRows(rows, TREE), ViewBag });
}));

// auth
router.all(`${P}/Gettreeview{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_genealogy_automatrix', { PLID: req.p.RegNo, USERNAME: '', MODE: 2 });
  res.json(mapRows(rows, TREE));
}));

module.exports = router;
