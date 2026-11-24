'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\LevelTree.cs (LevelTreeController) - 3 actions: Index, Gettreeview, GetUserdetails */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/LevelTree';
const TREE_PROPS = ['REGNO', 'LoginId', 'Name', 'USERNAME', 'SPONSOR', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount',
  'TotalReferralCount', 'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'ACTIVE', 'STATUS', 'Downlinecount', 'RANKID'];

// auth (Session["PLID"] == null => RedirectToAction("Index","Home"))
router.all(`${P}/Index{/:id}`, auth, asyncHandler(async (req, res) => {
  let username = req.p.username;
  if (username == null) username = '';
  let Plid = Number(req.user.plid);
  if (Plid === 0) {
    const r = await proc(DB, 'usp_createleveltree', { plid: 0, username, mode: 1 });
    const first = r && r[0];
    Plid = first ? Number(first[Object.keys(first)[0]]) : 0; // SqlQuery<Int64>().FirstOrDefault()
  }
  const rows = await proc(DB, 'usp_createleveltreematrix_level', { plid: Plid, username, mode: 2 });
  res.json({ Model: mapRows(rows, TREE_PROPS) });
}));

// auth (no session check in legacy; returns the downline tree of the supplied RegNo, so it is protected)
router.all(`${P}/Gettreeview{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_createleveltreematrix_level', { plid: req.p.RegNo, username: '', mode: 3 });
  res.json(mapRows(rows, TREE_PROPS));
}));

// auth (no session check in legacy; returns member details for a username, so it is protected)
router.all(`${P}/GetUserdetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_createleveltreematrix_level', { plid: 0, username: req.p.username, mode: 4 });
  res.json(mapRows(rows, TREE_PROPS));
}));

module.exports = router;
