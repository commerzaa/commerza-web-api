'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Bank_Withdrawal_History.cs (Bank_Withdrawal_HistoryController)
 * Prefix: /member   DB: affiliate (DataBaseContext => Db_Affiliate)
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';

const PROPS = ['ROWNUMBER', 'AMOUNT', 'DATE', 'USERNAME', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'IFSC', 'BANKNAME', 'STATUS', 'BRANCHNAME', 'WITHDRWALAMOUNT',
  'ADMINCHARGE', 'TDS', 'NETPAYABLE', 'Processing_Fee', 'INCOMETYPENAME', 'Repurchase'];
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
// route-config: referral/bank-withdrawal-history  (Bank_Withdrawal_History / Index)
// auth
router.all(['/member/Bank_Withdrawal_History/Index{/:id}', '/member/referral/bank-withdrawal-history'], auth, asyncHandler(async (req, res) => {
  const fromdate = nn(req.p.fromdate);
  const ddlstatus = nn(req.p.ddlstatus);
  const todate = nn(req.p.todate);
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  const Plid = Number(req.user.plid);
  const MaxRows = await UtilityClass.GridPageSize();
  const page = toInt(req.p.page, 1);
  // PORT-NOTE: @TOTALCOUNT OUT is read from the first result row (column totalcount); 0 when no rows.
  const rows = await proc(DB, 'usp_bankwithdrawal_history', {
    plid: Plid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue,
    fromdate: fromdate.trim(), todate: todate.trim(), status: ddlstatus,
  });
  const WithDrawalHisrory = mapRows(rows, PROPS);
  const TotalRecord = totalOf(rows, 'totalcount');
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    fromDate: fromdate, toDate: todate, ddlstatus, SearchField, SearchValue,
  };
  return res.json({ view: '~/Views/CustomerPanel/Bank_Withdrawal_History/Index.cshtml', Model: WithDrawalHisrory, ViewBag });
}));

module.exports = router;
