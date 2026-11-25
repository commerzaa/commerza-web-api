'use strict';
// Ported from Franchise\Controllers\CustomerPanel\Commission_Invoice.cs  (database: shopping — Franchise DataBaseContext = Db_Shopping)
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

const P = '/franchise/Commission_Invoice';
const PROPS = ['ROWNUMBER', 'INVOICENO', 'AMOUNT', 'INVOICEDATE', 'SERVICENAME'];

// [SessionExpireCheck] -> auth
async function Index(req, res) {
  let { TransID, fromDate, toDate } = req.p;
  let page = req.p.page;
  if (TransID == null) TransID = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const DID = Number(req.user.did);
  const did = Math.trunc(DID);
  const MaxRows = await UtilityClass.GridPageSize();
  page = toPage(page);
  const rows = await db.proc('shopping', 'usp_reseller_commission_gstinvoice_report', {
    startrowindex: page, maxrows: MaxRows, fromdate: fromDate, todate: toDate, did,
  });
  const _Invoice_list = mapRows(rows, PROPS);
  const TotalRecord = parseInt(outv(rows, 'totalcount') === null ? 0 : outv(rows, 'totalcount'), 10);
  res.json({
    Model: _Invoice_list,
    QUALIFICATIONlis: '', CurrentPage: page, MOBILE: '', GridPageSize: MaxRows, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField: '', SearchValue: '',
    fromDate, toDate, QUALIFICATION: '', userid: '', ORDERBY: '', Isdownload: '',
  });
}

// auth
router.all(P + '/Index{/:id}', auth, asyncHandler(Index));

module.exports = router;
