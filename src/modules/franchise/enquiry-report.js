'use strict';
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row (0 when absent).
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : 0);
const s = (v) => (v === undefined || v === null ? '' : String(v));
const pg = (v) => { const n = parseInt(v, 10); return Number.isNaN(n) ? 1 : n; };

// Port of Franchise\Controllers\CustomerPanel\EnquiryReport.cs (1 action)
// route-config: franchisee/Enquiry-Report -> Index
const PROPS = ['rownumber', 'CLID', 'UPDATEDDATE', 'ADDMONEY', 'TRANSFERTOBANK', 'TOTALBALANCE', 'AVAILABLEBALANCE', 'DID', 'NAME', 'EMAILID', 'PHONE', 'LOGINID'];
// auth
router.all(['/franchise/EnquiryReport/Index{/:id}', '/franchise/franchisee/Enquiry-Report'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const MOBILE = s(p.MOBILE);
  const SearchField = s(p.SearchField);
  const SearchValue = s(p.SearchValue);
  const fromDate = s(p.fromDate);
  const toDate = s(p.toDate);
  const DID = req.user.did;
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page ? pg(p.page) : 1;
  const rows = await db.proc('shopping', 'usp_customerwallet', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: fromDate, TODATE: toDate, DID,
  });
  const TotalRecord = parseInt(outv(rows, 'TotalCount'), 10) || 0;
  res.json({
    Model: mapRows(rows, PROPS),
    QUALIFICATIONlis: '',
    CurrentPage: page,
    MOBILE,
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField,
    SearchValue,
    fromDate,
    toDate,
    QUALIFICATION: p.QUALIFICATION === undefined ? null : p.QUALIFICATION,
    userid: p.userid === undefined ? null : p.userid,
    ORDERBY: p.ORDERBY === undefined ? null : p.ORDERBY,
    Isdownload: p.Isdownload === undefined ? null : p.Isdownload,
  });
}));

module.exports = router;
