'use strict';
/**
 * Port of Franchise\Controllers\CustomerPanel\Customer_Reject_payout.cs (Customer_Reject_payoutController)
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
const PROPS = ['ROWNUMBER', 'USERNAME', 'AMOUNT', 'ACCOUNTNO', 'ACCOUNTHOLDERNAME', 'BANKNAME', 'BRACNHNAME', 'IFSCCODE', 'GROUPNAME', 'STATUS', 'Date', 'RESELLERNAME'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));

// route-config: franchisee/Customer-Rejected-Payout
// auth
router.all(['/franchise/Customer_Reject_payout/Index{/:id}', '/franchise/franchisee/Customer-Rejected-Payout'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let page = p.page === undefined || p.page === null || p.page === '' ? null : parseInt(p.page, 10);
  const SearchField = nn(p.SearchField);
  const Requestid = nn(p.Requestid);
  const SearchValue = nn(p.SearchValue);
  const fromDate = nn(p.fromDate);
  const toDate = nn(p.toDate);
  void Requestid;
  const DID = parseInt(req.user.did, 10);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const mode = 0;
  // PORT-NOTE: @TotalCount OUT is read from the first result row (column "totalcount"); 0 when no rows.
  const rows = await db.proc(DB, 'USP_ALLREJECTLIST_CUSTOMER_RESELLERWISE', {
    Mode: mode, STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FROMDATE: fromDate, TODATE: toDate, Requestid: '', DID,
  });
  const f = rows && rows[0];
  const TotalRecord = parseInt(f ? f.totalcount : 0, 10) || 0;
  const ViewBag = { CurrentPage: page, GridPageSize: MaxRows, SearchField, SearchValue, fromDate, toDate, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage() };
  res.json({ Model: mapRows(rows, PROPS), ViewBag });
}));

module.exports = router;
