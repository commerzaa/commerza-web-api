'use strict';
// Ported from Member/Controllers/CustomerPanel/INR_Wallet_Statement.cs  (DB: affiliate)
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const ATCAPI = require('../../lib/member/ATCAPI');

const DB = 'affiliate';
const INR_Wallet_Statement = ['RowNumber', 'type', 'DrAmount', 'Amount', 'Date', 'Remark', 'Plid', 'Currentbalance', 'TRANSFERDATE'];

// auth ([SessionExpireCheck]). route-config: url "referral/e-waalet-statement"
router.all(['/member/INR_Wallet_Statement/Index{/:id}', '/member/INR_Wallet_Statement', '/member/referral/e-waalet-statement'], auth, asyncHandler(async (req, res) => {
  let { page, fromDate, toDate, CrDrType, TrType, ddlcustpage } = req.p;
  if (ddlcustpage == null || ddlcustpage === '') ddlcustpage = 100; else ddlcustpage = Number(ddlcustpage);
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (CrDrType == null) CrDrType = '';
  if (TrType == null) TrType = '0';
  if (TrType === '') TrType = '0';

  // For Auto Approval Of BTC For E-Wallet Topup (legacy: background Thread, result ignored)
  const RegNo = Math.trunc(Number(req.user.plid));
  Promise.resolve().then(() => ATCAPI.BTCPaymentClearification(RegNo)).catch((e) => console.error('BTCPaymentClearification', e.message));

  const MaxRows = Number(ddlcustpage);
  if (page == null || page === '') page = 1; else page = Number(page);
  const Plid = Number(req.user.plid);
  const rows = await proc(DB, 'usp_fund_history', {
    tfhid: Plid, fromdate: fromDate, todate: toDate, startrowindex: page, maxrows: MaxRows,
    crdrtype: CrDrType, trtype: parseInt(TrType, 10), mode: 0,
  });
  const o = rows[0] || {};
  const num = (v) => Number(v == null ? 0 : String(v));
  // PORT-NOTE: OUT parameters (@TOTALCOUNT,@CRAMOUNT,@DRAMOUNT,@AVALIBALEFUND) are read from the first result row (0 if none)
  const TotalRecord = Math.trunc(num(o.totalcount));
  res.json({
    View: '~/Views/CustomerPanel/INR_Wallet_Statement/Index.cshtml',
    Model: mapRows(rows, INR_Wallet_Statement),
    ViewBag: {
      PLID: Plid, fromDate, toDate, CrDrType, TrType,
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord,
      cramount: num(o.cramount), dramount: num(o.dramount), avalibalefund: num(o.avalibalefund),
      NoPerPage: await UtilityClass.GridNumbersPerPage(), ddlcustpage,
    },
  });
}));

module.exports = router;
