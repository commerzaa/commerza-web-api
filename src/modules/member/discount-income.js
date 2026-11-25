'use strict';
// Ported from Member\Controllers\CustomerPanel\Discount_Income.cs (1 action) - database: affiliate (Db_Affiliate)
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
// route-config: referral/F83lClf5QCYJxYsrypa3kA== -> Index
router.all(['/member/Discount_Income/Index{/:id}', '/member/referral/F83lClf5QCYJxYsrypa3kA=='], auth, asyncHandler(async (req, res) => {
  let ddlcustpage = intOrNull(req.p.ddlcustpage); let page = intOrNull(req.p.page);
  if (ddlcustpage === null) ddlcustpage = 100;
  const fromdate = nz(req.p.fromdate); const todate = nz(req.p.todate);
  const SearchField = nz(req.p.SearchField); const SearchValue = nz(req.p.SearchValue);
  const Plid = Number(req.user.plid);
  const MaxRows = ddlcustpage;
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_DISCOUNT_MEMBERINCOME', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: fromdate, TODATE: todate, PLID: Plid,
  });
  const Model = mapRows(rows, ['ROWNUMBER', 'FROMUSERNAME', 'TOUSERNAME', 'DATE', 'INCOME', 'LEVEL']);
  const TotalRecord = parseInt(String(outv(rows, 'TOTALCOUNT')), 10) || 0;
  res.json({
    Model, CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    fromDate: fromdate, toDate: todate, SearchField, SearchValue, ddlcustpage,
  });
}));

module.exports = router;
