'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/GrowthReferralBonus.cs (GrowthReferralBonusController)
 * Prefix: /member   DB: affiliate (DataBaseContext => Db_Affiliate)
 */
const express = require('express');
const { proc, queryOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';

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
// route-config: referral/yZ8wXg_plus_rQKbSq5ctZty_plus_aD_plus_469DQWVTx  (GrowthReferralBonus / Index)
// auth
router.all(['/member/GrowthReferralBonus/Index{/:id}', '/member/referral/yZ8wXg_plus_rQKbSq5ctZty_plus_aD_plus_469DQWVTx'], auth, asyncHandler(async (req, res) => {
  const ddlcustpage = toInt(req.p.ddlcustpage, 100);
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  const fromdate = nn(req.p.fromdate);
  const todate = nn(req.p.todate);
  const Plid = Number(req.user.plid);
  // db._Member_Master.Where(a => a.REGNO == Plid).FirstOrDefault() -> LOGINID (value is never used afterwards)
  const row = await queryOne(DB, 'SELECT LOGINID FROM member_master WHERE REGNO = @Plid LIMIT 1', { Plid });
  let loginid = '';
  if (row) loginid = row.loginid;
  const MaxRows = await UtilityClass.GridPageSize();
  const page = toInt(req.p.page, 1);
  // PORT-NOTE: @TotalCount OUT is read from the first result row (column totalcount); 0 when no rows.
  const rows = await proc(DB, 'usp_member_earning_history', {
    plid: Math.trunc(Plid), startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
    fromdate: fromdate.trim(), todate: todate.trim(), mode: '1', incometype: '2',
  });
  const TotalRecord = totalOf(rows, 'totalcount');
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField, SearchValue, fromDate: fromdate, toDate: todate, ddlcustpage,
  };
  // GetEarningWalletHistory columns are returned as the stored procedure produces them (class not declared in this file).
  return res.json({ view: '~/Views/CustomerPanel/GrowthReferralBonus/Index.cshtml', Model: mapRows(rows), ViewBag, loginid });
}));

module.exports = router;
