'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/ShoppingandServices_Wallet.cs (ShoppingandServices_WalletController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const DB = 'shopping';

const STATEMENT_PROPS = ['rownumber', 'NETAMOUNT', 'Remark', 'USERNAME', 'WALLET', 'ORDERDATE', 'AMOUNT', 'CustomerName', 'EMAILID', 'PHONE', 'DistributorName', 'TYPE'];
const nn = (v) => (v === undefined || v === null ? '' : v);
function totalOf(rows, name) {
  const f = rows && rows[0];
  if (!f) return 0;
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  const n = k === undefined ? NaN : parseInt(f[k], 10);
  return Number.isNaN(n) ? 0 : n;
}

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: franchisee/ShoppingandServices-Wallet
// auth (legacy cast Session["Plid"] without a null check)
router.all(['/franchise/ShoppingandServices_Wallet/Index{/:id}', '/franchise/franchisee/ShoppingandServices-Wallet'], auth, asyncHandler(async (req, res) => {
  const DID = Number(req.user.did);
  let { page } = req.p;
  const ResselerName = String(nn(req.p.ResselerName));
  const SearchField = String(nn(req.p.SearchField));
  const SearchValue = String(nn(req.p.SearchValue));
  const fromDate = String(nn(req.p.fromDate));
  const toDate = String(nn(req.p.toDate));
  const mode = 1;
  const MaxRows = await UtilityClass.GridPageSize();
  page = parseInt(page, 10);
  if (Number.isNaN(page)) page = 1;
  // PORT-NOTE: @TotalCount OUT is read from the first result row (column "totalcount"); 0 when no rows.
  const rows = await proc(DB, 'usp_netbanking_statement', {
    startrowindex: page, maxrows: 100, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate.trim(), todate: toDate.trim(),
    resselername: ResselerName, mode, resellerid: DID,
  });
  const AllEPinRequestsList = mapRows(rows, STATEMENT_PROPS);
  const TotalRecord = totalOf(rows, 'totalcount');
  const ViewBag = {
    QUALIFICATIONlis: '', CurrentPage: page, ResselerName, GridPageSize: MaxRows, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate, toDate,
  };
  return res.json({ view: '~/Views/ShoppingandServices_Wallet/Index.cshtml', Model: AllEPinRequestsList, ViewBag });
}));

module.exports = router;
