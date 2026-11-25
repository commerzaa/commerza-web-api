'use strict';
// Ported from Franchise\Controllers\CustomerPanel\Delivery_Report.cs (database: shopping - Franchise DataBaseContext points at Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const guard = [auth, requireType('franchise')];
const COLS = ['ROWNUMBER', 'DID', 'DATE', 'ORDERAMOUNT', 'ORDERNO', 'DELIVERYCHARGE', 'RECEIVEDAMOUNT', 'PAYMENTTYPE', 'DELIVERYDATE', 'PAIDAMOUNTMARCHENT', 'PAIDMARCHENTTYPE', 'MARCHENTDATE'];

const handler = asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, fromDate, toDate, page } = req.p;
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const BranchId = 0;
  const DID = parseInt(req.user.did, 10);
  const MaxRows = await UtilityClass.GridPageSize();
  page = (page === undefined || page === null || page === '') ? 1 : parseInt(page, 10);
  const rows = await db.proc('shopping', 'usp_delivery_report', {
    DID, STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: fromDate, TODATE: toDate,
  });
  // PORT-NOTE: @TOTALCOUNT OUT read from the 'totalcount' column of the first row (0 when empty)
  const TotalRecord = rows.length && rows[0].totalcount != null && rows[0].totalcount !== '' ? parseInt(rows[0].totalcount, 10) : 0;
  res.json({
    Model: mapRows(rows, COLS), BranchId, CurrentPage: page, GridPageSize: MaxRows, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate, toDate,
  });
});

// auth
router.all('/franchise/Delivery_Report/Index{/:id}', ...guard, handler);
// route-config
router.all('/franchise/franchisee/deliveryhKVljVjI8d8CVPhknYX_plus_CQ==', ...guard, handler);

module.exports = router;
