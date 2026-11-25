'use strict';
// Ported from Member/Controllers/CustomerPanel/Binary_Tree.cs  (DB: affiliate)
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const DB = 'affiliate';
const Binary_Details = ['RegNo', 'EMAILID', 'LOGINID', 'NAME', 'SPID', 'SPNAME', 'PPV', 'ACTIVE', 'IMAGENAME', 'TOTAL_LPV', 'TOTAL_RPV', 'CURRENT_LPV', 'CURRENT_RPV', 'PAIDPV', 'USERNAME', 'SPUSERNAME', 'REGDATE', 'DOC', 'PBV', 'DLBV', 'DRBV', 'GENDER', 'TOTALLEFTCOUNT', 'TOTALRIGHTCOUNT', 'TOTALLEFTDEACTIVECOUNT', 'TOTALRIGHTACTIVECOUNT', 'TOTALRIGHTMEMBER', 'TOTALLEFTMEMBER', 'PAIDBV', 'FLUSHBV', 'MEMSTATUS', 'SIDE', 'LEFTID', 'RIGHTID'];
const firstValue = (rows) => (rows && rows[0] ? rows[0][Object.keys(rows[0])[0]] : null);

// auth (legacy: Session["PLID"] == null -> redirect Home/Index). route-config: url "referral/4RYQwa12bina_plus_d_slash_mTOSm1LXk0A==" (id optional)
router.all(['/member/Binary_Tree/Index{/:id}', '/member/Binary_Tree', '/member/referral/4RYQwa12bina_plus_d_slash_mTOSm1LXk0A=='], auth, asyncHandler(async (req, res) => {
  let Plid = Number(req.user.plid);
  let username = req.p.username;
  if (username == null) username = '';
  if (username !== '') {
    const r = firstValue(await proc(DB, 'usp_binarytree', { regno: Math.trunc(Plid), username, mode: '0' }));
    Plid = r == null ? 0 : Number(r); // FirstOrDefault() of Int64 assigned to double
  }
  const rows = await proc(DB, 'usp_binarytree', { regno: Math.trunc(Plid), username, mode: 1 });
  res.json({ View: '~/Views/CustomerPanel/Binary_Tree/Index.cshtml', Model: mapRows(rows, Binary_Details) });
}));

// auth
router.all('/member/Binary_Tree/Gettreeview{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_binarytree', { regno: req.p.RegNo, username: '', mode: 2 });
  res.json(mapRows(rows, Binary_Details));
}));

// auth - Get pop-up information for selected member (username passed from the Ajax method)
router.all('/member/Binary_Tree/GetUserdetails{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_binarytree', { regno: 0, username: req.p.username, mode: 3 });
  res.json(mapRows(rows, Binary_Details));
}));

module.exports = router;
