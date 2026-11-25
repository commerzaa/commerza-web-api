'use strict';
// Ported from Member/Controllers/CustomerPanel/BuyPack.cs  (DB: affiliate)
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const DB = 'affiliate';

// auth (legacy: Session["Plid"] == null -> redirect Home/Index)
router.all(['/member/BuyPack/Index{/:id}', '/member/BuyPack'], auth, asyncHandler(async (req, res) => {
  res.json({ View: '~/Views/CustomerPanel/BuyPack/Index.cshtml' });
}));

// auth
router.all('/member/BuyPack/BuyPackOfEmail{/:id}', auth, asyncHandler(async (req, res) => {
  const { PackAmount, PackID } = req.p;
  const PLID = Number(req.user.plid);
  // PORT-NOTE: legacy SQL text only passes @PLID,@PackAmount,@PackID,@Mode,@STRRESULT Out (the other 8 SqlParameters in the array are never referenced); same here.
  const rows = await proc(DB, 'sp_purchasesmsoremailpackage', {
    plid: PLID, packamount: Number(PackAmount), packid: PackID, mode: 'Purchased Email Pack',
  });
  const row = rows[0] || {};
  const Result = row.strresult == null ? '' : String(row.strresult);
  res.json(Result);
}));

module.exports = router;
