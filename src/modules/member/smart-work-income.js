'use strict';
// Port of Member\Common\Controllers\CustomerPanel\Smart_Work_IncomeController.cs (Smart_Work_IncomeController)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DB = 'affiliate';
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row.
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : null);
const orEmpty = (v) => (v === undefined || v === null ? '' : String(v));
const Smart_Work_Income = ['ROWNUMBER', 'USERNAME', 'Name', 'MOBILE', 'DATE', 'ADMINCHARGE', 'TDS', 'NetIncome', 'MatchCount', 'TotalIncome'];

// route-config: referral/smart-work-income-income -> Smart_Work_Income/Index
// auth
router.all(['/member/Smart_Work_Income/Index{/:id}', '/member/referral/smart-work-income-income'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const ddlcustpage = p.ddlcustpage === undefined || p.ddlcustpage === '' ? 100 : parseInt(p.ddlcustpage, 10);
  const SearchField = orEmpty(p.SearchField);
  const SearchValue = orEmpty(p.SearchValue);
  const fromdate = orEmpty(p.fromdate);
  const todate = orEmpty(p.todate);
  const Plid = Number(req.user.plid);
  await db.queryOne(DB, 'select loginid from member_master where regno=@plid limit 1', { plid: Plid }); // loginid (unused in legacy)
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page === undefined || p.page === '' ? 1 : parseInt(p.page, 10);
  const rows = await db.proc(DB, 'usp_smartworkincome', {
    startrowindex: page, maxrows: MaxRows, regno: Math.trunc(Plid), searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
    fromdate: fromdate.trim(), todate: todate.trim(),
  });
  const AllFreeList = mapRows(rows, Smart_Work_Income);
  const tc = outv(rows, 'totalcount');
  if (tc === null) throw new TypeError('Object reference not set to an instance of an object.');
  const TotalRecord = parseInt(String(tc), 10);
  res.json({
    Model: AllFreeList, CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField, SearchValue, fromDate: fromdate, toDate: todate, ddlcustpage,
  });
}));

module.exports = router;
