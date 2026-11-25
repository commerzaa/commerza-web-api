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

// Port of Franchise\Controllers\CustomerPanel\Merchant_Leads_Active.cs (1 action)
// route-config: franchisee/Merchant-Leads-Active -> Index
// PORT-NOTE: C# mapped rows to class Customer_Wallet (defined elsewhere, not in this file); the Merchant_Leads_Active property list is used.
const PROPS = ['rownumber', 'CLID', 'UPDATEDDATE', 'ADDMONEY', 'TRANSFERTOBANK', 'TOTALBALANCE', 'AVAILABLEBALANCE', 'DID', 'NAME', 'EMAILID', 'PHONE', 'LOGINID'];
// auth
router.all(['/franchise/Merchant_Leads_Active/Index{/:id}', '/franchise/franchisee/Merchant-Leads-Active'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const MOBILE = s(p.MOBILE);
  const SearchField = s(p.SearchField);
  const SearchValue = s(p.SearchValue);
  const fromDate = s(p.fromDate);
  const toDate = s(p.toDate);
  const Availbalance = s(p.Availbalance);
  const SearchKyc = p.SearchKyc === undefined || p.SearchKyc === null ? '-1' : String(p.SearchKyc);
  const SearchBusinessInfo = s(p.SearchBusinessInfo);
  const SearchBusinessType = p.SearchBusinessType === undefined || p.SearchBusinessType === null ? '0' : String(p.SearchBusinessType);
  const DID = req.user.did;
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page ? pg(p.page) : 1;
  const rows = await db.proc('shopping', 'usp_merchantdetails_active', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: fromDate, TODATE: toDate, DID,
    BALANCE: Availbalance, ORDERBYCRDEIT: '0', MINAMOUNT: '0', MAXAMOUNT: '0', SearchKyc, SearchBusinessInfo, SearchBusinessType,
  });
  const TotalRecord = parseInt(outv(rows, 'TotalCount'), 10) || 0;
  const g = (v) => (v === undefined ? null : v);
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
    QUALIFICATION: g(p.QUALIFICATION),
    userid: g(p.userid),
    ORDERBY: g(p.ORDERBY),
    Isdownload: g(p.Isdownload),
  });
}));

module.exports = router;
