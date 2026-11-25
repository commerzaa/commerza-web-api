'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Ewallet_Rewards.cs (Ewallet_RewardsController) - 1 action: Index */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Ewallet_Rewards';
const outv = (rows, name) => { const r = rows && rows[0]; if (!r) return undefined; const k = Object.keys(r).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const intOrNull = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = Number(v); return Number.isInteger(n) ? n : null; };
const REWARD_PROPS = ['EWRID', 'FROMBUSINESS', 'TOBUSINESS', 'REWARDSAMOUNT', 'ADMINCHARGE', 'PAYBLEAMOUNT', 'REWARDNAME', 'FROMDATE', 'TODATE', 'STATUS', 'ACHIVED', 'REQUIRED', 'MATCHED'];

// route-config: referral/T4TBgWboF8TGvzM_plus_tQofQw==
// auth ([SessionExpireCheck])
// PORT-NOTE: OUT parameter @TOTALCOUNT of USP_GETEWALLET_REWARDS is read from the "totalcount" column of the first result row (missing/'' => 0 as in legacy).
router.all([`${P}/Index{/:id}`, '/member/referral/T4TBgWboF8TGvzM_plus_tQofQw=='], auth, asyncHandler(async (req, res) => {
  let page = intOrNull(req.p.page);
  let ddlcustpage = intOrNull(req.p.ddlcustpage);
  let { fromDate, toDate } = req.p;
  if (page == null) page = 1;
  if (ddlcustpage == null) ddlcustpage = 100;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  let GetEwalletReward = [];
  const ViewBag = {};
  try {
    const MaxRows = ddlcustpage;
    const rows = await proc(DB, 'usp_getewallet_rewards', {});
    GetEwalletReward = mapRows(rows, REWARD_PROPS);
    const tc = outv(rows, 'totalcount');
    const s = tc === undefined || tc === null ? '' : String(tc);
    const TotalRecord = s === '' ? 0 : parseInt(s, 10);
    if (Number.isNaN(TotalRecord)) throw new Error('Input string was not in a correct format.');
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.TotalReward = GetEwalletReward;
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'USP_GETEWALLET_REWARDS', 0, req.path); } catch (_) { /* ignore */ }
    return res.json({ redirect: '/page-not-found' });
  }
  res.json({ Model: GetEwalletReward, ...ViewBag });
}));

module.exports = router;
