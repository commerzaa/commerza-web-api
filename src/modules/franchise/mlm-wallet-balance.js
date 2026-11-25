'use strict';
/** Port of Franchise/Controllers/CustomerPanel/MLMWalletBalance.cs. DB: 'shopping' */
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
const PROPS = ['rownumber', 'CLID', 'UPDATEDDATE', 'ADDMONEY', 'TRANSFERTOBANK', 'TOTALBALANCE', 'AVAILABLEBALANCE', 'DID', 'NAME', 'EMAILID', 'PHONE', 'LOGINID',
  'PackagesName', 'Amount', 'BusinessInfo', 'KycStatusText'];

// route-config: franchisee/MLMWallet-Balance
// auth
router.all(['/franchise/MLMWalletBalance/Index{/:id}', '/franchise/franchisee/MLMWallet-Balance'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const MOBILE = p.MOBILE == null ? '' : s(p.MOBILE);
  const SearchField = p.SearchField == null ? '' : s(p.SearchField);
  const SearchValue = p.SearchValue == null ? '' : s(p.SearchValue);
  const fromDate = p.fromDate == null ? '' : s(p.fromDate);
  const toDate = p.toDate == null ? '' : s(p.toDate);
  const Availbalance = p.Availbalance == null ? '' : s(p.Availbalance);
  let page = pint(p.page);
  const DID = Number(req.user.did);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  // @TotalCount and @Totalwallet are OUT parameters (returned as columns of the result row)
  const rows = await proc(DB, 'usp_customermlmwallet', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate, todate: toDate, did: DID, balance: Availbalance,
  });
  const AllEPinRequestsList = mapRows(rows, PROPS);
  const ViewBag = {
    QUALIFICATIONlis: '', CurrentPage: page, MOBILE, GridPageSize: MaxRows, TotalRecord: totalOf(rows), NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField, SearchValue, fromDate, toDate, QUALIFICATION: pint(p.QUALIFICATION), userid: pint(p.userid), ORDERBY: p.ORDERBY === undefined ? null : p.ORDERBY,
    Isdownload: pint(p.Isdownload),
  };
  res.json({ Model: AllEPinRequestsList, ViewBag });
}));

module.exports = router;
