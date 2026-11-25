'use strict';
// Ported from Franchise\Controllers\CustomerPanel\customer_wallet_statement.cs  (database: shopping — Franchise DataBaseContext = Db_Shopping)
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

const P = '/franchise/customer_wallet_statement';
const PROPS = ['rownumber', 'CLID', 'PROCESSDATE', 'CRDRTYPE', 'CRAMT', 'DRAMT', 'OLD_BALANCE', 'BALANCE', 'REMARKS', 'TRACENO', 'STATUS', 'DID', 'NAME', 'loginid', 'PHONE', 'ReferenceUsername'];

async function Index(req, res) {
  let { SearchField, SearchValue, MOBILE, fromDate, toDate, crdrlist, URL, Field, crlist, drlist } = req.p;
  const vb = {};
  let page = req.p.page;
  if (URL != null && URL !== '') {
    SearchValue = await UtilityClass.Decryptword(Field);
    SearchField = await UtilityClass.Decryptword(SearchField);
    vb.URL = 1;
  }
  if (MOBILE == null) MOBILE = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (crdrlist == null) crdrlist = '0';
  if (crlist == null) crlist = '';
  if (drlist == null) drlist = '';

  const DID = Number(req.user.did);
  const MaxRows = await UtilityClass.GridPageSize();
  page = toPage(page);
  const rows = await db.proc('shopping', 'usp_customerwallet_statement', {
    startrowindex: page, maxrows: 200, searchfield: SearchField, searchvalue: SearchValue,
    fromdate: fromDate, todate: toDate, did: DID, transationid: '', kycstatus: 6, crdrlist,
  });
  const AllEPinRequestsList = mapRows(rows, PROPS);
  const TotalRecord = parseInt(outv(rows, 'totalcount') === null ? 0 : outv(rows, 'totalcount'), 10);
  if (URL != null && URL !== '') SearchValue = '';
  res.json({
    Model: AllEPinRequestsList, ...vb,
    QUALIFICATIONlis: '', CurrentPage: page, MOBILE, GridPageSize: MaxRows, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate, toDate,
    QUALIFICATION: req.p.QUALIFICATION === undefined ? null : req.p.QUALIFICATION,
    userid: req.p.userid === undefined ? null : req.p.userid,
    ORDERBY: req.p.ORDERBY === undefined ? null : req.p.ORDERBY,
    Isdownload: req.p.Isdownload === undefined ? null : req.p.Isdownload,
  });
}

// auth
router.all(P + '/Index{/:id}', auth, asyncHandler(Index));
// route-config: franchisee/customer-wallet-statement
router.all('/franchise/franchisee/customer-wallet-statement{/:id}', auth, asyncHandler(Index));

module.exports = router;
