'use strict';
/** Port of Controllers/MemberPanelCntrl/MyEarningsController.cs (6 routes) */
const express = require('express');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { query, proc } = require('../db');
const { mapRows, netDate } = require('../utils/shape');

const router = express.Router();

const S = (v) => (v === undefined || v === null || v === '' ? null : String(v));
const I = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim();
  return /^[+-]?\d+$/.test(s) ? parseInt(s, 10) : null;
};
const toInt = (v) => {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
};
const mapD = (rows, props, dates) => mapRows(rows, props).map((r) => {
  for (const d of dates) if (d in r) r[d] = netDate(r[d]);
  return r;
});

const WalletHistoryProps = ['ROWNUMBER', 'EarnedDate', 'EarnedMatchingPoints', 'EarnedDirectPoints', 'EarnedLevelPoints', 'EarnedTaskLevelPoints', 'EarnedGrowthLevelPoints', 'TotalEarnedPoints', 'Royality', 'CashReward', 'Status', 'PayId', 'id', 'EarnedBinaryLevelPoints', 'DAILYEARNEDROI', 'ISSKIP'];
const ReferralProps = ['ROWNUMBER', 'RDID', 'OPID', 'TOUSERNAME', 'TONAME', 'TOMOBILE', 'FROMUSERNAME', 'FROMNAME', 'FROMMOBILE', 'ORDERDATE', 'ORDERNO', 'ORDERAMOUNT', 'DATE', 'AMOUNT', 'ADMIN_AMT', 'TDS_AMT', 'INCOME', 'MERCHANTNAME', 'MERCHANTMOBILE', 'MERCHANTADDRESS', 'COMM_PER'];
const LevelHistoryProps = ['ROWNUMBER', 'FROMUSERNAME', 'PACKAGEAMT', 'COMMISSIONPERCENTAGE', 'COMMISSIONAMOUNT', 'ADMINCH', 'TDS', 'NETCOMMISSION', 'PARTICULAR', 'ishold', 'LEVEL', 'DATE', 'FROMNAME', 'TOUserName', 'TONAME', 'CITYNAME'];
const LevelIncomeProps = ['ROWNUMBER', 'FROMUSERNAME', 'PACKAGEAMT', 'COMMISSIONPERCENTAGE', 'COMMISSIONAMOUNT', 'ADMINCH', 'TDS', 'NETCOMMISSION', 'PARTICULAR', 'LEVEL', 'DATE'];
const AutoPurchaseProps = ['ROWNUMBER', 'USERNAME', 'Name', 'MOBILE', 'DATE', 'ADMINCHARGE', 'TDS', 'NetIncome', 'MatchCount', 'TotalIncome'];

/** Common prologue: returns normalized params or sends the "invalid" reply (returns null). */
function prep(req, res, invalidMsg) {
  const p = req.p;
  const plid = S(p.plid);
  if (plid == null) { res.json({ status: 'false', message: invalidMsg }); return null; }
  return {
    plid,
    SearchField: S(p.SearchField) ?? '',
    SearchValue: S(p.SearchValue) ?? '',
    fromdate: S(p.fromdate) ?? '',
    todate: S(p.todate) ?? '',
    page: I(p.page) ?? 1,
    MaxRows: 1000,
  };
}
// _Member_Master.Where(REGNO == Plid).FirstOrDefault() -> LOGINID ("" if none)
async function memberLoginId(Plid) {
  const rows = await query('affiliate', 'select loginid from member_master where regno = @plid limit 1', { plid: Plid });
  return rows.length > 0 ? rows[0].loginid : '';
}
const ok = (res, data) => res.json([{ status: 'true', message: 'success', data }]);

// auth
router.post('/api/DirectIncome', auth, asyncHandler(async (req, res) => {
  const a = prep(req, res, 'Invalid user'); if (!a) return;
  const Plid = toInt(a.plid);
  await memberLoginId(Plid);
  // PORT-NOTE: @TotalCount OUT parameter is not requested (never returned).
  const list = mapD(await proc('affiliate', 'usp_member_earning_history', {
    plid: Plid, startrowindex: a.page, maxrows: a.MaxRows,
    searchfield: a.SearchField.trim(), searchvalue: a.SearchValue.trim(),
    fromdate: a.fromdate.trim(), todate: a.todate.trim(),
    mode: '1', incometype: '1',
  }), WalletHistoryProps, ['EarnedDate']);
  ok(res, list);
}));

