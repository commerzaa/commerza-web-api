'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/Royality_Statement.cs  (Royality_StatementController, 1 action)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const DB = 'affiliate';
const BASE = '/member/Royality_Statement';
const PROPS = ['QualifiedLevel', 'FromDate', 'ToDate', 'USERNAME', 'FNAME', 'GrossRoyality', 'AdminCahrge', 'Royality'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
async function errInsert(req, name, e) {
  try { const DataUtility = require('../../lib/member/DataUtility'); await new DataUtility().ErrorInsert(0, e && e.message, name, 0, req.path); } catch (_) { /* ErrorInsert must never throw */ }
}

// Index(int? page, string fromDate, string toDate)  [SessionExpireCheck]
// route-config: referral/1X_slash_c_plus_UA1SFKc2FmEZnQtYQ==
// auth
router.all([`${BASE}/Index{/:id}`, BASE, '/member/referral/1X_slash_c_plus_UA1SFKc2FmEZnQtYQ=='], auth, asyncHandler(async (req, res) => {
  const MaxRows = await UtilityClass.GridPageSize();
  let page = toInt(req.p.page);
  if (page === null) page = 1;
  const fromDate = nn(req.p.fromDate);
  const toDate = nn(req.p.toDate);
  let Obj = [];
  const ViewBag = {};
  try {
    const Plid = Number(req.user.plid);
    Obj = mapRows(await proc(DB, 'usp_royalityhistory', { plid: Plid }), PROPS);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = 0;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  } catch (ExpObj) {
    await errInsert(req, 'Usp_RoyalityHistory', ExpObj);
    return res.json({ redirect: '/page-not-found' });
  }
  res.json({ view: '~/Views/CustomerPanel/Royality_Statement/Index.cshtml', Model: Obj, ViewBag });
}));

module.exports = router;
