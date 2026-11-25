'use strict';
// Port of Member\Common\Controllers\CustomerPanel\UpgradeLevelIncome.cs (UpgradeLevelIncomeController)
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
const UpgradeLevelIncome = ['ROWNUMBER', 'FROMUSERNAME', 'KIT_PRICE', 'AMOUNT', 'TDS_AMT', 'ADMIN_AMT', 'PARTICULAR', 'ISSKIP', 'INCOME'];

// route-config: referral/fFHM1sBF5bUFM41jr0qke_plus_UEBQQ6xFbq -> UpgradeLevelIncome/Index
// auth
router.all(['/member/UpgradeLevelIncome/Index{/:id}', '/member/referral/fFHM1sBF5bUFM41jr0qke_plus_UEBQQ6xFbq'], auth, asyncHandler(async (req, res) => {
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
  const rows = await db.proc(DB, 'usp_member_earning_history_flush', {
    plid: Math.trunc(Plid), startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
    fromdate: fromdate.trim(), todate: todate.trim(), mode: '1', incometype: '5',
  });
  const AllFreeEpinList = mapRows(rows, UpgradeLevelIncome);
  const tc = outv(rows, 'totalcount');
  const TotalRecord = parseInt(tc === null || String(tc) === '' ? '0' : String(tc), 10);
  res.json({
    Model: AllFreeEpinList, CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField, SearchValue, fromDate: fromdate, toDate: todate, ddlcustpage,
  });
}));

module.exports = router;
