'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Bonus_Reward_Income.cs (Bonus_Reward_IncomeController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';

const nn = (v) => (v === undefined || v === null ? '' : String(v));
const optInt = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const totalOf = (rows) => { const f = rows[0]; if (!f) return 0; const k = Object.keys(f).find((x) => x.toLowerCase() === 'totalcount'); const n = k === undefined ? NaN : parseInt(f[k], 10); return Number.isNaN(n) ? 0 : n; };

const BONUS_PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'REGNO', 'MTCHBV', 'PER', 'TOTALBV', 'DISTRIBUTEBV', 'TOTALMEMBER', 'TOTALINCOME', 'ADMICHARGE', 'TDS', 'NETINCOME', 'DATE', 'ACTIVE', 'STATUS'];

// auth
// route-config: "referral/bbkQAaAq4MK8zyWzbIAVNLxYTWq0xQ0Vasx" -> Bonus_Reward_Income/Index (id optional)
router.all(['/member/Bonus_Reward_Income/Index{/:id}', '/member/referral/bbkQAaAq4MK8zyWzbIAVNLxYTWq0xQ0Vasx{/:id}'], auth, asyncHandler(async (req, res) => {
  let ddlcustpage = optInt(req.p.ddlcustpage);
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  const fromdate = nn(req.p.fromdate);
  const todate = nn(req.p.todate);
  let page = optInt(req.p.page);
  if (ddlcustpage === null) ddlcustpage = 100;

  const Plid = Number(req.user.plid);
  // legacy looked up Member_Master.LOGINID into an unused local; not needed
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;

  // PORT-NOTE: @TotalCount OUT param is returned as a column ("totalcount") of the result row.
  const rows = await db.proc(DB, 'usp_memberbonusrewardreport', {
    plid: Math.trunc(Plid), startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
    fromdate: fromdate.trim(), todate: todate.trim(),
  });
  const ViewBag = {
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord: totalOf(rows),
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField,
    SearchValue,
    fromDate: fromdate,
    toDate: todate,
    ddlcustpage,
  };
  res.json({ view: '~/Views/CustomerPanel/Bonus_Reward_Income/Index.cshtml', Model: mapRows(rows, BONUS_PROPS), ViewBag });
}));

module.exports = router;