// auth
router.post('/api/ReferralIncome', auth, asyncHandler(async (req, res) => {
  const a = prep(req, res, 'Invalid User'); if (!a) return;
  const Plid = toInt(a.plid);
  await memberLoginId(Plid);
  const list = mapD(await proc('affiliate', 'usp_refferalincome', {
    plid: Plid, startrowindex: a.page, maxrows: a.MaxRows,
    searchfield: a.SearchField.trim(), searchvalue: a.SearchValue.trim(),
    fromdate: a.fromdate.trim(), todate: a.todate.trim(),
    incometype: 2,
  }), ReferralProps, ['ORDERDATE', 'DATE']);
  ok(res, list);
}));

// auth
router.post('/api/cashBackGenerationDistribution', auth, asyncHandler(async (req, res) => {
  const a = prep(req, res, 'Invalid User'); if (!a) return;
  const Plid = toInt(a.plid);
  const loginid = await memberLoginId(Plid);
  const mode = I(req.p.mode) ?? 1;
  const list = mapD(await proc('affiliate', 'usp_distibute_level_incomehistory', {
    loginid, startrowindex: a.page, maxrows: a.MaxRows,
    searchfield: a.SearchField.trim(), searchvalue: a.SearchValue.trim(),
    fromdate: a.fromdate.trim(), todate: a.todate.trim(),
    mode, levelincometype: 1,
  }), LevelHistoryProps, ['DATE']);
  ok(res, list);
}));

// auth
router.post('/api/AutoGlobalIncome', auth, asyncHandler(async (req, res) => {
  const a = prep(req, res, 'Invalid User'); if (!a) return;
  const Plid = toInt(a.plid);
  await memberLoginId(Plid);
  const list = mapD(await proc('affiliate', 'usp_level_incomes', {
    plid: Plid, startrowindex: a.page, maxrows: a.MaxRows,
    searchfield: a.SearchField.trim(), searchvalue: a.SearchValue.trim(),
    fromdate: a.fromdate.trim(), todate: a.todate.trim(),
    mode: '1',
  }), LevelIncomeProps, ['DATE']);
  ok(res, list);
}));

// auth
router.post('/api/AutoPurchaseIncome', auth, asyncHandler(async (req, res) => {
  const a = prep(req, res, 'Invalid'); if (!a) return;
  const Plid = toInt(a.plid);
  await memberLoginId(Plid);
  // PORT-NOTE: OUT params @TOTALCOUNT/@TOTALINCOME/@TOTALNETINCOME are not requested (never returned).
  const list = mapD(await proc('affiliate', 'usp_auto_purchaseincome', {
    startrowindex: a.page, maxrows: a.MaxRows, regno: Plid,
    searchfield: a.SearchField.trim(), searchvalue: a.SearchValue.trim(),
    fromdate: a.fromdate.trim(), todate: a.todate.trim(),
  }), AutoPurchaseProps, ['DATE']);
  ok(res, list);
}));

// auth
router.post('/api/GenerationIncome', auth, asyncHandler(async (req, res) => {
  const a = prep(req, res, 'Invalid user'); if (!a) return;
  const Plid = toInt(a.plid);
  const loginid = await memberLoginId(Plid);
  const list = mapD(await proc('affiliate', 'usp_level_incomehistory', {
    loginid, startrowindex: a.page, maxrows: a.MaxRows,
    searchfield: a.SearchField.trim(), searchvalue: a.SearchValue.trim(),
    fromdate: a.fromdate.trim(), todate: a.todate.trim(),
    mode: '1', levelincometype: 1,
  }), LevelHistoryProps, ['DATE']);
  ok(res, list);
}));

module.exports = router;
