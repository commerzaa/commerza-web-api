'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Direct_Rewards.cs (Direct_RewardsController)
 * Prefix: /member   DB: affiliate (DataBaseContext => Db_Affiliate)
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';

const PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'REWARDNAME', 'NOOFDIRECT', 'LEFTDIRECT', 'RIGHTDIRECT', 'TOTALBUSINESS', 'LEFTBUSSINECT', 'RIGHTBUSSINESS',
  'REWARDAMOUNT', 'ADMINCHARGE', 'TDSCHARGE', 'WALLETTYPE', 'WALLETNAME', 'WITHINDAYS', 'DATE', 'ACTIVE', 'STATUS', 'FromDate', 'ToDate'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const toInt = (v, d) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };
const totalOf = (rows, name) => {
  const f = rows && rows[0];
  if (!f) return 0;
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  const n = k === undefined ? NaN : parseInt(f[k], 10);
  return Number.isNaN(n) ? 0 : n;
};

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: referral/SS5GxP8qbhKOu6_plus_d_fg  (Direct_Rewards / Index)
// auth
router.all(['/member/Direct_Rewards/Index{/:id}', '/member/referral/SS5GxP8qbhKOu6_plus_d_fg'], auth, asyncHandler(async (req, res) => {
  const Plid = Math.trunc(Number(req.user.plid));
  const MaxRows = await UtilityClass.GridPageSize();
  const page = toInt(req.p.page, 1);
  const fromDate = nn(req.p.fromDate);
  const toDate = nn(req.p.toDate);
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  let Obj = [];
  const ViewBag = {};
  try {
    // FIXED (was a legacy bug, now passes the real toDate). Original note: legacy SQL text was "...@FROMDATE,TODATE,@TOTALCOUNT OUT" (missing '@'): SQL Server therefore passed the bare literal 'TODATE' as the
    // 7th positional argument and the @TODATE SqlParameter was ignored. That behaviour is reproduced (todate: toDate); remove it to pass the real toDate.
    // @TOTALCOUNT OUT is read from the first result row (column totalcount); 0 when no rows.
    const rows = await proc(DB, 'usp_directbonanazrewardby_member', {
      regno: Plid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate, todate: toDate,
    });
    Obj = mapRows(rows, PROPS);
    const TotalRecord = totalOf(rows, 'totalcount');
    Object.assign(ViewBag, {
      fromDate, toDate, CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    });
  } catch (e) {
    console.error(e);
    try { await new DataUtility().ErrorInsert(0, e.message, 'USP_PURCHASE_COIN_FOR_HOLD_NEW_LIST', 0, req.path); } catch (e2) { console.error(e2); }
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found")
  }
  return res.json({ view: '~/Views/CustomerPanel/Direct_Rewards/Index.cshtml', Model: Obj, ViewBag });
}));

module.exports = router;
