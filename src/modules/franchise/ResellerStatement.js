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

// Port of Franchise\Controllers\CustomerPanel\ResellerStatement.cs (1 action)
// route-config: franchisee/Reseller-Statement -> Index
// PORT-NOTE: C# model class Topup_List is used for the result rows (ResellerStatement class is unused).
const PROPS = ['ROW_NUMBER', 'ROWNUMBER', 'AMOUNT', 'Balance', 'DATE', 'PAYMODE', 'BANKNAME', 'IFsC_Code', 'MEM_REMARK', 'Status', 'TransactionID', 'ReferenceID', 'Type'];
// auth
router.all(['/franchise/ResellerStatement/Index{/:id}', '/franchise/franchisee/Reseller-Statement'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const TransID = s(p.TransID);
  const fromDate = s(p.fromDate);
  const toDate = s(p.toDate);
  const Type = s(p.Type);
  const out = {};
  if (p.B !== undefined && p.B !== null) out.back = 1;
  const did = parseInt(req.user.did, 10);
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page ? pg(p.page) : 1;
  const rows = await db.proc('shopping', 'usp_resellerwalletstatement', {
    STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromDate, TODATE: toDate, TransactionID: TransID, DID: did, Type,
  });
  const TotalRecord = parseInt(outv(rows, 'TOTALCOUNT'), 10) || 0;
  res.json(Object.assign(out, {
    Model: mapRows(rows, PROPS),
    QUALIFICATIONlis: '',
    CurrentPage: page,
    MOBILE: '',
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField: '',
    SearchValue: '',
    fromDate,
    toDate,
    QUALIFICATION: '',
    userid: '',
    ORDERBY: '',
    Isdownload: '',
  }));
}));

module.exports = router;
