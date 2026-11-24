'use strict';
// Ported from Member\Controllers\CustomerPanel\Auto_Matrix_Tree_Re_Joining.cs (Auto_Matrix_Tree_Re_JoiningController) - database: affiliate (Db_Affiliate)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/Auto_Matrix_Tree_Re_Joining';
const DB = 'affiliate';
// UnilevelTreeMatrix1 (Force_Matrix_Tree.cs)
const MATRIX1 = ['RegNo', 'LoginId', 'Name', 'ImageName', 'USERNAME', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount', 'TotalReferralCount', 'FNAME', 'Activationdate', 'MOBILE', 'EMAILID', 'ACTIVE', 'STATUS', 'PARENTUSERNAME'];
const SP = 'usp_createleveltreematrix_level_re_joining';

// route-config: referral/auto-purchase-tree
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/auto-purchase-tree'], ...guard, asyncHandler(async (req, res) => {
  let username = req.p.username;
  if (username === undefined || username === null) username = '';
  let Plid = Number(req.user.plid);
  if (username !== '') {
    const rows = await db.proc(DB, 'usp_createleveltree', { PLID: 0, USERNAME: username, MODE: 1 });
    const v = rows && rows.length ? rows[0][Object.keys(rows[0])[0]] : null;
    Plid = v === null || v === undefined ? 0 : Number(v);
  }
  const rows = await db.proc(DB, SP, { PLID: Plid, USERNAME: username, MODE: 2 });
  res.json({ Model: mapRows(rows, MATRIX1) });
}));

// auth
router.all(`${P}/Gettreeview{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, SP, { PLID: req.p.RegNo, USERNAME: '', MODE: 5 });
  res.json(mapRows(rows, MATRIX1));
}));

// auth
router.all(`${P}/GetUserdetails{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, SP, { PLID: 0, USERNAME: req.p.username, MODE: 4 });
  res.json(mapRows(rows, MATRIX1));
}));

module.exports = router;
