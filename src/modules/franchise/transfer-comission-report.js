'use strict';
// Ported from Franchise/Controllers/CustomerPanel/TransferComission_Report.cs  (DB: shopping - Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const PROPS = ['ROWNUMBER', 'Type', 'Date', 'Amount', 'STATUS'];

const handler = asyncHandler(async (req, res) => {
  let { TransID, fromDate, toDate } = req.p;
  let page = req.p.page;
  if (TransID == null) TransID = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const did = Math.trunc(Number(req.user.did));
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1;
  const rows = await proc('shopping', 'usp_reseller_transfer_request', {
    startrowindex: Number(page), maxrows: MaxRows, fromdate: fromDate, todate: toDate,
    transactionid: TransID, did, transferid: 2,
  });
  // PORT-NOTE: @TOTALCOUNT OUT read from "totalcount" column of first row (0 if none)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  res.json({
    Model: mapRows(rows, PROPS),
    ViewBag: {
      QUALIFICATIONlis: '', CurrentPage: page, MOBILE: '', GridPageSize: MaxRows, TotalRecord,
      NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField: '', SearchValue: '', fromDate, toDate,
      QUALIFICATION: '', userid: '', ORDERBY: '', Isdownload: '',
    },
  });
});
// auth ([SessionExpireCheck])
router.all(['/franchise/TransferComission_Report/Index{/:id}', '/franchise/TransferComission_Report'], auth, handler);
// route-config: franchisee/Transfer-Report
router.all('/franchise/franchisee/Transfer-Report', auth, handler);

module.exports = router;
