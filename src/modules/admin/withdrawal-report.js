'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Withdrawal_Report.cs (class Withdrawal_ReportController => /admin/Withdrawal_Report/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Kit_Master = require('../../lib/admin/Kit_Master');
const { adminAuth } = require('./_shared/admin-session');
const B = require('./_shared/batch13-12-common');

const { DB } = B;
const router = express.Router();
const C = 'Withdrawal_Report';

/** class WithdrawalReport */
const WITHDRAWAL_REPORT_PROPS = ['rowNumber', 'LoginId', 'userName', 'Membername', 'transferdate', 'AccountNo', 'TransferredAmount',
  'TransactionId', 'paymode', 'remarks', 'regNo', 'retranid', 'Status'];

// ---------------------------------------------------------------- ViewResult Index(string SearchField, string SearchValue, string fromDate, string toDate, string ddlPlan, int? page, int? ddlcustpage)
// auth (PORT-NOTE: legacy had NO session check although it lists every member's withdrawals - protected here)
// route-config: "AdminPanel/Withdrawal-Report" -> Withdrawal_Report/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Withdrawal-Report'], adminAuth, asyncHandler(async (req, res) => {
  const SearchField = B.s0(req.p.SearchField);
  const SearchValue = B.s0(req.p.SearchValue);
  const fromDate = B.s0(req.p.fromDate);
  const toDate = B.s0(req.p.toDate);
  const ddlPlan = B.s0(req.p.ddlPlan);
  let page = B.nInt(req.p.page);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  const ViewBag = {};
  const km = new Kit_Master();
  ViewBag.PlanList = await km.PlanList(); // new SelectList(km.PlanList()) (items = the plan names)
  if (ddlcustpage === null) ddlcustpage = 50;
  const MaxRows = B.cvtInt(ddlcustpage);
  if (page === null) page = 1;
  // usp_All_withdrawal_history @StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@ToDate,@userType,@TotalCount out
  const rows = await db.proc(DB, 'usp_All_withdrawal_history', {
    StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(), fromDate: fromDate.trim(),
    ToDate: toDate.trim(), userType: ddlPlan.trim(),
  });
  const AllwithdrawalList = mapRows(rows, WITHDRAWAL_REPORT_PROPS);
  const TotalRecord = B.intOutStrict(rows, 'TotalCount');
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.usertype = ddlPlan;
  ViewBag.ddlcustpage = ddlcustpage;
  return res.json({ view: '~/Views/AdminPanel/Withdrawal_Report/Index.cshtml', Model: AllwithdrawalList, ...ViewBag });
}));

module.exports = router;
