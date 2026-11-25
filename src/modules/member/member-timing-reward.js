'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Member_Timing_Reward.cs (Member_Timing_RewardController) */
const express = require('express');
const { query, queryOne, scalar, proc, procOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Member_Timing_Reward';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const intOrNull = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const numIfNumeric = (v) => (v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v);
async function ErrorInsert(e, name, req) {
  try { await new DataUtility().ErrorInsert(0, e.message, name, 0, req.path); } catch (_) { /* ignore */ }
}
// PORT-NOTE: OUT params (@TotalCount ...) of paged procedures are read from the result columns of the proc rows (totalcount).
const outCol = (rows, name) => (rows.length && rows[0][name] !== undefined && rows[0][name] !== null ? rows[0][name] : null);
const totalOf = (rows) => { const t = outCol(rows, 'totalcount'); return t === null || String(t) === '' ? 0 : parseInt(t, 10); };
const P_MTR = ['ROWNUMBER', 'USERNAME', 'NAME', 'REWARDNAME', 'ACHIVEDATE', 'TOTALREWARDAMOUNT', 'REWARDAMOUNT', 'ADMINCHARGE', 'TDSCHARGE', 'WALLETTYPE', 'STATUS'];

// route-config: referral/V5w1B9hRcD8atvZ9V43xGkEPyAzYrzE5
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/V5w1B9hRcD8atvZ9V43xGkEPyAzYrzE5'], auth, asyncHandler(async (req, res) => {
  const Plid = parseInt(req.user.plid, 10);
  const MaxRows = UtilityClass.GridPageSize();
  let page = intOrNull(req.p.page);
  if (page === null) page = 1;
  let { fromDate, toDate, SearchField, SearchValue } = req.p;
  if (fromDate === undefined || fromDate === null) fromDate = '';
  if (toDate === undefined || toDate === null) toDate = '';
  if (SearchField === undefined || SearchField === null) SearchField = '';
  if (SearchValue === undefined || SearchValue === null) SearchValue = '';
  let Obj = [];
  const ViewBag = {};
  try {
    // FIXED (was a legacy bug, now passes the real toDate). Original note: the legacy SQL text was "...@FROMDATE,TODATE,@TOTALCOUNT OUT" (missing @), so the literal 'TODATE' is what the proc received for @TODATE.
    const rows = await proc(DB, 'usp_membertiming_reward', { regno: Plid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate, todate: toDate });
    Obj = mapRows(rows, P_MTR);
    const tc = outCol(rows, 'totalcount');
    if (tc === null) throw new Error('Input string was not in a correct format.');
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = parseInt(tc, 10);
    ViewBag.NoPerPage = UtilityClass.GridNumbersPerPage();
  } catch (ExpObj) {
    await ErrorInsert(ExpObj, 'USP_PURCHASE_COIN_FOR_HOLD_NEW_LIST', req);
    return res.json({ redirect: '/page-not-found' });
  }
  res.json({ Model: Obj, ViewBag });
}));

module.exports = router;
