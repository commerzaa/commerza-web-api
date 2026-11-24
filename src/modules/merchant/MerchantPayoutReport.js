'use strict';
// Ported from Merchant Panel/Controllers/CustomerPanel/MerchantPayoutReport.cs  (DB: shopping - Db_Shopping)
const express = require('express');
const { proc } = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const guard = [auth, requireType('merchant')];
const PROPS = ['Balance', 'CreatedDate', 'CreditAmount', 'DebitAmount', 'FromBRID', 'OperatorName', 'OperatorUserId', 'order_DAP', 'OrderId', 'Remark1', 'Remark2', 'RowNumber', 'ToBRID', 'TotalCount'];

// public method GetSettlementReport(BranchId, OrderId, fromDate, toDate)  (.ToStringOrEmpty())
async function GetSettlementReport(BranchId, OrderId, fromDate, toDate) {
  const rows = await proc(DB, 'ims_usp_getsettlementsreport', {
    startrowindex: 1, maxrows: 5, branchid: BranchId, orderid: OrderId,
    fromdate: fromDate === null || fromDate === undefined ? '' : String(fromDate),
    todate: toDate === null || toDate === undefined ? '' : String(toDate),
  });
  return mapRows(rows, PROPS);
}

// auth ([SessionExpireCheck])
router.all(['/merchant/MerchantPayoutReport/Index{/:id}', '/merchant/MerchantPayoutReport', '/merchant/Payout-Report'], ...guard, asyncHandler(async (req, res) => { // route-config: merchant/Payout-Report
  const BranchId = req.user.plid;
  let { OrderId, fromDate, toDate } = req.p;
  let page = req.p.page;
  if (OrderId == null) OrderId = '';
  if (page == null || page === '') page = 1;
  if (fromDate === null || fromDate === undefined || fromDate === '') fromDate = '';
  if (toDate === null || toDate === undefined || toDate === '') toDate = '';
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await proc(DB, 'ims_usp_getsettlementsreport', {
    startrowindex: Number(page), maxrows: MaxRows, branchid: BranchId, orderid: OrderId,
    fromdate: String(fromDate), todate: String(toDate),
  });
  // PORT-NOTE: @TotalCount OUT read from "totalcount" column of first row (0 if none)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  res.json({
    Model: mapRows(rows, PROPS),
    ViewBag: { CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage() },
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
  });
}));

// auth - public C# method exposed as MVC action
router.all('/merchant/MerchantPayoutReport/GetSettlementReport{/:id}', ...guard, asyncHandler(async (req, res) => {
  res.json(await GetSettlementReport(req.p.BranchId, req.p.OrderId, req.p.fromDate, req.p.toDate));
}));

module.exports = router;
