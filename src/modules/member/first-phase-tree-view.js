'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\FirstPhaseTreeView.cs (FirstPhaseTreeViewController) */
const express = require('express');
const { query, queryOne, scalar, proc, procOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/FirstPhaseTreeView';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const intOrNull = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const numIfNumeric = (v) => (v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v);
async function ErrorInsert(e, name, req) {
  try { await new DataUtility().ErrorInsert(0, e.message, name, 0, req.path); } catch (_) { /* ignore */ }
}
// PORT-NOTE: OUT params (@TotalCount ...) of paged procedures are read from the result columns of the proc rows (totalcount).
const outCol = (rows, name) => (rows.length && rows[0][name] !== undefined && rows[0][name] !== null ? rows[0][name] : null);
const totalOf = (rows) => { const t = outCol(rows, 'totalcount'); return t === null || String(t) === '' ? 0 : parseInt(t, 10); };

// route-config: referral/TQzVrV0o3J2c2FmEZnQtYQ==first-phase
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/TQzVrV0o3J2c2FmEZnQtYQ==first-phase'], auth, asyncHandler(async (req, res) => {
  res.json({ ViewBag: { RegNo: String(req.user.plid) } });
}));

// auth
router.all(`${P}/BindParentId{/:id}`, auth, asyncHandler(async (req, res) => {
  // TempData["ParentID"] / TempData["side"] kept server-side
  sessionStore.set(req, 'TempData_ParentID', req.p.parentRegno);
  sessionStore.set(req, 'TempData_side', parseInt(req.p.side, 10));
  res.json('ok');
}));

// auth
router.all(`${P}/GetMemberRegno{/:id}`, auth, asyncHandler(async (req, res) => {
  const MemberList = await queryOne(DB, 'select * from member_master where loginid = @l limit 1', { l: req.p.Regno });
  if (!MemberList) throw new TypeError('Object reference not set to an instance of an object.');
  res.json(MemberList.regno);
}));

// auth
router.all(`${P}/BindTreeIcon{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await query(DB, "SELECT coalesce(TYPE,'') AS TYPE ,coalesce(IMG_MALE,'') AS IMG_MALE,coalesce(IMG_FEMALE,'') AS IMG_FEMALE FROM TBL_TREEICON");
  res.json(mapRows(rows, ['TYPE', 'IMG_MALE', 'IMG_FEMALE']));
}));

module.exports = router;
