'use strict';
// Ported from Member/Controllers/CustomerPanel/Member_Joining_Reward.cs  (DB: affiliate)
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const DB = 'affiliate';
const MemberJoiningReward = ['ROWNUMBER', 'USERNAME', 'NAME', 'REWARDNAME', 'TOTALDIRECT', 'LEFTDIRECT', 'RIGHTDIRECT', 'TOTALDOWNLINE', 'LEFTDOWNLINE', 'RIGHTDOWNLINE', 'ACHIVEDATE', 'STATUS'];

// auth (legacy: Session["Plid"] == null -> redirect Home/Index). route-config: url "referral/HuRhpfq6C4GO4FNq68tK_plus_jxX8G_plus_r_plus_dx5"
router.all(['/member/Member_Joining_Reward/Index{/:id}', '/member/Member_Joining_Reward', '/member/referral/HuRhpfq6C4GO4FNq68tK_plus_jxX8G_plus_r_plus_dx5'], auth, asyncHandler(async (req, res) => {
  const Plid = Math.trunc(Number(req.user.plid));
  const MaxRows = await UtilityClass.GridPageSize();
  let { page, fromDate, toDate, SearchField, SearchValue } = req.p;
  if (page == null || page === '') page = 1; else page = Number(page);
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  let Obj = [];
  const ViewBag = {};
  try {
    // FIXED (was a legacy bug, now passes the real toDate). Original note: the legacy SQL text has "@FROMDATE,TODATE,@TOTALCOUNT OUT" (missing '@'), so T-SQL passed the literal string 'TODATE'
    // positionally as the @TODATE argument and the real toDate value was never sent. Reproduced as-is.
    const rows = await proc(DB, 'usp_member_joiningreward', {
      regno: Plid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue,
      fromdate: fromDate, todate: toDate,
    });
    Obj = mapRows(rows, MemberJoiningReward);
    // PORT-NOTE: @TOTALCOUNT OUT read from "totalcount" column of the first row (0 if none)
    const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'USP_PURCHASE_COIN_FOR_HOLD_NEW_LIST', 0, req.path); } catch (_) { /* ignore */ }
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found")
  }
  res.json({ View: '~/Views/CustomerPanel/Member_Joining_Reward/Index.cshtml', Model: Obj, ViewBag });
}));

module.exports = router;
