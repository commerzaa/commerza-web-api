'use strict';
/**
 * Port of Franchise\Controllers\CustomerPanel\Order_BV.cs (Order_BVController)
 * Actions: Index (1)
 */
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const DB = 'shopping'; // Franchise DataBaseContext => Db_Shopping (Web.config)
const PROPS = ['ROWNUMBER', 'ORDERID', 'TOTAL_PURCHASE_COST', 'ORDERDATE', 'TOTAL_BV', 'RELASED', 'ISDISTRIBUTED', 'MEMEBERID'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));

// route-config: franchisee/Orders-Bv
// auth
router.all(['/franchise/Order_BV/Index{/:id}', '/franchise/franchisee/Orders-Bv'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let page = p.page === undefined || p.page === null || p.page === '' ? null : parseInt(p.page, 10);
  const fromDate = nn(p.fromDate);
  const toDate = nn(p.toDate);
  const SearchField = nn(p.SearchField);
  const SearchValue = nn(p.SearchValue);
  const Status = nn(p.Status);
  const DID = Number(req.user.did);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const mode = 0;
  // PORT-NOTE: @TotalCount OUT is read from the first result row (column "totalcount"); 0 when no rows.
  const rows = await db.proc(DB, 'USP_RESELLER_GET_BVDETAILS', {
    Mode: mode, STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromDate, TODATE: toDate, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue.trim(), STATUS: Status, DID,
  });
  const f = rows && rows[0];
  const TotalRecord = parseInt(f ? f.totalcount : 0, 10) || 0;
  const ViewBag = { CurrentPage: page, GridPageSize: MaxRows, fromDate, toDate, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage() };
  res.json({ Model: mapRows(rows, PROPS), ViewBag });
}));

module.exports = router;
