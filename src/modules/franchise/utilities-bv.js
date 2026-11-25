'use strict';
// Ported from Franchise\Controllers\CustomerPanel\Utilities_BV.cs  (database: shopping — Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const router = express.Router();
const str = (v) => (v === undefined || v === null ? '' : String(v));
// OUT parameter / total value read from the (first) result row (db.proc convention)
const outv = (rows, name) => (rows && rows.length && rows[0][name.toLowerCase()] !== undefined ? rows[0][name.toLowerCase()] : null);
const toPage = (v) => (v === undefined || v === null || v === '' ? 1 : parseInt(v, 10));

const P = '/franchise/Utilities_BV';
const PROPS = ['ROWNUMBER', 'CUSTOMERNAME', 'MOBILENO', 'DATE', 'TOTAL_BV', 'MEMBERID', 'RELASED', 'ISDISTRIBUTED', 'TRANSACTIONID'];

async function Index(req, res) {
  let { fromDate, toDate, SearchField, SearchValue, Status } = req.p;
  let page = req.p.page;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (Status == null) Status = '';
  const DID = Number(req.user.did);
  const MaxRows = await UtilityClass.GridPageSize();
  page = toPage(page);
  const mode = 0;
  const rows = await db.proc('shopping', 'usp_reseller_get_utilities_bvdetails', {
    mode, startrowindex: page, maxrows: MaxRows, fromdate: fromDate, todate: toDate,
    searchfield: SearchField, searchvalue: String(SearchValue).trim(), status: Status, did: DID,
  });
  const _BV_REPORT = mapRows(rows, PROPS);
  const TotalRecord = Number(outv(rows, 'totalcount') || 0);
  res.json({
    Model: _BV_REPORT, CurrentPage: page, GridPageSize: MaxRows, fromDate, toDate, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
  });
}

// auth
router.all(P + '/Index{/:id}', auth, asyncHandler(Index));
// route-config: franchisee/Utilities-BV
router.all('/franchise/franchisee/Utilities-BV{/:id}', auth, asyncHandler(Index));

module.exports = router;
