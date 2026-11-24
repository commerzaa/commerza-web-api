'use strict';
// Ported from Franchise/Controllers/CustomerPanel/Utilities_Commission.cs  (DB: shopping - Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const PROPS = ['ROWNUMBER', 'ID', 'CLID', 'MOBILENO', 'OPERATORTYPE', 'AMOUNT', 'TRANSACTIONID', 'RECHARGEDATE', 'STATUS', 'NAME', 'EMAILID', 'OPERRATORNAME', 'OPERATORCODE', 'ISANDROIDORWEB', 'COMMISSION', 'SURCHRAGE'];

// auth  (also route-config: franchisee/Utlities-Commission)
const handler = asyncHandler(async (req, res) => {
  let { TransID, fromDate, toDate, Searchfield, Serachvalue } = req.p;
  let page = req.p.page;
  if (TransID == null) TransID = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (Searchfield == null) Searchfield = '';
  if (Serachvalue == null) Serachvalue = '';
  const did = Math.trunc(Number(req.user.did));
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1;
  const rows = await proc('shopping', 'usp_get_allrecharge_resellerwise_reports', {
    mode: 1, startrowindex: Number(page), maxrows: MaxRows, fromdate: fromDate, todate: toDate,
    searchfield: Searchfield, searchvalue: Serachvalue, did,
  });
  // PORT-NOTE: @TOTALCOUNT OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  const Model = mapRows(rows, PROPS);
  res.json({
    Model,
    ViewBag: {
      QUALIFICATIONlis: '', CurrentPage: page, MOBILE: '', GridPageSize: MaxRows, TotalRecord,
      NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField: '', SearchValue: '', fromDate, toDate,
      QUALIFICATION: '', userid: '', ORDERBY: '', Isdownload: '',
    },
  });
});
router.all(['/franchise/Utilities_Commission/Index{/:id}', '/franchise/Utilities_Commission'], auth, handler);
// route-config
router.all('/franchise/franchisee/Utlities-Commission', auth, handler);

module.exports = router;
