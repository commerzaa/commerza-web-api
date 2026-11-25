'use strict';
// Port of Member\Common\Controllers\CustomerPanel\Direct_Member_Reward.cs (Common.Controllers.CustomerPanel.Direct_Member_RewardController)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');
const DB = 'affiliate';
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row.
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : null);
const errorInsert = async (e, procName, req) => {
  try { await new DataUtility().ErrorInsert(0, e && e.message, procName, 0, req.path); } catch (_) { /* ignore */ }
};
const orEmpty = (v) => (v === undefined || v === null ? '' : String(v));
const DirectMemberReward = ['ROWNUMBER', 'USERNAME', 'NAME', 'REWARDNAME', 'TOTALDIRECT', 'LEFTDIRECT', 'RIGHTDIRECT', 'TOTALBUSSINESS', 'LEFTBUSSINESS', 'RIGHTBUSSINESS', 'ACHIVEDATE', 'TOTALREWARDAMOUNT', 'REWARDAMOUNT', 'ADMINCHARGE', 'TDSCHARGE', 'WALLETTYPE', 'STATUS'];

// route-config: referral/SS5GxP8qbhKOu6_plus_d_plus_PajG0EPyAzYrzE5 -> Direct_Member_Reward/Index
// auth
router.all(['/member/Direct_Member_Reward/Index{/:id}', '/member/referral/SS5GxP8qbhKOu6_plus_d_plus_PajG0EPyAzYrzE5'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const Plid = parseInt(req.user.plid, 10);
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page === undefined || p.page === '' ? 1 : parseInt(p.page, 10);
  const fromDate = orEmpty(p.fromDate);
  const toDate = orEmpty(p.toDate);
  const SearchField = orEmpty(p.SearchField);
  const SearchValue = orEmpty(p.SearchValue);
  let Obj = [];
  const ViewBag = {};
  try {
    // PORT-NOTE: the legacy call text was "...@FROMDATE,TODATE,@TOTALCOUNT OUT" (bare word TODATE, no "@"): T-SQL passes the literal
    // string 'TODATE' positionally as the to-date argument. The same literal is sent here.
    const rows = await db.proc(DB, 'usp_directbonanazreward', {
      regno: Plid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
      fromdate: fromDate.trim(), todate: toDate,
    });
    Obj = mapRows(rows, DirectMemberReward);
    const tc = outv(rows, 'totalcount');
    if (tc === null) throw new TypeError('Object reference not set to an instance of an object.');
    const TotalRecord = parseInt(String(tc), 10);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  } catch (ExpObj) {
    await errorInsert(ExpObj, 'USP_PURCHASE_COIN_FOR_HOLD_NEW_LIST', req);
    return res.json({ redirect: '/page-not-found' });
  }
  return res.json({ Model: Obj, ...ViewBag });
}));

module.exports = router;
