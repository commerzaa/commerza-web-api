'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/OverallEarnings.cs (OverallEarningsController, 1 action: Index)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: OverallBonus -> referral/N2Y7_plus_EHVnk2ECCuzby4Hqg==
 */
const express = require('express');
const { queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const C = 'OverallEarnings';

const nz = (v) => (v === undefined || v === null ? '' : v);
const optInt = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const colOf = (rows, n) => { const r = rows && rows[0]; if (!r) return null; const k = Object.keys(r).find((x) => x.toLowerCase() === n.toLowerCase()); return k === undefined ? null : r[k]; };
const P_EARN = ['ROWNUMBER', 'EarnedDate', 'EarnedMatchingPoints', 'EarnedDirectPoints', 'EarnedLevelPoints', 'EarnedTaskLevelPoints', 'EarnedGrowthLevelPoints', 'TotalEarnedPoints', 'Royality',
  'CashReward', 'Status', 'PayId', 'id', 'EarnedBinaryLevelPoints', 'DAILYEARNEDROI', 'ISSKIP'];

// ---- Index ------------------------------------------------------------------------------------------------------
// auth
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/N2Y7_plus_EHVnk2ECCuzby4Hqg=='], auth, asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, fromdate, todate } = req.p;
  let page = optInt(req.p.page);
  let ddlcustpage = optInt(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;
  SearchField = nz(SearchField); SearchValue = nz(SearchValue); fromdate = nz(fromdate); todate = nz(todate);
  const Plid = Number(req.user.plid);
  let loginid = '';
  const row = await queryOne(DB, 'select * from member_master where regno=@plid limit 1', { plid: Plid });
  if (row) loginid = row.loginid;
  void loginid;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  // PORT-NOTE: @TOTALCOUNT and the Earned*/Total* OUT params are same-named columns of the first result row (0 when empty)
  const raw = await proc(DB, 'usp_ovealallearnings', {
    plid: Math.trunc(Plid), startrowindex: page, maxrows: MaxRows, searchfield: String(SearchField).trim(), searchvalue: String(SearchValue).trim(), fromdate: String(fromdate).trim(),
    todate: String(todate).trim(), mode: '1', incometype: '1',
  });
  const num = (n) => Number(colOf(raw, n) || 0);
  const ViewBag = {};
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = num('totalcount');
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.ddlcustpage = ddlcustpage;
  ViewBag.EarnedMatchingPoints = num('earnedmatchingpoints');
  ViewBag.EarnedDirectPoints = num('earneddirectpoints');
  ViewBag.EarnedLevelPoints = num('earnedlevelpoints');
  ViewBag.EarnedTaskLevelPoints = num('earnedtasklevelpoints');
  ViewBag.TotalRoyality = num('totalroyality');
  ViewBag.TotalCashReward = num('totalcashreward');
  res.json({ Model: mapRows(raw, P_EARN), ViewBag });
}));

module.exports = router;
