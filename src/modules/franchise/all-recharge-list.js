'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/ALL_Recharge_List.cs (ALL_Recharge_ListController)
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

const RECHARGE_PROPS = ['ROWNUMBER', 'ID', 'CLID', 'MOBILENO', 'OPERATORTYPE', 'AMOUNT', 'TRANSACTIONID', 'RECHARGEDATE', 'STATUS', 'NAME', 'EMAILID',
  'OPERRATORNAME', 'OPERATORCODE', 'ISANDROIDORWEB', 'MLMWALLET', 'CUSWTOMERWALLET', 'ONLINEAMOUNT', 'REMARKS'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
function totalOf(rows, name) {
  const f = rows && rows[0];
  if (!f) return 0;
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  const n = k === undefined ? NaN : parseInt(f[k], 10);
  return Number.isNaN(n) ? 0 : n;
}

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: franchisee/ALL-Recharge-List
// auth (legacy cast Session["Plid"] without a null check)
router.all(['/franchise/ALL_Recharge_List/Index{/:id}', '/franchise/franchisee/ALL-Recharge-List'], auth, asyncHandler(async (req, res) => {
  const fromDate = nn(req.p.fromDate);
  const toDate = nn(req.p.toDate);
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  const Status = nn(req.p.Status);
  let page = parseInt(req.p.page, 10);
  const MaxRows = await UtilityClass.GridPageSize();
  const DID = Number(req.user.did);
  if (Number.isNaN(page)) page = 1;
  const mode = 1;
  // PORT-NOTE: @TOTALCOUNT OUT is read from the first result row (column "totalcount"); 0 when no rows.
  const rows = await proc(DB, 'usp_get_resellerwise_allrecharge_reports', {
    mode, startrowindex: page, maxrows: MaxRows, fromdate: fromDate, todate: toDate, searchfield: SearchField, searchvalue: SearchValue,
    status: Status, did: DID,
  });
  const _ALL_Recharge = mapRows(rows, RECHARGE_PROPS);
  const TotalRecord = totalOf(rows, 'totalcount');
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, fromDate, toDate, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
  };
  return res.json({ view: '~/Views/ALL_Recharge_List/Index.cshtml', Model: _ALL_Recharge, ViewBag });
}));

module.exports = router;
