'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Member_ROIController.cs (class Member_ROIController => /Member_ROI/...)
// Database: affiliate (Db_Affiliate). Proc: Usp_MEMBER_PERFORMANCEROI.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const { DB, nInt, s0, outOf, cvtIntStrict } = require('./_shared/batch09_common');

const router = express.Router();
const C = 'Member_ROI';

/** class Member_ROI_Report */
const PROPS = ['ROWNUMBER', 'FNAME', 'USERNAME', 'MOBILE', 'REGDATE', 'TotalDeposited', 'RECEIVEDROI', 'RECEIVEABLEROI', 'LoginStatus'];

// ---------------------------------------------------------------- Index(int? Page, string fromDate, string toDate, string SearchField, string SearchValue)
// auth (PORT-NOTE: legacy had no session check on this all-member admin report - protected)
// route-config: "AdminPanel/member-roi-report" -> Member_ROI/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/member-roi-report'], adminAuth, asyncHandler(async (req, res) => {
  const fromDate = s0(req.p.fromDate);
  const toDate = s0(req.p.toDate);
  const SearchField = s0(req.p.SearchField);
  const SearchValue = s0(req.p.SearchValue);
  let Page = nInt(req.p.Page);
  const ViewBag = {};
  try {
    const MaxRows = await UtilityClass.GridPageSize();
    if (Page === null) Page = 1;
    // [Usp_MEMBER_PERFORMANCEROI] @Mode,@FromDate,@ToDate,@SearchType,@SearchValue,@StartRowIndex,@MaxRows,@TotalCount Out
    const rows = await db.proc(DB, 'Usp_MEMBER_PERFORMANCEROI', {
      Mode: '1', FromDate: fromDate, ToDate: toDate, SearchType: SearchField, SearchValue, StartRowIndex: Page, MaxRows,
    });
    const list = mapRows(rows, PROPS);
    const tc = outOf(rows, 'totalcount');
    const TotalRecord = cvtIntStrict(tc === '' && rows.length === 0 ? '0' : tc); // PORT-NOTE: no row => OUT value unavailable => 0
    Object.assign(ViewBag, {
      CurrentPage: Page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), toDate, fromDate, SearchField, SearchValue,
    });
    return res.json({ view: '~/Views/AdminPanel/Member_ROI/Index.cshtml', Model: list, ...ViewBag });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_MEMBER_PERFORMANCEROI');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml', ...ViewBag });
  }
}));

module.exports = router;
