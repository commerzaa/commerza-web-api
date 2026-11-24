'use strict';
// Ported from Member/Controllers/CustomerPanel/Force_Matrix_Tree.cs  (DB: affiliate)
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const DB = 'affiliate';
// class UnilevelTreeMatrix (declared in LevelTree.cs)
const UnilevelTreeMatrix = ['REGNO', 'LoginId', 'Name', 'USERNAME', 'SPONSOR', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount', 'TotalReferralCount', 'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'ACTIVE', 'STATUS', 'Downlinecount', 'RANKID'];
const firstValue = (rows) => (rows && rows[0] ? rows[0][Object.keys(rows[0])[0]] : null);

// auth (legacy: Session["PLID"] == null -> redirect Home/Index). route-config: url "referral/aAaSW_slash__slash_IWmJ0xN4IBNV6xA=="
router.all(['/member/Force_Matrix_Tree/Index{/:id}', '/member/Force_Matrix_Tree', '/member/referral/aAaSW_slash__slash_IWmJ0xN4IBNV6xA=='], auth, asyncHandler(async (req, res) => {
  let username = req.p.username;
  if (username == null) username = '';
  let Plid = Number(req.user.plid);
  if (Plid === 0) {
    const r = firstValue(await proc(DB, 'usp_createforcematrix_onybyone_tree', { plid: 0, username, mode: 1 }));
    Plid = r == null ? 0 : Number(r);
  }
  const rows = await proc(DB, 'usp_createforcematrix_onybyone_tree', { plid: Plid, username, mode: 2 });
  res.json({ View: '~/Views/CustomerPanel/Force_Matrix_Tree/Index.cshtml', Model: mapRows(rows, UnilevelTreeMatrix) });
}));

// auth
router.all('/member/Force_Matrix_Tree/Gettreeview{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_createforcematrix_onybyone_tree', { plid: req.p.RegNo, username: '', mode: 3 });
  res.json(mapRows(rows, UnilevelTreeMatrix));
}));

// auth
router.all('/member/Force_Matrix_Tree/GetUserdetails{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_createforcematrix_onybyone_tree', { plid: 0, username: req.p.username, mode: 4 });
  res.json(mapRows(rows, UnilevelTreeMatrix));
}));

module.exports = router;
