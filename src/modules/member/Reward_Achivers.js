'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/Reward_Achivers.cs  (Reward_AchiversController, 2 actions)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const DB = 'affiliate';
const BASE = '/member/Reward_Achivers';
const PROPS = ['ROWNUMBER', 'RAID', 'REWARDNAME', 'REWARDAMOUNT', 'MATCHAMOUNT', 'ACHIVEDATE', 'FROMDATE', 'TODATE', 'ClaimStatus'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const outv = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
async function errInsert(req, name, e) {
  try { const DataUtility = require('../../lib/member/DataUtility'); await new DataUtility().ErrorInsert(0, e && e.message, name, 0, req.path); } catch (_) { /* ErrorInsert must never throw */ }
}

// Index(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// route-config: referral/c3kYzKpqZGPu3qSgL8AuAw==
// auth
router.all([`${BASE}/Index{/:id}`, BASE, '/member/referral/c3kYzKpqZGPu3qSgL8AuAw=='], auth, asyncHandler(async (req, res) => {
  try {
    let ddlcustpage = toInt(req.p.ddlcustpage);
    if (ddlcustpage === null) ddlcustpage = 100;
    const SearchField = nn(req.p.SearchField);
    const SearchValue = nn(req.p.SearchValue);
    const fromdate = nn(req.p.fromdate);
    const todate = nn(req.p.todate);
    const Plid = Number(req.user.plid);
    // (the C# also read member_master.LOGINID into an unused local - dropped, no side effect)
    const MaxRows = await UtilityClass.GridPageSize();
    let page = toInt(req.p.page);
    if (page === null) page = 1;
    // PORT-NOTE: @TOTALCOUNT OUT is read from the "totalcount" column of the first result row (0 when no rows)
    const rows = await proc(DB, 'usp_all_rewardachivers', {
      regno: Math.trunc(Plid), startrowindex: page, maxrows: MaxRows, fromdate, todate,
    });
    const RewardAchive = mapRows(rows, PROPS);
    const tr = parseInt(outv(rows[0], 'totalcount'), 10);
    const TotalRecord = Number.isNaN(tr) ? 0 : tr;
    const ViewBag = {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      SearchField, SearchValue, fromDate: fromdate, toDate: todate, ddlcustpage,
    };
    return res.json({ view: '~/Views/CustomerPanel/Reward_Achivers/Index.cshtml', Model: RewardAchive, ViewBag });
  } catch (ExpObj) {
    await errInsert(req, 'USP_ALL_REWARDACHIVERS', ExpObj);
    return res.json({ redirect: '/page-not-found' });
  }
}));

// InsertClaimType(string RAID, string PayMode)
// auth
router.all(`${BASE}/InsertClaimType{/:id}`, auth, asyncHandler(async (req, res) => {
  const raid = parseInt(req.p.RAID, 10);
  const paymode = parseInt(req.p.PayMode, 10);
  if (Number.isNaN(raid) || Number.isNaN(paymode)) throw new Error('Input string was not in a correct format.');
  // PORT-NOTE: @INTRESULT OUT is read from the "intresult" column of the single result row
  const row = await proc(DB, 'usp_insertclaimtype', { raid, paymode });
  const v = outv(row[0], 'intresult');
  res.json(v === null || v === undefined ? '' : String(v));
}));

module.exports = router;
