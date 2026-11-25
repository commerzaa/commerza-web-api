'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/UpgradeLevelIncomeFlush.cs  (UpgradeLevelIncomeFlushController, 1 action)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const DB = 'affiliate';
const BASE = '/member/UpgradeLevelIncomeFlush';
const PROPS = ['ROWNUMBER', 'EarnedDate', 'EarnedMatchingPoints', 'EarnedDirectPoints', 'EarnedLevelPoints', 'EarnedTaskLevelPoints', 'EarnedGrowthLevelPoints',
  'TotalEarnedPoints', 'Royality', 'CashReward', 'Status', 'PayId', 'id', 'EarnedBinaryLevelPoints', 'DAILYEARNEDROI'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const outv = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };

// Index(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// route-config: referral/fFHM1sBF5bUFM41jr0qkezAFypQod13P  (id optional)
// auth
router.all([`${BASE}/Index{/:id}`, BASE, '/member/referral/fFHM1sBF5bUFM41jr0qkezAFypQod13P{/:id}'], auth, asyncHandler(async (req, res) => {
  let ddlcustpage = toInt(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  const fromdate = nn(req.p.fromdate);
  const todate = nn(req.p.todate);
  const Plid = Number(req.user.plid);
  // (the C# also read member_master by REGNO into an unused loginid - dropped, no side effect)
  const MaxRows = await UtilityClass.GridPageSize();
  let page = toInt(req.p.page);
  if (page === null) page = 1;
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const rows = await proc(DB, 'usp_member_earning_historyincomeflus', {
    plid: Math.trunc(Plid), startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
    fromdate: fromdate.trim(), todate: todate.trim(), mode: '1', incometype: '3',
  });
  const AllFreeEpinList = mapRows(rows, PROPS);
  const tr = parseInt(outv(rows[0], 'totalcount'), 10);
  const TotalRecord = Number.isNaN(tr) ? 0 : tr;
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField, SearchValue, fromDate: fromdate, toDate: todate, ddlcustpage,
  };
  res.json({ view: '~/Views/CustomerPanel/UpgradeLevelIncomeFlush/Index.cshtml', Model: AllFreeEpinList, ViewBag });
}));

module.exports = router;
