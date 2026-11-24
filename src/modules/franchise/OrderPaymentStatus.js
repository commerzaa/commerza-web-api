'use strict';
/** Port of Franchise/Controllers/CustomerPanel/OrderPaymentStatus.cs. DB: 'shopping' */
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
const PROPS = ['ROWNUMBER', 'Date', 'CUSTOMERWALLET', 'MLMWALLET', 'Amount', 'CustomerID', 'ORDERID', 'TRANSID', 'Status', 'ONLINEPAYMENT'];

// route-config: franchisee/OrderPayment-Status
// auth
router.all(['/franchise/OrderPaymentStatus/Index{/:id}', '/franchise/franchisee/OrderPayment-Status'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const MOBILE = p.MOBILE == null ? '' : s(p.MOBILE);
  const SearchField = p.SearchField == null ? '' : s(p.SearchField);
  const SearchValue = p.SearchValue == null ? '' : s(p.SearchValue);
  const fromDate = p.fromDate == null ? '' : s(p.fromDate);
  const toDate = p.toDate == null ? '' : s(p.toDate);
  let page = pint(p.page);
  const DID = Number(req.user.did);
  const PMID = Math.trunc(Number(req.user.pmid));
  const MaxRows = await UtilityClass.GridPageSize();
  const v = await scalar(DB, 'SELECT coalesce(transationpayumoneyrate,0) FROM tbl_companysettings WHERE pmid = @pmid LIMIT 1', { pmid: PMID });
  const Transactionrate = v === null || v === undefined ? 0 : v;
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_orderpaymentsdetails_reseller', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate, todate: toDate, did: DID,
  });
  const AllEPinRequestsList = mapRows(rows, PROPS);
  const ViewBag = {
    Transactionrate, QUALIFICATIONlis: '', CurrentPage: page, MOBILE, GridPageSize: MaxRows, TotalRecord: totalOf(rows),
    NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate, toDate, QUALIFICATION: pint(p.QUALIFICATION),
    userid: pint(p.userid), ORDERBY: p.ORDERBY === undefined ? null : p.ORDERBY, Isdownload: pint(p.Isdownload),
  };
  res.json({ Model: AllEPinRequestsList, ViewBag });
}));

module.exports = router;
