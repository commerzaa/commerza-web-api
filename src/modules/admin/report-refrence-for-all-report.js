'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Report_Refrence_For_All_ReportController.cs
// (class Report_Refrence_For_All_ReportController => /admin/Report_Refrence_For_All_Report/...). Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const { DB, nint, nstr, view, tab, cs, nz, mapRows, outParseInt } = require('./_shared/batch13-04-common');

const router = express.Router();
const C = 'Report_Refrence_For_All_Report';

/** class Report_Reference */
const REPORT_REFERENCE_PROPS = ['TLBV', 'TRBV', 'CLBV', 'CRBV', 'CLPV', 'CRPV', 'PAIDBV', 'FLUSHBV', 'PAIDPV', 'FLUSHPV', 'DIRECTINCOME',
  'RollupIncome', 'GrowthReferralIncome', 'LEVELINCOME', 'ROI_GROWTHLEVEL', 'PAIRINCOME', 'ROI', 'RoyalityIncome', 'CashReward',
  'CURRENTINCOME', 'TOTALINCOME', 'WITHDRAWALAMOUNT', 'Credited_Fund', 'Used_Fund', 'Available_Fund', 'CAPPINGLIMIT', 'DepositedATC',
  'Transferred_Fund', 'Deducted_Fund', 'NetCommissionWallet', 'TotalEarning', 'TotalEarningWithDrawals', 'UserName', 'Fname', 'Mobile',
  'EmailId', 'DOC', 'REGDATE', 'ROWNUMBER', 'HoldWalletBalanceByAdmin', 'HOLDREFERRALDIRECTINCOME', 'HOLDLEVELINCOME',
  'HOLDGROWTHREFERRALDIRECTINCOME', 'HOLDGROWTHLEVELINCOME'];
/** class Header_And_DbColumn_Report_Reference */
const HEADER_PROPS = ['Header', 'DbColumnName'];

const s0 = (v) => { const x = nstr(v); return x === null ? '' : x; };

// ---------------------------------------------------------------- Index(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue, string GenerateExcel)
// auth (legacy had no session check; admin report data => adminAuth)
// route-config: "AdminPanel/report-refrence-for-all-report" (id optional) -> Report_Refrence_For_All_Report/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/report-refrence-for-all-report{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  let Page = nint(req.p.Page);
  const FromDate = s0(req.p.FromDate);
  const ToDate = s0(req.p.ToDate);
  const SearchField = s0(req.p.SearchField);
  const SearchValue = s0(req.p.SearchValue);
  const ViewBag = {};
  // (no try/catch in legacy: errors are unhandled => 500)
  const MaxRows = await UtilityClass.GridPageSize();
  if (Page === null) Page = 1;
  // DbObj.Database.CommandTimeout = 1000
  const rows = await db.proc(DB, 'Usp_ReferenceReport', {
    Mode: '1', FromDate, ToDate, SearchType: SearchField, SearchValue, StartRowIndex: Page, MaxRows,
  });
  const ObjList_Report_Reference = {};
  ObjList_Report_Reference.LiReport_Reference = mapRows(rows, REPORT_REFERENCE_PROPS);
  ObjList_Report_Reference.LiHeader_And_DbColumn_Report_Reference = mapRows(
    await db.proc(DB, 'Usp_Report_Master_Management', { URL: 'report-refrence-for-all-report', EMPID: '0', MODE: '2' }), HEADER_PROPS);
  const TotalRecord = outParseInt(rows, 'TotalCount'); // Convert.ToInt32(SpOutputCount.Value.ToString())
  ViewBag.CurrentPage = Page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.toDate = ToDate;
  ViewBag.fromDate = FromDate;
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  return view(res, '~/Views/AdminPanel/Report_Refrence_For_All_Report/Index.cshtml', ObjList_Report_Reference, ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue, string GenerateExcel)
// auth (public method => routable in legacy; no session check; admin report data => adminAuth)
// Legacy wrote ~/AllExcelSheets/Report_Reference.xls and returned an empty response (the Response.Redirect was commented out).
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let Page = nint(req.p.Page);
  const FromDate = s0(req.p.FromDate);
  const ToDate = s0(req.p.ToDate);
  const SearchField = s0(req.p.SearchField);
  const SearchValue = s0(req.p.SearchValue);
  const ViewBag = {};
  const MaxRows = await UtilityClass.GridPageSize(); // (unused, like legacy)
  void MaxRows;
  if (Page === null) Page = 1;
  const rows = await db.proc(DB, 'Usp_ReferenceReport', {
    Mode: '1', FromDate, ToDate, SearchType: SearchField, SearchValue, StartRowIndex: '1', MaxRows: '1000000',
  });
  const LiReport_Reference = mapRows(rows, REPORT_REFERENCE_PROPS);
  try {
    const dir = path.join(config.uploadDir, 'AllExcelSheets');
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, 'Report_Reference.xls');
    ViewBag.filepath = filepath;
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    let out = ['S.No.', 'User Name', 'Name', 'Mobile', 'Email ID', 'Activation Date', 'Registratoin Date'].map((h) => `${h} \t`).join('');
    let closed = false; // wr.Close() in the per-row catch => every later write throws
    for (const item of LiReport_Reference) {
      try {
        if (closed) throw new Error('Cannot write to a closed TextWriter.');
        out += '\n';
        out += tab(cs(item.ROWNUMBER)) + ' \t';
        out += tab(cs(item.UserName)) + ' \t';
        out += tab(cs(item.Fname)) + ' \t';
        out += tab(cs(item.Mobile)) + ' \t';
        out += tab(cs(item.EmailId)) + ' \t';
        out += tab(nz(item.DOC)) + ' \t';
        out += tab(nz(item.REGDATE)) + ' \t';
      } catch (ExpObj) {
        await errorInsert(req, ExpObj, 'ExportReport');
        closed = true;
      }
    }
    fs.writeFileSync(filepath, out);
    // Response.Redirect("~/Transfer_Atc_In_Member_Wallet.xls") was commented out in legacy
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_ReferenceReport');
    ViewBag.filepath = ExpObj.message;
  }
  return res.send(''); // void action => empty response
}));

module.exports = router;
