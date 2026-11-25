'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/Repurchage_Income.cs  (Repurchage_IncomeController, 1 action)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
const express = require('express');
const router = express.Router();
const { proc, queryOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const DB = 'affiliate';
const BASE = '/member/Repurchage_Income';
const PROPS = ['ROWNUMBER', 'PAYDATE', 'MPID', 'LOGINID', 'PAYFROM', 'PAYTO', 'BINARYINCOME', 'GROUPBONUS', 'ACTIVE', 'PAYID', 'USERNAME', 'NAME', 'OLBV', 'ORBV', 'CRBV', 'CLBV',
  'TLBV', 'TRBV', 'MATCHBV', 'PAIDBV', 'FLUSHBV', 'CFLBV', 'CFRBV', 'Mobile', 'EmailID', 'TDS', 'ADMINCHARGE'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const outv = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };

// Index(int? payid, string SearchField, string SearchValue, string fromDate, string toDate, int? page)
// route-config: referral/G3pAMJ553_slash_HsviMO8onb_slash_QNpSHiI1Nu0
// auth
router.all([`${BASE}/Index{/:id}`, BASE, '/member/referral/G3pAMJ553_slash_HsviMO8onb_slash_QNpSHiI1Nu0'], auth, asyncHandler(async (req, res) => {
  let payid = toInt(req.p.payid);
  if (payid === null) payid = 0;
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  const toDate = nn(req.p.toDate);
  const fromDate = nn(req.p.fromDate);
  const Plid = Number(req.user.plid);
  const MaxRows = await UtilityClass.GridPageSize();
  let page = toInt(req.p.page);
  if (page === null) page = 1;
  let loginid = '';
  const row = await queryOne(DB, 'select loginid from member_master where regno = @plid limit 1', { plid: Plid });
  if (row) loginid = row.loginid;
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows); @TOTALBINARYINCOME OUT is unused by the C#
  const rows = await proc(DB, 'usp_repurchage_member_payout', {
    startrowindex: page, maxrows: MaxRows, payid, regno: Plid, searchfield: '', searchvalue: '', fromdate: fromDate, todate: toDate, loginid, mode: 0,
  });
  const RepurchageIncome = mapRows(rows, PROPS);
  const tr = parseInt(outv(rows[0], 'totalcount'), 10);
  const TotalRecord = Number.isNaN(tr) ? 0 : tr;
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, payid,
  };
  res.json({ view: '~/Views/CustomerPanel/Repurchage_Income/Index.cshtml', Model: RepurchageIncome, ViewBag });
}));

module.exports = router;
