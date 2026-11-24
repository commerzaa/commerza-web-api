'use strict';
/**
 * Port of Merchant Panel Controllers/CustomerPanel/Pervious_Payments.cs (Pervious_PaymentsController) - 3 actions
 * Actions: Index, GETORDERWISEDATA, GETORDERWISEDATALIST     DB: Db_Shopping => 'shopping'
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const C = 'Pervious_Payments';
const PAYOUT = ['Rownumber', 'Payid', 'USERNAME', 'LOGINID', 'PAYFROM', 'PAYTO', 'PAYDATE', 'Plid', 'ACCOUNTNO', 'PAYAMOUNT', 'ADMINCHARGE', 'HANDLINGFEE', 'FIXEDFEE', 'SHIPPINGCHARGE'];
const PAYORDER = ['Rownumber', 'Payid', 'ORDERID', 'ORDERNO', 'ProductActualAmount', 'ADMINCHARGE', 'TOTALAMOUNT', 'Status', 'Completeddate'];
const PAYSINGLE = ['ROWNUMBER', 'ORDERID', 'ORDERDATE', 'ORDER_QTY', 'ORDER_DAP', 'ORDER_NETAMT', 'PAYMODE', 'TOTAL_VAT', 'INTSTATUS', 'POID', 'PRODUCT_QTY', 'SINGLE_DAP', 'TOTAL_DAP', 'TOTAL_SHIP_CH', 'TOTAL_COST', 'PRODUCTTOTALVAT', 'TOTAL_PURCHASE_COST', 'PRODUCT_NAME', 'PRODQTY', 'PROUNIT', 'PROD_IMAGES', 'JP', 'BV', 'Orderno', 'couriername', 'DocketNO', 'Approved', 'dispatchdate', 'CreatedDate', 'Packed', 'Handover', 'Intransit', 'Picked']; // Payordersinglelist

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: merchant/yk_slash_p_plus_o_slash_M2zTNDa2QYasEKQ==
// auth ([SessionExpireCheck]; legacy null-session => RedirectToAction("Index","Home"))
router.all([`/merchant/${C}/Index{/:id}`, `/merchant/${C}`, '/merchant/yk_slash_p_plus_o_slash_M2zTNDa2QYasEKQ==', '/merchant/merchant/yk_slash_p_plus_o_slash_M2zTNDa2QYasEKQ=='], auth, asyncHandler(async (req, res) => {
  let { fromDate, toDate, page } = req.p;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const PLid = Number(req.user.plid);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  const rows = await proc(DB, 'usp_payoutreport', {
    mode: 1, startrowindex: page, maxrows: MaxRows, fromdate: fromDate.trim(), todate: toDate.trim(), plid: PLid,
  });
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  res.json({
    view: '~/Views/Pervious_Payments/Index.cshtml',
    Model: mapRows(rows, PAYOUT),
    ViewBag: {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), fromDate, toDate, SearchField: '', SearchValue: '',
    },
  });
}));

// ---- GETORDERWISEDATA ----------------------------------------------------------------------------------
// auth
router.all(`/merchant/${C}/GETORDERWISEDATA{/:id}`, auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const rows = await proc(DB, 'usp_getorderwisepayoutdata', { plid: Plid, payid: parseInt(req.p.Payid, 10) });
  res.json(mapRows(rows, PAYORDER));
}));

// ---- GETORDERWISEDATALIST ------------------------------------------------------------------------------
// auth
router.all(`/merchant/${C}/GETORDERWISEDATALIST{/:id}`, auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const rows = await proc(DB, 'usp_orderhistory', { plid: Plid, orderno: req.p.Orderno });
  res.json(mapRows(rows, PAYSINGLE));
}));

module.exports = router;
