'use strict';
// Ported from Franchise\Controllers\CustomerPanel\MLMWalletStatement.cs (database: shopping - Franchise DataBaseContext points at Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const guard = [auth, requireType('franchise')];
// model class Customer_Wallet_Statement (defined elsewhere in the app); keys follow the procedure columns
const COLS = ['rownumber', 'CLID', 'PROCESSDATE', 'CRDRTYPE', 'CRAMT', 'DRAMT', 'OLD_BALANCE', 'BALANCE', 'REMARKS', 'TRACENO', 'STATUS', 'DID', 'NAME', 'loginid', 'PHONE', 'ReferenceUsername'];

// auth
const handler = asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, GENDER, QUALIFICATION, userid, ORDERBY, Isdownload, MOBILE, fromDate, toDate, page, URL, Field } = req.p;
  const out = {};
  if (URL !== undefined && URL !== null && URL !== '') {
    SearchValue = await UtilityClass.Decryptword(Field);
    SearchField = await UtilityClass.Decryptword(SearchField);
    out.URL = 1;
  }
  if (MOBILE == null) MOBILE = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const DID = Number(req.user.did);
  const MaxRows = await UtilityClass.GridPageSize();
  page = (page === undefined || page === null || page === '') ? 1 : parseInt(page, 10);
  const rows = await db.proc('shopping', 'usp_customermlmwallet_statement', {
    STARTROWINDEX: page, MAXROWS: 200, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: fromDate, TODATE: toDate, DID,
  });
  // PORT-NOTE: @TotalCount OUT read from the 'totalcount' column of the first row (legacy int.Parse failed on empty)
  const TotalRecord = rows.length && rows[0].totalcount != null ? Number(rows[0].totalcount) : 0;
  if (URL !== undefined && URL !== null && URL !== '') SearchValue = '';
  res.json({
    ...out, Model: mapRows(rows, COLS),
    QUALIFICATIONlis: '', CurrentPage: page, MOBILE, GridPageSize: MaxRows, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate, toDate,
    QUALIFICATION: QUALIFICATION === undefined ? null : QUALIFICATION, userid: userid === undefined ? null : userid,
    ORDERBY: ORDERBY === undefined ? null : ORDERBY, Isdownload: Isdownload === undefined ? null : Isdownload,
  });
});
router.all('/franchise/MLMWalletStatement/Index{/:id}', ...guard, handler);
// route-config
router.all('/franchise/franchisee/MLMWallet-Statement', ...guard, handler);

module.exports = router;
