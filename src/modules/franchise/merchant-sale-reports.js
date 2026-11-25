'use strict';
// Ported from Franchise/Controllers/CustomerPanel/Merchant_Sale_Reports.cs  (DB: shopping - Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const router = express.Router();
const { query, proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const CHART = ['MonthAndYear', 'order_cost'];
const ALL = ['agencyMonths', 'Agncyamount', 'AgncyBV', 'agncyDate', 'Brcode', 'BrName', 'MonthAndYear', 'order_cost', 'order_netAmt', 'order_vat', 'ordermonth', 'prcode', 'product_name', 'totalBV'];
const BASE = '/franchise/Merchant_Sale_Reports';

// auth
router.all(`${BASE}/GetSalerptByAgency{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await proc('shopping', 'usp_getagency_salereports', {
    monthyear: req.p.monthyear, searchfield: req.p.SearchField, searchtype: req.p.searchval,
  });
  res.json(mapRows(rows, CHART));
}));

// auth
router.all(`${BASE}/GetSalerptByBV{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await proc('shopping', 'usp_getbvsalereports', {
    monthyear: req.p.monthyear, searchfield: req.p.SearchField, searchtype: req.p.searchval,
  });
  res.json(mapRows(rows, CHART));
}));

// auth
router.all(`${BASE}/GetSalerptByMonth{/:id}`, auth, asyncHandler(async (req, res) => {
  const BranchId = req.user.did;
  const rows = await proc('shopping', 'usp_getsalereports', {
    monthyear: req.p.monthyear, searchfield: req.p.SearchField, searchtype: req.p.searchval, branchid: BranchId,
  });
  res.json(mapRows(rows, CHART));
}));

// auth
router.all(`${BASE}/GetSalerptByProduct{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await proc('shopping', 'usp_getsaleonproductreports', {
    searchfield: req.p.SearchField, searchtype: req.p.searchval,
  });
  res.json(mapRows(rows, CHART));
}));

// auth
router.all([`${BASE}/Index{/:id}`, BASE], auth, asyncHandler(async (req, res) => {
  let ddlmonthYear = req.p.ddlmonthYear;
  let SearchField = req.p.SearchField;
  if (ddlmonthYear == null) ddlmonthYear = '';
  if (SearchField == null) SearchField = '';
  const BranchId = req.user.did;
  let AllSaleReport = [];
  // CONVERT(CHAR(4),orderdate,100)+CONVERT(CHAR(4),orderdate,120) => "Mon yyyy"-style key (e.g. "Nov 2026")
  const MonthYear = mapRows(await query('shopping',
    "select distinct (to_char(orderdate,'Mon') || ' ' || to_char(orderdate,'YYYY')) as monthandyear from tbl_order_master where branchid = @branchid",
    { branchid: BranchId }), ['MonthAndYear']);
  MonthYear.unshift({ MonthAndYear: '-- Select Month Year --' });
  let ModelSaleReport;
  if (SearchField !== '') {
    // SQL text only references @MONTHYEAR,@SEARCHTYPE (the extra @BRANCHID parameter is not part of the statement)
    AllSaleReport = mapRows(await proc('shopping', 'ims_usp_getclientsalereport', { monthyear: ddlmonthYear, searchtype: SearchField }), ALL);
    if (AllSaleReport.length > 0) {
      ModelSaleReport = AllSaleReport.map((Item) => ({ MonthAndYear: Item.MonthAndYear, order_cost: Item.order_cost }));
    }
  }
  res.json({ Model: AllSaleReport, ViewBag: { MonthYear, ModelSaleReport, SearchField, ddlmonthYear } });
}));

module.exports = router;
