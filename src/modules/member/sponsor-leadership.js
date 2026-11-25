'use strict';
// Ported from Member\Controllers\CustomerPanel\Sponsor_Leadership.cs (1 action) - database: affiliate (Db_Affiliate)
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
// route-config: referral/yyrFqtvQ6VoQj_slash_mcpQqYhIlr2h_plus__plus__slash_07g -> Index
router.all(['/member/Sponsor_Leadership/Index{/:id}', '/member/referral/yyrFqtvQ6VoQj_slash_mcpQqYhIlr2h_plus__plus__slash_07g'], auth, asyncHandler(async (req, res) => {
  let ddlcustpage = intOrNull(req.p.ddlcustpage); let page = intOrNull(req.p.page);
  if (ddlcustpage === null) ddlcustpage = 100;
  const fromdate = nz(req.p.fromdate); const todate = nz(req.p.todate);
  const SearchField = nz(req.p.SearchField); const SearchValue = nz(req.p.SearchValue);
  const Plid = Number(req.user.plid);
  // loginid (Member_Master.USERNAME lookup) was read but never used by the legacy action; the lookup has no side effects and is omitted.
  const MaxRows = ddlcustpage;
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_GET_SPONSORLEADERSHIP', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: fromdate, TODATE: todate, PLID: Plid,
  });
  const Model = mapRows(rows, ['FROMUSERNAME', 'TOUSERNAME', 'Date', 'BASEAMOUNT', 'INCOME']);
  const TotalRecord = parseInt(String(outv(rows, 'TOTALCOUNT')), 10) || 0;
  res.json({
    Model, CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    fromDate: fromdate, toDate: todate, SearchField, SearchValue, ddlcustpage,
  });
}));

module.exports = router;
