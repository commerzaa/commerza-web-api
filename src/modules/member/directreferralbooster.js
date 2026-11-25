'use strict';
// Ported from Member\Controllers\CustomerPanel\Directreferralbooster.cs (1 action) - database: affiliate (Db_Affiliate)
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

// auth
// route-config: referral/fFHM1sBF5bUFM41jr0qke_plus_UEBQQ6xFbq11 -> Index
router.all(['/member/Directreferralbooster/Index{/:id}', '/member/referral/fFHM1sBF5bUFM41jr0qke_plus_UEBQQ6xFbq11'], auth, asyncHandler(async (req, res) => {
  let ddlcustpage = intOrNull(req.p.ddlcustpage); let page = intOrNull(req.p.page);
  if (ddlcustpage === null) ddlcustpage = 100;
  const SearchField = nz(req.p.SearchField); const SearchValue = nz(req.p.SearchValue);
  const fromdate = nz(req.p.fromdate); const todate = nz(req.p.todate);
  const Plid = Number(req.user.plid);
  // loginid lookup (Member_Master.LOGINID) was unused by the legacy action; omitted (no side effects).
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_MEMBER_EARNING_HISTORY', {
    PLID: Math.trunc(Plid), STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
    FROMDATE: fromdate.trim(), TODATE: todate.trim(), MODE: '1', INCOMETYPE: '4',
  });
  const Model = mapRows(rows, ['ROWNUMBER', 'EarnedDate', 'EarnedMatchingPoints', 'EarnedDirectPoints', 'EarnedLevelPoints', 'EarnedTaskLevelPoints',
    'EarnedGrowthLevelPoints', 'TotalEarnedPoints', 'Royality', 'CashReward', 'Status', 'PayId', 'id', 'EarnedBinaryLevelPoints', 'DAILYEARNEDROI']);
  const TotalRecord = parseInt(String(outv(rows, 'TotalCount')), 10) || 0;
  res.json({
    Model, CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField, SearchValue, fromDate: fromdate, toDate: todate, ddlcustpage,
  });
}));

module.exports = router;
