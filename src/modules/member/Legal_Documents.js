'use strict';
// Ported from Member\Controllers\CustomerPanel\Legal_Documents.cs (2 actions) - database: affiliate
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DB = 'affiliate';
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row (0 when absent).
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : 0);
const nz = (v) => (v === undefined || v === null ? '' : String(v));
const intOrNull = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
async function errorInsert(err, procName, req) { // legacy DataUtility.ErrorInsert(code, message, procedure, line, url)
  try {
    const DU = require('../../lib/member/DataUtility');
    const ut = typeof DU === 'function' ? new DU() : (DU.DataUtility ? new DU.DataUtility() : DU);
    await ut.ErrorInsert(0, err.message, procName, 0, req.path);
  } catch (e) { console.error(e.message); }
}
const TT = ['TLID', 'Type', 'Title', 'Desp', 'VUrl', 'Active', 'Date'];

// auth
// route-config: referral/legal-documents -> Index
router.all(['/member/Legal_Documents/Index{/:id}', '/member/referral/legal-documents'], auth, asyncHandler(async (req, res) => {
  const rows = await db.query(DB, 'select * from training_tool order by tlid desc');
  res.json({ Model: mapRows(rows, TT) });
}));

// public (legacy JsonResult had no session check)
router.all('/member/Legal_Documents/VideosCollection{/:id}', asyncHandler(async (req, res) => {
  const TLID = parseInt(req.p.TLID, 10);
  if (Number.isNaN(TLID)) return res.status(400).json({ message: "The parameters dictionary contains a null entry for parameter 'TLID'" });
  const rows = await db.query(DB, 'select * from training_tool where tlid=@tlid order by tlid desc', { tlid: TLID });
  res.json(mapRows(rows, TT));
}));

module.exports = router;
