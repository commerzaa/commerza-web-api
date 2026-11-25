'use strict';
// Ported from Member\Controllers\CustomerPanel\Royalty_Reward.cs (Royalty_RewardController) - database: affiliate (Db_Affiliate)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/Royalty_Reward';
const DB = 'affiliate';
const pick = (r, name) => { const k = Object.keys(r || {}).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const outv = (rows, name) => (rows && rows.length ? pick(rows[0], name) : undefined);
// PORT-NOTE: OUT parameters are read from columns of the first result row (0 when absent / NULL)
const numOut = (rows, name) => { const v = outv(rows, name); return v === undefined || v === null || v === '' ? 0 : Number(v); };
const PROPS = ['ROWNUMBER', 'USERNAME', 'MOBILENO', 'DATE', 'TOTALBV', 'DISTRIBUTEBV', 'TOTALMEMBER', 'TOTALINCOME', 'TDS', 'NETINCOME'];

// route-config: referral/Royalty-Reward-income-report
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/Royalty-Reward-income-report'], ...guard, asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, fromDate, toDate } = req.p;
  let page = req.p.page === undefined || req.p.page === null || req.p.page === '' ? null : parseInt(req.p.page, 10);
  let ddlcustpage = req.p.ddlcustpage === undefined || req.p.ddlcustpage === null || req.p.ddlcustpage === '' ? null : parseInt(req.p.ddlcustpage, 10);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === undefined || SearchField === null) SearchField = '';
  if (SearchValue === undefined || SearchValue === null) SearchValue = '';
  if (fromDate === undefined || fromDate === null) fromDate = '';
  if (toDate === undefined || toDate === null) toDate = '';
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  let listRoyalty_Reward = [];
  const ViewBag = {};
  try {
    const Plid = Number(req.user.plid);
    const rows = await db.proc(DB, 'usp_royaltyreward_report', {
      REGNO: Plid, STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue.trim(), FROMDATE: fromDate, TODATE: toDate,
    });
    listRoyalty_Reward = mapRows(rows, PROPS);
    const TotalRecord = numOut(rows, 'totalcount');
    const TotalAllIncome = numOut(rows, 'totalincome');
    const TotalNetAllIncome = numOut(rows, 'netincome');
    const TotalSumTds = numOut(rows, 'totaltds');
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TotalAllIncome = TotalAllIncome;
    ViewBag.TotalSumTds = TotalSumTds;
    ViewBag.TotalNetAllIncome = TotalNetAllIncome;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'insert_email_newsletter', 0, req.path); } catch (_) { /* ignore */ }
  }
  res.json({ Model: listRoyalty_Reward, ViewBag });
}));

module.exports = router;
