'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\MyCommunity.cs (MyCommunityController) */
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
const P = '/member/MyCommunity';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const intOrNull = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const numIfNumeric = (v) => (v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v);
async function ErrorInsert(e, name, req) {
  try { await new DataUtility().ErrorInsert(0, e.message, name, 0, req.path); } catch (_) { /* ignore */ }
}
// PORT-NOTE: OUT params (@TotalCount ...) of paged procedures are read from the result columns of the proc rows (totalcount).
const outCol = (rows, name) => (rows.length && rows[0][name] !== undefined && rows[0][name] !== null ? rows[0][name] : null);
const totalOf = (rows) => { const t = outCol(rows, 'totalcount'); return t === null || String(t) === '' ? 0 : parseInt(t, 10); };
const P_TREE = ['REGNO','LoginId','Name','USERNAME','SPONSOR','ImageName','Regdate','PPV','PDAP','INTRO_REFID','PLID','TotalDirectCount','TotalReferralCount','Membername','Activationdate','MOBILE','EMAILID','ACTIVE','STATUS','Downlinecount','RANKID'];

// route-config: referral/cL5gx38HZFIHtb4vLbMTsg==
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/cL5gx38HZFIHtb4vLbMTsg=='], auth, asyncHandler(async (req, res) => {
  let Plid = 0;
  let username = req.p.username;
  if (username === undefined || username === null) username = '';
  const ViewBag = {};
  if (username === '') {
    Plid = parseInt(req.user.plid, 10);
    ViewBag.RegNo = Plid;
  }
  const ForceMatrix_Fileview = mapRows(await proc(DB, 'usp_genealogy_automatrix', { regno: Plid, username, mode: 1 }), P_TREE);
  ViewBag.RegNo = Plid;
  res.json({ Model: ForceMatrix_Fileview, ViewBag });
}));

// auth
router.all(`${P}/Gettreeview{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(mapRows(await proc(DB, 'usp_genealogy_automatrix', { regno: numIfNumeric(req.p.RegNo), username: '', mode: 2 }), P_TREE));
}));

// auth
router.all(`${P}/Getparticularmember{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(mapRows(await proc(DB, 'usp_genealogy_automatrix', { regno: 0, username: req.p.username, mode: 3 }), P_TREE));
}));

module.exports = router;
