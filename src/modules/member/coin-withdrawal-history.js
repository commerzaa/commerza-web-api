'use strict';
// Ported from Member/Controllers/CustomerPanel/CoinWithdrawal_History.cs  (DB: affiliate)
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const DB = 'affiliate';
const CoinWithdrawal_History = ['ROWNUMBER', 'WDID', 'PLID', 'WITHDRAWAMOUNT', 'DATE', 'STATUS', 'Wallet_Address', 'Remarks'];

// auth (legacy: Session["Plid"] == null -> redirect Home/Index). route-config: url "referral/quRzNsiCTpI0X_plus_kAhbmx9WImitjHyXW6"
router.all(['/member/CoinWithdrawal_History/Index{/:id}', '/member/CoinWithdrawal_History', '/member/referral/quRzNsiCTpI0X_plus_kAhbmx9WImitjHyXW6'], auth, asyncHandler(async (req, res) => {
  let { fromdate, todate, SearchField, SearchValue, page } = req.p;
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  const Plid = Number(req.user.plid);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1; else page = Number(page);
  const rows = await proc(DB, 'usp_walletcoin_history', {
    plid: Plid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue,
    fromdate: String(fromdate).trim(), todate: String(todate).trim(),
  });
  // PORT-NOTE: @TOTALCOUNT OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  res.json({
    View: '~/Views/CustomerPanel/CoinWithdrawal_History/Index.cshtml',
    Model: mapRows(rows, CoinWithdrawal_History),
    ViewBag: {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      fromDate: fromdate, toDate: todate, SearchField, SearchValue,
    },
  });
}));

module.exports = router;
