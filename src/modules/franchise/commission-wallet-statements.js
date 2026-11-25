'use strict';
// Ported from Franchise/Controllers/CustomerPanel/Commission_Wallet_Statements.cs  (DB: shopping - Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const PROPS = ['rownumber', 'NETAMOUNT', 'Remark', 'USERNAME', 'WALLET', 'ORDERDATE', 'AMOUNT', 'CustomerName', 'EMAILID', 'PHONE', 'DistributorName', 'TYPE'];

const handler = asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, ResselerName, fromDate, toDate } = req.p;
  let page = req.p.page;
  if (ResselerName == null) ResselerName = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const DID = req.user.did;
  const mode = 7;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1;
  const rows = await proc('shopping', 'usp_netbanking_statement', {
    startrowindex: Number(page), maxrows: 100, searchfield: SearchField, searchvalue: SearchValue,
    fromdate: fromDate.trim(), todate: toDate.trim(), resselername: ResselerName, mode, resellerid: DID,
  });
  // PORT-NOTE: @TotalCount OUT read from "totalcount" column of first row (0 if none)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  res.json({
    Model: mapRows(rows, PROPS),
    ViewBag: {
      QUALIFICATIONlis: '', CurrentPage: page, ResselerName, GridPageSize: MaxRows, TotalRecord,
      NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate, toDate,
    },
  });
});
// auth
router.all(['/franchise/Commission_Wallet_Statements/Index{/:id}', '/franchise/Commission_Wallet_Statements'], auth, handler);
// route-config: franchisee/Commission-Wallet-Statements
router.all('/franchise/franchisee/Commission-Wallet-Statements', auth, handler);

module.exports = router;
