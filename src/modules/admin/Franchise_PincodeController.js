'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Franchise_PincodeController.cs (class Franchise_PincodeController => /admin/Franchise_Pincode/...)
// Database: affiliate (Db_Affiliate).
// PORT-NOTE: RouteConfig "AdminPanel/franchise-application-pincode" maps controller="Index", action="Franchise_Pincode" (swapped in legacy,
// it never reached this controller) => not registered here.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const B = require('./_shared/batch07_common');
const { totalOut } = require('./_shared/batch07C_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Franchise_Pincode';

/** class Franchise_Pincode_Request (same file) */
const FPR_PROPS = ['ROWNUMBER', 'ApplyiedForPinCodeFirstChoice', 'CountApplyiedForPinCodeFirstChoice', 'ApplyiedForPinCodeSecondChoice',
  'CountApplyiedForPinCodeSecondChoice', 'ApplyiedForPinCodeThirdChoice', 'CountApplyiedForPinCodeThirdChoice'];

// ---------------------------------------------------------------- ActionResult Index(int? Page, string fromDate, string toDate, string SearchField, string SearchValue)
// auth (legacy had no session check; admin data => adminAuth)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  let Page = B.nInt(req.p.Page);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  const ViewBag = {};
  try {
    const MaxRows = await UtilityClass.GridPageSize();
    if (Page === null) Page = 1;
    // [Usp_FranchiseProcessingAndList] @Mode,@FromDate,@ToDate,@SearchType,@SearchValue,@StartRowIndex,@MaxRows,@TotalCount Out
    const rows = await db.proc(DB, 'Usp_FranchiseProcessingAndList', {
      Mode: 2, FromDate: fromDate, ToDate: toDate, SearchType: SearchField, SearchValue, StartRowIndex: Page, MaxRows,
    });
    const LiFranchise_Pincode_Request = mapRows(rows, FPR_PROPS);
    const TotalRecord = totalOut(rows, 'TotalCount');
    ViewBag.CurrentPage = Page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.toDate = toDate;
    ViewBag.fromDate = fromDate;
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    return res.json({ view: '~/Views/AdminPanel/Franchise_Pincode/Index.cshtml', Model: LiFranchise_Pincode_Request, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'Usp_FranchiseProcessingAndList');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml', ...ViewBag, ErrorMessage: ExpObj.message });
  }
}));

module.exports = router;
