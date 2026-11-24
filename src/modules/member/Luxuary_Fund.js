'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Luxuary_Fund.cs (Luxuary_FundController) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Luxuary_Fund';
const PROPS = ['EWRID', 'FROMBUSINESS', 'TOBUSINESS', 'REWARDSAMOUNT', 'ADMINCHARGE', 'PAYBLEAMOUNT', 'REWARDNAME', 'FROMDATE', 'TODATE', 'STATUS'];
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };

// public (no session check in legacy; the procedure takes no member argument)
// route-config: "referral/Luxuary-Fund" -> Luxuary_Fund/Index
router.all([`${P}/Index{/:id}`, P, '/member/referral/Luxuary-Fund'], asyncHandler(async (req, res) => {
  let page = toInt(req.p.page);
  let ddlcustpage = toInt(req.p.ddlcustpage);
  let { fromDate, toDate } = req.p;
  if (page == null) page = 1;
  if (ddlcustpage == null) ddlcustpage = 100;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  let Luxuary_Fund = [];
  const ViewBag = {};
  try {
    const MaxRows = ddlcustpage;
    const rows = await proc(DB, 'usp_getewallet_rewards', {});
    Luxuary_Fund = mapRows(rows, PROPS);
    // PORT-NOTE: @TOTALCOUNT OUT read from the "totalcount" column of the first row (0 when there are no rows)
    const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
    Object.assign(ViewBag, {
      fromDate, toDate, CurrentPage: page, GridPageSize: MaxRows, TotalRecord,
      NoPerPage: await UtilityClass.GridNumbersPerPage(), TotalReward: Luxuary_Fund,
    });
  } catch (ExpObj) {
    console.error(ExpObj.message);
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'USP_GETEWALLET_REWARDS', 0, req.path); } catch (e) { console.error(e.message); }
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found")
  }
  res.json({ Model: Luxuary_Fund, ViewBag });
}));

module.exports = router;
