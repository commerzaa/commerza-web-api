'use strict';
/** Ported from Franchise\Controllers\CustomerPanel\Products_Commission.cs (Products_CommissionController) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const P = '/franchise/Products_Commission';
const nz = (v, d) => (v === undefined || v === null ? d : v);

// auth // route-config: franchisee/Product-Commission
router.all([`${P}/Index{/:id}`, '/franchise/franchisee/Product-Commission'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const Type = nz(p.Type, '');
  const TransID = nz(p.TransID, '');
  const fromDate = nz(p.fromDate, '');
  const toDate = nz(p.toDate, '');
  const Searchfield = nz(p.Searchfield, '');
  const Serachvalue = nz(p.Serachvalue, '');
  const did = Math.round(Number(req.user.did));
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page === undefined || p.page === null || p.page === '' ? 1 : parseInt(p.page, 10);
  const spName = Type === 'flat' ? 'USP_GET_ALLProductCOMMISSION_RESELLERWISE_REPORTS' : 'USP_GET_ALLONBOARDINGCOMMISSION_RESELLERWISE_REPORTS';
  const rows = await proc('shopping', spName, {
    mode: 1, startrowindex: page, maxrows: MaxRows, fromdate: fromDate, todate: toDate, searchfield: Searchfield, searchvalue: Serachvalue, did,
  });
  const _Product_Commission = mapRows(rows, ['ROWNUMBER', 'FROMDATE', 'TODATE', 'CommissionInvoice', 'TotalSalesAmount', 'FlatFeeCollected', 'ReleaseDate',
    'FranchiseeCommissionPer', 'FranchiseeCommissionEur', 'FranchiseeCommissionINVEurWorth', 'Status']);
  const n = parseInt(((rows && rows[0]) || {}).totalcount, 10);
  const TotalRecord = Number.isNaN(n) ? 0 : n;
  res.json({
    Model: _Product_Commission,
    QUALIFICATIONlis: '',
    CurrentPage: page,
    MOBILE: '',
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage: UtilityClass.GridNumbersPerPage(),
    SearchField: '',
    SearchValue: '',
    fromDate,
    toDate,
    QUALIFICATION: '',
    userid: '',
    ORDERBY: '',
    Isdownload: '',
    Type,
  });
}));

module.exports = router;
