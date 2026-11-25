'use strict';
// Ported from Franchise\Controllers\CustomerPanel\CommisionReport.cs  (database: shopping — Franchise DataBaseContext = Db_Shopping)
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

const P = '/franchise/CommisionReport';
const PROPS = ['ROW_NUMBER', 'ROWNUMBER', 'DATE', 'InvoiceNo', 'OrderNo', 'Quantity', 'Status', 'Commission', 'Commission_per', 'TotalAmount', 'PROCESSDATE', 'RATEOFBV', 'ORDERBV', 'RELEASEBV', 'ISRESELLERRELEASE', 'RESELLERRELEASEBATCH', 'OrderID', 'Product_Name', 'Relased', 'ISDistributed', 'PROCESSTYPE'];

async function Index(req, res) {
  let { InvoiceNo, fromDate, toDate } = req.p;
  let page = req.p.page;
  if (InvoiceNo == null) InvoiceNo = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const DID = Number(req.user.did);
  const did = Math.trunc(DID);
  const MaxRows = await UtilityClass.GridPageSize();
  page = toPage(page);
  const rows = await db.proc('shopping', 'usp_reseller_commissionreport', {
    startrowindex: page, maxrows: MaxRows, fromdate: fromDate, todate: toDate, invoiceno: InvoiceNo, did,
  });
  const CommisionReport = mapRows(rows, PROPS);
  const tc = outv(rows, 'totalcount');
  let TotalRecord = 0;
  if (str(tc) !== '') TotalRecord = parseInt(tc, 10);
  res.json({
    Model: CommisionReport,
    QUALIFICATIONlis: '', CurrentPage: page, MOBILE: '', GridPageSize: MaxRows, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField: '', SearchValue: '',
    fromDate, toDate, QUALIFICATION: '', userid: '', ORDERBY: '', Isdownload: '',
  });
}

// auth
router.all(P + '/Index{/:id}', auth, asyncHandler(Index));
// route-config: franchisee/Commision-Report
router.all('/franchise/franchisee/Commision-Report{/:id}', auth, asyncHandler(Index));

module.exports = router;
