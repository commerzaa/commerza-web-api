// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Merchant_Sale_Reports.cs (class Merchant_Sale_ReportsController; DB: Db_Shopping)
// Started from src/modules/merchant/merchant-sale-reports.js, then matched line by line with the portal C#.
// Model classes SaleReportchart / AllSaleRport / MonthAndYears live in Controllers/CustomerPanel/Sale_Reports.cs.
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const c = require('./_shared/batch-05-common');
const b = require('./_shared/batch-23-common');

const router = express.Router();
const DB = 'shopping';
const P = '/portal/Merchant_Sale_Reports';
const SALE_REPORT_CHART = ['MonthAndYear', 'order_cost'];
const ALL_SALE_RPORT = ['agencyMonths', 'Agncyamount', 'AgncyBV', 'agncyDate', 'Brcode', 'BrName', 'MonthAndYear', 'order_cost', 'order_netAmt', 'order_vat',
  'ordermonth', 'prcode', 'product_name', 'totalBV'];

// PORT-NOTE: SqlQuery("DBO.X @A,@B,@C", ...) passes the parameters positionally; the PostgreSQL functions are called with the same
// (named) parameters. An extra SqlParameter that is not referenced in the command text (@BRANCHID below) never reached the procedure.

// auth ([SessionExpireCheck])
router.all(`${P}/GetSalerptByAgency{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_getagency_salereports', {
    monthyear: b.mvcStr(req, 'monthyear'), searchfield: b.mvcStr(req, 'SearchField'), searchtype: b.mvcStr(req, 'searchval'),
  });
  res.json(mapRows(rows, SALE_REPORT_CHART));
}));

// auth ([SessionExpireCheck])
router.all(`${P}/GetSalerptByBV{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_getbvsalereports', {
    monthyear: b.mvcStr(req, 'monthyear'), searchfield: b.mvcStr(req, 'SearchField'), searchtype: b.mvcStr(req, 'searchval'),
  });
  res.json(mapRows(rows, SALE_REPORT_CHART));
}));

// auth ([SessionExpireCheck])
router.all(`${P}/GetSalerptByMonth{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const BranchId = Number(req.user.plid);
  void BranchId; // new SqlParameter("@BRANCHID", BranchId) is not part of the command text => usp_getSaleReports uses its default @BranchId = 0
  const rows = await db.proc(DB, 'usp_getsalereports', {
    monthyear: b.mvcStr(req, 'monthyear'), searchfield: b.mvcStr(req, 'SearchField'), searchtype: b.mvcStr(req, 'searchval'),
  });
  res.json(mapRows(rows, SALE_REPORT_CHART));
}));

// auth ([SessionExpireCheck])
router.all(`${P}/GetSalerptByProduct{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_getsaleonproductreports', {
    searchfield: b.mvcStr(req, 'SearchField'), searchtype: b.mvcStr(req, 'searchval'),
  });
  res.json(mapRows(rows, SALE_REPORT_CHART));
}));

// auth ([SessionExpireCheck])
// route-config: merchant/Sales-Report -> Merchant_Sale_Reports/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/Sales-Report'], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  let ddlmonthYear = b.mvcStr(req, 'ddlmonthYear');
  let SearchField = b.mvcStr(req, 'SearchField');
  if (ddlmonthYear === null) ddlmonthYear = '';
  if (SearchField === null) SearchField = '';
  const BranchId = Number(req.user.plid);
  const ViewBag = {};
  let AllSaleReport = [];
  // CONVERT(CHAR(4), orderdate, 100) + CONVERT(CHAR(4), orderdate, 120) => "Mon " + "yyyy" (e.g. "Nov 2026")
  const MonthYear = mapRows(await db.query(DB,
    "select distinct (to_char(orderdate, 'Mon') || ' ' || to_char(orderdate, 'YYYY')) as monthandyear from tbl_order_master where branchid = @branchid",
    { branchid: BranchId }), ['MonthAndYear']);
  MonthYear.unshift({ MonthAndYear: '-- Select Month Year --' });
  ViewBag.MonthYear = MonthYear;
  if (SearchField !== '') {
    // @BRANCHID is not in the command text => ims_usp_GetClientSaleReport runs with its default @BRANCHID = 1
    AllSaleReport = mapRows(await db.proc(DB, 'ims_usp_getclientsalereport', { monthyear: ddlmonthYear, searchtype: SearchField }), ALL_SALE_RPORT);
    if (AllSaleReport.length > 0) {
      const Salechart = [];
      for (const item of AllSaleReport) Salechart.push({ MonthAndYear: item.MonthAndYear, order_cost: item.order_cost });
      ViewBag.ModelSaleReport = Salechart;
    }
  }
  ViewBag.SearchField = SearchField;
  ViewBag.ddlmonthYear = ddlmonthYear;
  return c.viewJson(res, '~/Views/CustomerPanel/Merchant_Sale_Reports/Index.cshtml', AllSaleReport, ViewBag);
}));

module.exports = router;
