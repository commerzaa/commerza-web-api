'use strict';
/** Port of Franchise/Controllers/CustomerPanel/Payout_Report.cs. DB: 'shopping' */
const express = require('express');
const { query, scalar, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const router = express.Router();
const DB = 'shopping';
const s = (v) => (v === null || v === undefined ? '' : String(v));
const pint = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const totalOf = (rows, name = 'totalcount') => { const f = rows && rows[0]; if (!f) return 0; const k = Object.keys(f).find((x) => x.toLowerCase() === name); return k === undefined ? 0 : (parseInt(f[k], 10) || 0); };
const PROPS = ['ROWNUMBER', 'Type', 'Date', 'Amount', 'STATUS'];

// route-config: franchisee/Payout-Report
// auth
router.all(['/franchise/Payout_Report/Index{/:id}', '/franchise/franchisee/Payout-Report'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const TransID = p.TransID == null ? '' : s(p.TransID);
  const fromDate = p.fromDate == null ? '' : s(p.fromDate);
  const toDate = p.toDate == null ? '' : s(p.toDate);
  let page = pint(p.page);
  const did = Math.trunc(Number(req.user.did));
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_reseller_transfer_request', {
    startrowindex: page, maxrows: MaxRows, fromdate: fromDate, todate: toDate, transactionid: TransID, did, transferid: 1,
  });
  const TransferReportList = mapRows(rows, PROPS);
  const ViewBag = {
    QUALIFICATIONlis: '', CurrentPage: page, MOBILE: '', GridPageSize: MaxRows, TotalRecord: totalOf(rows), NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField: '', SearchValue: '', fromDate, toDate, QUALIFICATION: '', userid: '', ORDERBY: '', Isdownload: '',
  };
  res.json({ Model: TransferReportList, ViewBag });
}));

module.exports = router;
