'use strict';
/** Port of Member/Controllers/CustomerPanel/Sponsor_Trade_Report.cs (Sponsor_Trade_ReportController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';

const PROPS = ['ROWNUMBER', 'TDTPID', 'FROMID', 'TOID', 'PAYID', 'DATE', 'STATUS', 'STP'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const optInt = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const outCol = (rows, name) => { const f = Array.isArray(rows) ? rows[0] : rows; if (!f) return ''; const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined || f[k] === null ? '' : String(f[k]); };
const totalOf = (rows, name) => { const n = parseInt(outCol(rows, name), 10); return Number.isNaN(n) ? 0 : n; };

// route-config: referral/Sponsor-Trade-Report -> Index
// auth
router.all(['/member/Sponsor_Trade_Report/Index{/:id}', '/member/referral/Sponsor-Trade-Report'], auth, asyncHandler(async (req, res) => {
  const fromdate = nn(req.p.fromdate);
  const todate = nn(req.p.todate);
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  let page = optInt(req.p.page);
  let ddlcustpage = optInt(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;

  const Plid = Number(req.user.plid);
  let loginid = '';
  const row = await queryOne(DB, 'SELECT username FROM member_master WHERE regno=@plid LIMIT 1', { plid: Plid });
  if (row) loginid = row.username;
  const MaxRows = ddlcustpage;
  if (page === null) page = 1;

  // PORT-NOTE: @TotalCount / @TOTALAMOUNT OUT params are returned as columns of the result row.
  const rows = await proc(DB, 'usp_sponsortradeprofitdetails', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromdate.trim(), todate: todate.trim(), loginid,
  });
  const LRMember = mapRows(rows, PROPS);
  const ViewBag = {
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord: totalOf(rows, 'totalcount'),
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    fromDate: fromdate,
    toDate: todate,
    SearchField,
    SearchValue,
    ddlcustpage,
  };
  res.json({ view: '~/Views/CustomerPanel/Sponsor_Trade_Report/Index.cshtml', Model: LRMember, ViewBag });
}));

module.exports = router;
