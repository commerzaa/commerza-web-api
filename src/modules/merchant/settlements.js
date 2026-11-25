'use strict';
// Ported from Franchise\Controllers\CustomerPanel\Settlements.cs  (database: shopping)
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const router = express.Router();
const DB = 'shopping';
const str = (v) => (v === undefined || v === null ? '' : String(v));
const outv = (rows, name) => (rows && rows.length && rows[0][name.toLowerCase()] !== undefined ? rows[0][name.toLowerCase()] : null);
const toPage = (v) => (v === undefined || v === null || v === '' ? 1 : parseInt(v, 10));

const P = '/merchant/Settlements';
const SETTLEMENTSLIST = ['ROWNUMBER', 'ORDERID', 'ORDERNO', 'ProductActualAmount', 'OrderDate', 'INVOICENO', 'Marketplacefee', 'Totalgst', 'INTSTATUS', 'DISPATCHDATE'];
const PAYORDER = ['ROWNUMBER', 'ORDERID', 'ORDERDATE', 'ORDER_QTY', 'ORDER_DAP', 'ORDER_NETAMT', 'PAYMODE', 'TOTAL_VAT', 'INTSTATUS', 'POID', 'PRODUCT_QTY', 'SINGLE_DAP', 'TOTAL_DAP', 'TOTAL_SHIP_CH', 'TOTAL_COST', 'PRODUCTTOTALVAT', 'TOTAL_PURCHASE_COST', 'PRODUCT_NAME', 'PRODQTY', 'PROUNIT', 'PROD_IMAGES', 'JP', 'BV', 'Orderno', 'couriername', 'DocketNO', 'Approved', 'dispatchdate', 'CreatedDate', 'Packed', 'Handover', 'Intransit', 'Picked', 'Delivered', 'Settalmentdate', 'AdminCharge', 'Totalgst', 'Marketplacefee', 'ADMINCHARGE', 'DelieveryCharge', 'HandlingCharge', 'FixedFee', 'admingst', 'DeleveryGSt', 'HandlingGSt', 'FixedFeeGSt', 'AdminChargepercentage', 'ADMINCHARGE1', 'DUEDATE'];

// [SessionExpireCheck] -> auth
async function Index(req, res) {
  let { fromDate, toDate, orderid, invoiceno } = req.p;
  let page = req.p.page;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (orderid == null) orderid = '';
  else if (orderid !== '') orderid = await UtilityClass.Decryptword(orderid);
  if (invoiceno == null) invoiceno = '';
  else if (invoiceno !== '') invoiceno = await UtilityClass.Decryptword(invoiceno);
  const Plid = Math.trunc(Number(req.user.plid));
  const MaxRows = await UtilityClass.GridPageSize();
  page = toPage(page);
  const rows = await db.proc(DB, 'usp_getsettmelntreport', {
    mode: 1, startrowindex: page, maxrows: MaxRows, plid: Plid, fromdate: String(fromDate).trim(), todate: String(toDate).trim(),
    orderid: String(orderid).trim(), invoiceno: String(invoiceno).trim(),
  });
  const objAllOrderList = mapRows(rows, SETTLEMENTSLIST);
  const TotalRecord = parseInt(outv(rows, 'totalcount') === null ? 0 : outv(rows, 'totalcount'), 10);
  res.json({
    Model: objAllOrderList, CurrentPage: page, GridPageSize: MaxRows, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(), fromDate, toDate, SearchField: '', SearchValue: '',
  });
}
// auth
router.all(P + '/Index{/:id}', auth, asyncHandler(Index));
// route-config: merchant/XTESlv_plus_Xvk39TV9lhO_plus_CLw== -> Index
router.all('/merchant/XTESlv_plus_Xvk39TV9lhO_plus_CLw=={/:id}', auth, asyncHandler(Index));

// auth
router.all(P + '/GETORDERWISEDATALIST{/:id}', auth, asyncHandler(async (req, res) => {
  const Orderno = req.p.Orderno;
  const Plid = Math.trunc(Number(req.user.plid));
  const rows = await db.proc(DB, 'usp_settlementorderhistory', { plid: Plid, orderno: Orderno });
  res.json(mapRows(rows, PAYORDER));
}));

module.exports = router;
