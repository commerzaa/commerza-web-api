'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Fund_Transfer_Report.cs (class Fund_Transfer_ReportController => /admin/Fund_Transfer_Report/...)
// Database: affiliate (Db_Affiliate).
//
// Coverage: Index -> route. (class FundTransferReport = model => FTR_PROPS)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/adminSession');
const B = require('./_shared/batch07_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Fund_Transfer_Report';

/** class FundTransferReport */
const FTR_PROPS = ['rowNumber', 'Branchcode', 'BranchName', 'EmpID', 'transferdate', 'Type', 'Amount', 'Remark', 'Ledger_Balance', 'Balance', 'AFTID'];

// ---------------------------------------------------------------- ActionResult Index(string SearchField, string SearchValue, string fromDate, string toDate, int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let page = B.nInt(req.p.page);
  const BrCode = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const bt = req.user.isstore; void bt; // ((Employee_Master)Session["Admin_User"]).IsStore (unused)
  // usp_All_FundsTransfer_history @StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@ToDate,@BrCode,@TotalCount out
  // PORT-NOTE: procedure is not in the affilate.sql dump; parameter names taken from the legacy call text.
  const rows = await db.proc(DB, 'usp_All_FundsTransfer_history', {
    StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(), fromDate: fromDate.trim(), ToDate: toDate.trim(),
    BrCode,
  });
  const AlltransferlList = mapRows(rows, FTR_PROPS);
  // int.Parse(spOutput.Value.ToString()) (no try => DBNull/"" throws). PORT-NOTE: OUT read from the first row; no row => 0.
  const TotalRecord = rows.length ? B.outInt(rows[0], 'totalcount') : 0;
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate, toDate,
  };
  return res.json({ view: '~/Views/AdminPanel/Fund_Transfer_Report/Index.cshtml', Model: AlltransferlList, ...ViewBag });
}));

module.exports = router;
