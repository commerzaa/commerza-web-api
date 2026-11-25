'use strict';
/** Port of Member/Controllers/CustomerPanel/Downline_Member_Reward.cs (Common.Controllers.CustomerPanel.Downline_Member_RewardController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';

const PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'REWARDNAME', 'TOTALDIRECT', 'LEFTDIRECT', 'RIGHTDIRECT', 'TOTALBUSSINESS', 'LEFTBUSSINESS', 'RIGHTBUSSINESS', 'ACHIVEDATE',
  'TOTALREWARDAMOUNT', 'REWARDAMOUNT', 'ADMINCHARGE', 'TDSCHARGE', 'WALLETTYPE', 'STATUS'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const optInt = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const outCol = (rows, name) => { const f = Array.isArray(rows) ? rows[0] : rows; if (!f) return ''; const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined || f[k] === null ? '' : String(f[k]); };

// route-config: referral/SS5GxP8qbhKOu6_plus_d_plus_PajG0EPyAzYrzE5DD -> Index
// auth
router.all(['/member/Downline_Member_Reward/Index{/:id}', '/member/referral/SS5GxP8qbhKOu6_plus_d_plus_PajG0EPyAzYrzE5DD'], auth, asyncHandler(async (req, res) => {
  const Plid = Math.trunc(Number(req.user.plid));
  const MaxRows = await UtilityClass.GridPageSize();
  let page = optInt(req.p.page);
  if (page === null) page = 1;
  const fromDate = nn(req.p.fromDate);
  const toDate = nn(req.p.toDate);
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  let Obj = [];
  const ViewBag = {};
  try {
    // FIXED (was a legacy bug, now passes the real toDate). Original note: the legacy SQL text was "...@FROMDATE,TODATE,@TOTALCOUNT OUT" (missing '@'), so the proc received the literal string 'TODATE'
    // as @TODATE and ignored the @TODATE SqlParameter. Reproduced as-is. @TOTALCOUNT OUT is read from the result row.
    const rows = await proc(DB, 'usp_downlinebonanazreward', {
      regno: Plid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate, todate: toDate,
    });
    Obj = mapRows(rows, PROPS);
    const n = parseInt(outCol(rows, 'totalcount'), 10);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = Number.isNaN(n) ? 0 : n;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  } catch (ExpObj) {
    await new DataUtility().ErrorInsert(0, ExpObj.message, 'USP_PURCHASE_COIN_FOR_HOLD_NEW_LIST', 0, req.originalUrl.split('?')[0]);
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found")
  }
  return res.json({ view: '~/Views/CustomerPanel/Downline_Member_Reward/Index.cshtml', Model: Obj, ViewBag });
}));

module.exports = router;
