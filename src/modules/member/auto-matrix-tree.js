'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Auto_Matrix_Tree.cs (Auto_Matrix_TreeController, 3 actions: Index, Gettreeview, GetUserdetails)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: AutoMatrixTree -> referral/auto-repurchase-tree
 * PORT-NOTE: Gettreeview / GetUserdetails have no session check in legacy; they are member-panel AJAX data endpoints and are protected with auth.
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';
const C = 'Auto_Matrix_Tree';

const P_TREE = ['RegNo', 'LoginId', 'Name', 'ImageName', 'USERNAME', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount', 'TotalReferralCount', 'FNAME', 'Activationdate', 'MOBILE',
  'EMAILID', 'ACTIVE', 'STATUS', 'PARENTUSERNAME'];

// ---- Index ------------------------------------------------------------------------------------------------------
// auth
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/auto-repurchase-tree'], auth, asyncHandler(async (req, res) => {
  let username = req.p.username;
  if (username === undefined || username === null) username = '';
  let Plid = Number(req.user.plid);
  if (username !== '') {
    const r = await proc(DB, 'usp_createleveltree', { plid: 0, username, mode: 1 });
    const first = r[0];
    Plid = first ? Number(first[Object.keys(first)[0]]) : 0; // SqlQuery<Int64>.FirstOrDefault()
  }
  const UnilevelTreeMatrix = mapRows(await proc(DB, 'usp_createleveltreematrix_level', { plid: Plid, username, mode: 2 }), P_TREE);
  res.json({ Model: UnilevelTreeMatrix });
}));

// ---- Gettreeview -------------------------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/Gettreeview{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_createleveltreematrix_level', { plid: req.p.RegNo, username: '', mode: 5 });
  res.json(mapRows(rows, P_TREE));
}));

// ---- GetUserdetails ----------------------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/GetUserdetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_createleveltreematrix_level', { plid: 0, username: req.p.username, mode: 4 });
  res.json(mapRows(rows, P_TREE));
}));

module.exports = router;
