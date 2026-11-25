'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Member_Rank_Reward.cs (Common.Controllers.CustomerPanel.Member_Rank_RewardController) - 1 action: Index */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Member_Rank_Reward';
const outv = (rows, name) => { const r = rows && rows[0]; if (!r) return undefined; const k = Object.keys(r).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const intOrNull = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = Number(v); return Number.isInteger(n) ? n : null; };
const need = (v) => { if (v === undefined || v === null || String(v).trim() === '' || Number.isNaN(Number(v))) throw new Error('Input string was not in a correct format.'); return Number(v); };
const RANK_PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'REWARDNAME', 'TOTALDIRECT', 'LEFTDIRECT', 'RIGHTDIRECT', 'TOTALBUSSINESS', 'LEFTBUSSINESS', 'RIGHTBUSSINESS',
  'ACHIVEDATE', 'TOTALREWARDAMOUNT', 'REWARDAMOUNT', 'ADMINCHARGE', 'TDSCHARGE', 'WALLETTYPE', 'STATUS'];

// route-config: referral/9XQZGOn9bD4Z5qX3LyCeKwAw5ZOZgEUv
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// PORT-NOTE: legacy SQL text was "@FROMDATE,TODATE,@TOTALCOUNT OUT" (missing '@' before TODATE); the real @todate value is passed here.
// PORT-NOTE: OUT parameter @TOTALCOUNT of USP_MEMBER_RANKREWARD is read from the "totalcount" column of the first result row.
router.all([`${P}/Index{/:id}`, '/member/referral/9XQZGOn9bD4Z5qX3LyCeKwAw5ZOZgEUv'], auth, asyncHandler(async (req, res) => {
  const Plid = Math.trunc(Number(req.user.plid));
  const MaxRows = await UtilityClass.GridPageSize();
  let page = intOrNull(req.p.page);
  let { fromDate, toDate, SearchField, SearchValue } = req.p;
  if (page == null) page = 1;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  let Obj = [];
  const ViewBag = {};
  try {
    const rows = await proc(DB, 'usp_member_rankreward', {
      regno: Plid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate, todate: toDate,
    });
    Obj = mapRows(rows, RANK_PROPS);
    const TotalRecord = need(outv(rows, 'totalcount'));
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'USP_PURCHASE_COIN_FOR_HOLD_NEW_LIST', 0, req.path); } catch (_) { /* ignore */ }
    return res.json({ redirect: '/page-not-found' });
  }
  res.json({ Model: Obj, ...ViewBag });
}));

module.exports = router;
