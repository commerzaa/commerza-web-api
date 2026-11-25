'use strict';
/** Port of Shoping Portal Merchant Panel/Controllers/CustomerPanel/Statement_Summary.cs (Statement_SummaryController). DB: 'shopping' (Db_Shopping) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const P = '/merchant/Statement_Summary';
const guard = [auth, requireType('merchant')];
const PROPS = ['ROWNUMBER', 'SALEAMOUNT', 'REFUNDS', 'ADMINCOMSSION', 'FIXEDFEE', 'SHIPINGFEE', 'HANDLING', 'SGST', 'CGST', 'IGST', 'PLID'];

// ---- Index ---------------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
const indexHandler = asyncHandler(async (req, res) => {
  let { page, Invoiceno, Orderid, fromDate, toDate } = req.p;
  page = page === undefined || page === null || page === '' ? 1 : parseInt(page, 10);
  if (Invoiceno == null) Invoiceno = '';
  if (Orderid == null) Orderid = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const PLID = Math.trunc(Number(req.user.plid));
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await proc(DB, 'usp_merchant_statement_summary', { plid: PLID, date: fromDate });
  const TotalRecord = 0;
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, Invoiceno, Orderid, fromDate, toDate, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
  };
  res.json({ Model: mapRows(rows, PROPS), ViewBag });
});
router.all([`${P}/Index{/:id}`, P], ...guard, indexHandler);
// route-config: merchant/eXHfArQbbgPOMseGCTvwBXmvgKKKEr0L
router.all('/merchant/merchant/eXHfArQbbgPOMseGCTvwBXmvgKKKEr0L', ...guard, indexHandler);

module.exports = router;
