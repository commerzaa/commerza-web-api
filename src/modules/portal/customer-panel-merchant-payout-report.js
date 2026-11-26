// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/MerchantPayoutReport.cs (class MerchantPayoutReportController; DB: Db_Shopping)
// Started from src/modules/merchant/merchant-payout-report.js, then matched line by line with the portal C#.
// Proc: IMS_USP_GETSETTLEMENTSREPORT
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const c = require('./_shared/batch-05-common');
const b = require('./_shared/batch-23-common');
const UtilityClass = require('../../lib/portal/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const P = '/portal/MerchantPayoutReport';
// class MerchantPayoutReport
const PROPS = ['Balance', 'CreatedDate', 'CreditAmount', 'DebitAmount', 'FromBRID', 'OperatorName', 'OperatorUserId', 'order_DAP', 'OrderId', 'Remark1',
  'Remark2', 'RowNumber', 'ToBRID', 'TotalCount'];

/** public List<MerchantPayoutReport> GetSettlementReport(Int64 BranchId, string OrderId, string fromDate, string toDate) */
async function GetSettlementReport(BranchId, OrderId, fromDate, toDate) {
  const rows = await db.proc(DB, 'ims_usp_getsettlementsreport', {
    startrowindex: 1, maxrows: 5, branchid: BranchId, orderid: OrderId, fromdate: c.toStringOrEmpty(fromDate), todate: c.toStringOrEmpty(toDate),
  });
  return mapRows(rows, PROPS);
}

// auth ([SessionExpireCheck])
// route-config: merchant/Payout-Report -> MerchantPayoutReport/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/Payout-Report'], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const BranchId = Number(req.user.plid);
  let OrderId = b.mvcStr(req, 'OrderId');
  let fromDate = b.mvcStr(req, 'fromDate');
  let toDate = b.mvcStr(req, 'toDate');
  let page = c.bindNullableInt(req, 'page');
  if (OrderId === null) OrderId = '';
  if (page === null) page = 1;
  if (fromDate === null || fromDate === '') fromDate = '';
  if (toDate === null || toDate === '') toDate = '';
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await db.proc(DB, 'ims_usp_getsettlementsreport', {
    startrowindex: page, maxrows: MaxRows, branchid: BranchId, orderid: OrderId, fromdate: c.toStringOrEmpty(fromDate), todate: c.toStringOrEmpty(toDate),
  });
  const obj = mapRows(rows, PROPS);
  // PORT-NOTE: @TOTALCOUNT OUT is read from the "totalcount" column of the first row (0 when no rows).
  const TotalRecord = b.totalOf(rows);
  const ViewBag = { CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage() };
  return c.viewJson(res, '~/Views/CustomerPanel/MerchantPayoutReport/Index.cshtml', obj, ViewBag);
}));

// public (public non-ActionResult method => MVC action without a session check; MVC writes Convert.ToString(List<T>) as the content)
router.all(`${P}/GetSettlementReport{/:id}`, asyncHandler(async (req, res) => {
  const BranchId = c.bindInt(req, 'BranchId', 'System.Int64');
  await GetSettlementReport(BranchId, b.mvcStr(req, 'OrderId'), b.mvcStr(req, 'fromDate'), b.mvcStr(req, 'toDate'));
  res.type('text/html').send('System.Collections.Generic.List`1[MerchantPayoutReport]');
}));

module.exports = router;
