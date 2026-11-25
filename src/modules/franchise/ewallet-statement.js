'use strict';
/** Ported from Franchise\Controllers\CustomerPanel\EWALLET_Statement.cs (EWALLET_StatementController) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const P = '/franchise/EWALLET_Statement';
const nz = (v, d) => (v === undefined || v === null ? d : v);

// auth // route-config: franchisee/EWALLET-Statement
router.all([`${P}/Index{/:id}`, '/franchise/franchisee/EWALLET-Statement'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const ResselerName = nz(p.ResselerName, '');
  const SearchField = nz(p.SearchField, '');
  const SearchValue = nz(p.SearchValue, '');
  const fromDate = nz(p.fromDate, '');
  const toDate = nz(p.toDate, '');
  const did1 = String(Number(req.user.did)); // Convert.ToString(double)
  const mode = 7;
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page === undefined || p.page === null || p.page === '' ? 1 : parseInt(p.page, 10);
  const rows = await proc('shopping', 'usp_Netbanking_Statement', {
    startrowindex: page, maxrows: 100, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate.trim(), todate: toDate.trim(),
    resselername: ResselerName, mode, resellerid: did1,
  });
  const AllEPinRequestsList = mapRows(rows, ['rownumber', 'NETAMOUNT', 'Remark', 'USERNAME', 'WALLET', 'ORDERDATE', 'AMOUNT', 'CustomerName', 'EMAILID',
    'PHONE', 'DistributorName', 'TYPE']);
  const n = parseInt(((rows && rows[0]) || {}).totalcount, 10);
  res.json({
    Model: AllEPinRequestsList,
    QUALIFICATIONlis: '',
    CurrentPage: page,
    ResselerName,
    GridPageSize: MaxRows,
    TotalRecord: Number.isNaN(n) ? 0 : n,
    NoPerPage: UtilityClass.GridNumbersPerPage(),
    SearchField,
    SearchValue,
    fromDate,
    toDate,
  });
}));

module.exports = router;
