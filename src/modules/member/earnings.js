'use strict';
/** Port of Member/Controllers/CustomerPanel/Earnings.cs (EarningsController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { proc, exec } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';

const WALLET_PROPS = ['ROWNUMBER', 'EarnedDate', 'EarnedMatchingPoints', 'EarnedDirectPoints', 'EarnedLevelPoints', 'EarnedTaskLevelPoints', 'EarnedGrowthLevelPoints',
  'TotalEarnedPoints', 'Royality', 'CashReward', 'Status', 'PayId', 'id', 'EarnedBinaryLevelPoints', 'DAILYEARNEDROI', 'ISSKIP'];
const DETAIL_PROPS = ['ROWNUMBER', 'EarnedDate', 'MatchingBv', 'EarnedPoints', 'FromUserName', 'IncomeType', 'Payid', 'Amount', 'Level', 'Comm_Per', 'ADMIN_AMT', 'ADMIN_PER', 'REMARK'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const optInt = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const outCol = (rows, name) => { const f = Array.isArray(rows) ? rows[0] : rows; if (!f) return ''; const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined || f[k] === null ? '' : String(f[k]); };
const totalOf = (rows, name) => { const n = parseInt(outCol(rows, name), 10); return Number.isNaN(n) ? 0 : n; };
// Convert.ToInt32(string): null => 0, non-numeric => FormatException
const convInt = (v) => {
  if (v === undefined || v === null) return 0;
  if (!/^\s*[+-]?\d+\s*$/.test(String(v))) throw new Error('Input string was not in a correct format.');
  return parseInt(v, 10);
};

// route-config: referral/earnings -> Index
// auth
router.all(['/member/Earnings/Index{/:id}', '/member/referral/earnings'], auth, asyncHandler(async (req, res) => {
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  const fromdate = nn(req.p.fromdate);
  const todate = nn(req.p.todate);
  let page = optInt(req.p.page);
  let ddlcustpage = optInt(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;

  const Plid = Number(req.user.plid);
  // (legacy looked up Member_Master.LOGINID into an unused local; not needed)
  const MaxRows = ddlcustpage;
  if (page === null) page = 1;
  // PORT-NOTE: @TotalCount OUT param is returned as a column of the result row.
  const rows = await proc(DB, 'usp_member_earning_history', {
    plid: Math.trunc(Plid), startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
    fromdate: fromdate.trim(), todate: todate.trim(),
  });
  const AllFreeEpinList = mapRows(rows, WALLET_PROPS);
  const ViewBag = {
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord: totalOf(rows, 'totalcount'),
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField,
    SearchValue,
    fromDate: fromdate,
    toDate: todate,
    ddlcustpage,
  };
  res.json({ view: '~/Views/CustomerPanel/Earnings/Index.cshtml', Model: AllFreeEpinList, ViewBag });
}));

// auth
router.all('/member/Earnings/BtnSubmitRequest{/:id}', auth, asyncHandler(async (req, res) => {
  const DIID = req.p.DIID;
  // PORT-NOTE: DIRECT_INCOME is not in the PostgreSQL table dump; IsRequestedForWithDrawal (bit) is assumed to be boolean.
  const Ret = await exec(DB, 'UPDATE direct_income SET isrequestedforwithdrawal=true,requesteddate=now() WHERE diid=@diid', { diid: DIID });
  res.json(Ret);
}));

// auth
router.all('/member/Earnings/GetEarning{/:id}', auth, asyncHandler(async (req, res) => {
  const Earninigdate = req.p.Earninigdate;
  const Mode = req.p.Mode;
  const member_plid = Number(req.user.plid);
  const Rows = 100;
  // PORT-NOTE: @TotalCount OUT param is not used by the action.
  const rows = await proc(DB, 'usp_member_earning_history', {
    plid: Math.trunc(member_plid), startrowindex: 1, maxrows: Rows, searchfield: '', searchvalue: '', fromdate: Earninigdate.trim(), todate: '',
    mode: convInt(Mode), incometype: '8',
  });
  res.json(mapRows(rows, DETAIL_PROPS));
}));

module.exports = router;
