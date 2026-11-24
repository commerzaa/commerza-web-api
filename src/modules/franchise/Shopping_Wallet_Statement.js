'use strict';
/** Port of Franchise/Controllers/CustomerPanel/Shopping_Wallet_Statement.cs. DB: 'shopping' */
const express = require('express');
const { query, scalar, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const router = express.Router();
const DB = 'shopping';
const s = (v) => (v === null || v === undefined ? '' : String(v));
const pint = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const totalOf = (rows, name = 'totalcount') => { const f = rows && rows[0]; if (!f) return 0; const k = Object.keys(f).find((x) => x.toLowerCase() === name); return k === undefined ? 0 : (parseInt(f[k], 10) || 0); };
const PROPS = ['rownumber', 'NETAMOUNT', 'Remark', 'USERNAME', 'WALLET', 'ORDERDATE', 'AMOUNT', 'CustomerName', 'EMAILID', 'PHONE', 'DistributorName', 'TYPE'];

// route-config: franchisee/Shopping-Wallet-Statement
// auth
router.all(['/franchise/Shopping_Wallet_Statement/Index{/:id}', '/franchise/franchisee/Shopping-Wallet-Statement'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const DID = Number(req.user.did);
  const ResselerName = p.ResselerName == null ? '' : s(p.ResselerName);
  const SearchField = p.SearchField == null ? '' : s(p.SearchField);
  const SearchValue = p.SearchValue == null ? '' : s(p.SearchValue);
  const fromDate = p.fromDate == null ? '' : s(p.fromDate);
  const toDate = p.toDate == null ? '' : s(p.toDate);
  let page = pint(p.page);
  const mode = 4;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_netbanking_statement', {
    startrowindex: page, maxrows: 100, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate.trim(), todate: toDate.trim(),
    resselername: ResselerName, mode, resellerid: DID,
  });
  const AllEPinRequestsList = mapRows(rows, PROPS);
  const ViewBag = {
    QUALIFICATIONlis: '', CurrentPage: page, ResselerName, GridPageSize: MaxRows, TotalRecord: totalOf(rows), NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField, SearchValue, fromDate, toDate,
  };
  res.json({ Model: AllEPinRequestsList, ViewBag });
}));

module.exports = router;
