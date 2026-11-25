'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\BinaryLevelBonus.cs (BinaryLevelBonusController) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/BinaryLevelBonus';
const PROPS = ['ROWNUMBER', 'EarnedDate', 'EarnedMatchingPoints', 'EarnedDirectPoints', 'EarnedLevelPoints', 'EarnedTaskLevelPoints',
  'EarnedGrowthLevelPoints', 'TotalEarnedPoints', 'Royality', 'CashReward', 'Status', 'PayId', 'id', 'EarnedBinaryLevelPoints',
  'DAILYEARNEDROI', 'ISSKIP'];
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };

// auth (null session => RedirectToAction("Index","Home"))
// route-config: "referral/uZZrQTKP0u2CSiBA3FKkL5zYWYRmdC1h" -> BinaryLevelBonus/Index
router.all([`${P}/Index{/:id}`, P, '/member/referral/uZZrQTKP0u2CSiBA3FKkL5zYWYRmdC1h'], auth, asyncHandler(async (req, res) => {
  try {
    let { SearchField, SearchValue, fromdate, todate } = req.p;
    let page = toInt(req.p.page);
    let ddlcustpage = toInt(req.p.ddlcustpage);
    if (ddlcustpage == null) ddlcustpage = 100;
    if (SearchField == null) SearchField = '';
    if (SearchValue == null) SearchValue = '';
    if (fromdate == null) fromdate = '';
    if (todate == null) todate = '';
    const Plid = Number(req.user.plid);
    // (legacy also looked up member_master LOGINID here but never used it)
    const MaxRows = await UtilityClass.GridPageSize();
    if (page == null) page = 1;
    const rows = await proc(DB, 'usp_member_earning_history', {
      plid: Math.trunc(Plid), startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
      fromdate: fromdate.trim(), todate: todate.trim(), mode: 1, incometype: 1,
    });
    // PORT-NOTE: @TotalCount OUT read from the "totalcount" column of the first row (0 when there are no rows)
    const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
    res.json({
      Model: mapRows(rows, PROPS),
      ViewBag: {
        CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
        SearchField, SearchValue, fromDate: fromdate, toDate: todate, ddlcustpage,
      },
    });
  } catch (Exp) {
    console.error(Exp.message);
    res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found")
  }
}));

module.exports = router;
