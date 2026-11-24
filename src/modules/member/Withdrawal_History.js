'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Withdrawal_History.cs (Withdrawal_HistoryController) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Withdrawal_History';
const PROPS = ['ROWNUMBER', 'WDID', 'WITHDRAWAMOUNT', 'DATE', 'PAID_STATUS', 'REMARKS', 'Wallet_Address', 'Withdrawal_BTC', 'TXID'];
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };

// auth (null session => RedirectToAction("Index","Home"))
// route-config: "referral/quRzNsiCTpKk_slash_l1KaFEkbXmvgKKKEr0L" -> Withdrawal_History/Index
router.all([`${P}/Index{/:id}`, P, '/member/referral/quRzNsiCTpKk_slash_l1KaFEkbXmvgKKKEr0L'], auth, asyncHandler(async (req, res) => {
  let { fromdate, todate, SearchField, SearchValue } = req.p;
  let page = toInt(req.p.page);
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  const Plid = Number(req.user.plid);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_wallet_history', {
    plid: String(Plid), startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue,
    fromdate: fromdate.trim(), todate: todate.trim(),
  });
  // PORT-NOTE: @TOTALCOUNT OUT read from the "totalcount" column of the first row (0 when there are no rows)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  res.json({
    Model: mapRows(rows, PROPS),
    ViewBag: {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      fromDate: fromdate, toDate: todate, SearchField, SearchValue,
    },
  });
}));

module.exports = router;
