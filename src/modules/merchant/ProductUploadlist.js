'use strict';
// Ported from Merchant Panel\Controllers\CustomerPanel\ProductUploadlist.cs (database: shopping - Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const guard = [auth, requireType('merchant')];
const COLS = ['ROWNUMBER1', 'UPLOADEDDATE', 'MAINCATID', 'CATID', 'ROWNUMBER', 'SUBCATID', 'GROUPID', 'TotalImageUploaded', 'categoryname', 'subcategoryname', 'subsubcategoryname'];

// auth (legacy had no session check but reads Session["Plid"])
router.all(['/merchant/ProductUploadlist/Index{/:id}', '/merchant/Product-Uploaded-list'], ...guard, asyncHandler(async (req, res) => { // route-config: merchant/Product-Uploaded-list
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
  // USP_MULTIPLEIMAGEFORPRODUCT @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,'','',3,'',@TotalRecord out,0,0,0,0,@PLID
  const rows = await db.proc(DB, 'usp_multipleimageforproduct', {
    startrowindex: page, maxrows: MaxRows, searchfield: String(SearchField).trim(), searchvalue: String(SearchValue).trim(),
    fromdate: String(fromDate).trim(), todate: String(toDate).trim(), imagename: '', url: '', mode: 3, stroutput: '',
    maincatid: 0, catid: 0, subcatid: 0, groupid: 0, plid: Number(req.user.plid),
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
