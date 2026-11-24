'use strict';
// Ported from Franchise\Controllers\CustomerPanel\ProductUploadlist.cs (database: shopping - Franchise DataBaseContext points at Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const guard = [auth, requireType('franchise')];
const COLS = ['ROWNUMBER1', 'UPLOADEDDATE', 'MAINCATID', 'CATID', 'ROWNUMBER', 'SUBCATID', 'GROUPID', 'TotalImageUploaded', 'categoryname', 'subcategoryname', 'subsubcategoryname'];

// auth (legacy had no session check but reads Session["Plid"])
router.all('/franchise/ProductUploadlist/Index{/:id}', ...guard, asyncHandler(async (req, res) => {
  const MaxRows = await UtilityClass.GridPageSize();
  let { page, SearchField, SearchValue, fromDate, toDate, MAINCATID, CATID, SUBCATID } = req.p;
  page = (page === undefined || page === null || page === '') ? 1 : parseInt(page, 10);
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (MAINCATID == null) MAINCATID = '0';
  if (CATID == null) CATID = '0';
  if (SUBCATID == null) SUBCATID = '0';
  // call literal args: '', '', 3, '', @TotalRecord out, 0,0,0,0, @PLID  (positional args beyond the named ones kept as in C#)
  // PORT-NOTE: positional literals are passed by their legacy position; procedure parameter names are assumed.
  const rows = await db.proc('shopping', 'usp_multipleimageforproduct', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: String(SearchField).trim(), SEARCHVALUE: String(SearchValue).trim(),
    FROMDATE: String(fromDate).trim(), TODATE: String(toDate).trim(), PLID: Number(req.user.did),
  });
  // PORT-NOTE: @TotalRecord OUT read from the 'totalrecord' column of the first row
  let TotalRecord = rows.length && rows[0].totalrecord != null ? String(rows[0].totalrecord) : '0';
  if (TotalRecord === '') TotalRecord = '0';
  res.json({
    Model: mapRows(rows, COLS),
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord: Number(TotalRecord), NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField, SearchValue, fromDate, toDate,
  });
}));

module.exports = router;
