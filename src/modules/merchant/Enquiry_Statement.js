'use strict';
// Ported from Shoping Portal Merchant Panel\Controllers\CustomerPanel\Enquiry_Statement.cs (class Enquiry_statementController)  - DB: shopping (Db_Shopping)
// [SessionExpireCheck] -> auth ; ((Login)Session["Plid"]).Plid -> req.user.plid
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const P = '/merchant/Enquiry_statement';
const ENQUIRY_STATEMENT = ['ROWNUMBER', 'PIID', 'CCEMAILID', 'CCNAME', 'MAILDATE', 'MESSAGE', 'MOBILE'];
const col = (row, name) => { if (!row) return undefined; const k = Object.keys(row).find((x) => x.toLowerCase() === name); return k === undefined ? undefined : row[k]; };
// int? model binding: missing/invalid => null
const toNullableInt = (v) => (v === undefined || v === null || !/^\s*[+-]?\d+\s*$/.test(String(v)) ? null : parseInt(v, 10));

// Index(string fromDate, string toDate, int? page)
async function Index(req, res) {
  let { fromDate, toDate } = req.p;
  let page = toNullableInt(req.p.page);
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const BranchId = Number(req.user.plid);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const rows = await db.proc(DB, 'usp_customer_enquiry', {
    fromdate: fromDate, todate: toDate, startrowindex: page, maxrows: MaxRows, plid: Number(req.user.plid),
  });
  const objORDERTRANSACTIONS = mapRows(rows, ENQUIRY_STATEMENT);
  // @TOTALCOUNT OUT comes back as a column of the result rows.
  // PORT-NOTE: with an empty result set there is no row carrying TOTALCOUNT => 0 (legacy read the OUT param value).
  const tc = rows && rows.length ? col(rows[0], 'totalcount') : 0;
  const TotalRecord = parseInt(String(tc === undefined || tc === null ? 0 : tc), 10);
  const NoPerPage = await UtilityClass.GridNumbersPerPage();
  res.json({
    Model: objORDERTRANSACTIONS,
    BranchId,
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage,
    fromDate,
    toDate,
  });
}

// auth
router.all(`${P}/Index{/:id}`, auth, asyncHandler(Index));
// auth  route-config: merchant/enquiry-statement -> Enquiry_Statement/Index
router.all('/merchant/merchant/enquiry-statement', auth, asyncHandler(Index));

module.exports = router;
