'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/ThirdPhaseTreeView.cs  (ThirdPhaseTreeViewController, 4 actions)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
// Session["Plid"] -> req.user.plid ; TempData["ParentID"]/["side"] -> utils/sessionStore keys 'TempData.ParentID' / 'TempData.side'
const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');

const DB = 'affiliate';
const BASE = '/member/ThirdPhaseTreeView';

// Index: session check -> auth
// route-config: referral/TQzVrV0o3J2c2FmEZnQtYQ==third-phase
// auth
router.all([`${BASE}/Index{/:id}`, BASE, '/member/referral/TQzVrV0o3J2c2FmEZnQtYQ==third-phase'], auth, asyncHandler(async (req, res) => {
  const Regno = String(req.user.plid);
  res.json({ view: '~/Views/CustomerPanel/ThirdPhaseTreeView/Index.cshtml', ViewBag: { RegNo: Regno } });
}));

// BindParentId(string parentRegno, int side): stores TempData for the next request (no session check in C#; per-user store => auth)
// auth
router.all(`${BASE}/BindParentId{/:id}`, auth, asyncHandler(async (req, res) => {
  sessionStore.set(req, 'TempData.ParentID', req.p.parentRegno);
  sessionStore.set(req, 'TempData.side', parseInt(req.p.side, 10));
  res.json('ok');
}));

// GetMemberRegno(string Regno): member_master by LOGINID (NullReferenceException in C# when not found => error 500)
// auth
router.all(`${BASE}/GetMemberRegno{/:id}`, auth, asyncHandler(async (req, res) => {
  const row = await queryOne(DB, 'select regno from member_master where loginid = @regno limit 1', { regno: req.p.Regno });
  if (!row) throw new Error('Object reference not set to an instance of an object.');
  res.json(row.regno);
}));

// BindTreeIcon: static lookup, no session check -> public
// public
router.all(`${BASE}/BindTreeIcon{/:id}`, asyncHandler(async (req, res) => {
  const rows = await query(DB, "SELECT coalesce(type,'') AS type, coalesce(img_male,'') AS img_male, coalesce(img_female,'') AS img_female FROM tbl_treeicon");
  res.json(mapRows(rows, ['TYPE', 'IMG_MALE', 'IMG_FEMALE']));
}));

module.exports = router;
