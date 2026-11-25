'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\NewPerformanceBonus - Copy.cs (class NewPerformanceBonusCopyController => /NewPerformanceBonusCopy/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, issueAdminToken, errorInsert } = require('./_shared/adminSession');
const { DB, nInt, nStr, s0, reqInt, inlinePerms, nullRef } = require('./_shared/batch10_common');

const router = express.Router();
const C = 'NewPerformanceBonusCopy';

/** class PerformanceIncomeBonusDetails (declared in NewPerformanceBonus.cs) */
const PROPS = ['ROWNUMBER', 'USERNAME', 'ADMIN', 'RANKNAME', 'TOTALPAYBLE', 'TDS', 'QUALIFICATION', 'REQUIRED', 'CUMMULATIVEBV', 'ACCUMULATIVEPV',
  'NewPPV', 'PAYID', 'RECPER', 'selfComm', 'fromComm', 'PVRATE', 'ISSELF'];

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests.
let url = '';
let url1 = '';

// ---------------------------------------------------------------- Index(int? dynamicpagging, int? PayId, string orderbydate, int? Page, string FromDate,
//   string ToDate, string SearchField, string SearchValue, string btnexel, string Click, int? Month)
// auth (reads Session["Admin_User"]; legacy without session hit NullReferenceException => catch => view with ErrorMessage)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const FromDate = s0(req.p.FromDate);
  const ToDate = s0(req.p.ToDate);
  const SearchField = s0(req.p.SearchField);
  const SearchValue = s0(req.p.SearchValue);
  let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
  const orderbydate = s0(req.p.orderbydate);
  let PayId = nInt(req.p.PayId);
  let Page = nInt(req.p.Page);
  const ViewBag = {};
  const out = {};
  // USP_EXCEL_LINK @url,@ISACTIVE out is executed, but the result is ignored (isactive = 0)
  await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  ViewBag.excelactive = 0;
  try {
    const Empid = req.user.emp_id;
    const emp = await new UtilityClass().UpdateAdminUserSession(Empid);
    if (!emp) throw nullRef();
    out.token = issueAdminToken(emp);
    const Employeeid = emp.Emp_ID;
    const ip = await inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
    ViewBag.isactive = ip.isactive;
    ViewBag.isedit = ip.isedit;
    const MaxRows = dynamicpagging;
    if (Page === null) Page = 1;
    let PerformanceBonus = [];
    if (PayId === null) {
      PayId = 0;
      // DBO.PerformanceBonusIncomeReport @Username   (an extra unused @PayId SqlParameter was attached; not referenced by the command text)
      PerformanceBonus = mapRows(await db.proc(DB, 'PerformanceBonusIncomeReport', { Username: SearchField }), PROPS);
      Object.assign(ViewBag, {
        CurrentPage: Page, GridPageSize: MaxRows, TotalRecord: 100, dynamicpagging, orderbydate, NoPerPage: await UtilityClass.GridNumbersPerPage(),
        SearchField, SearchValue, fromDate: FromDate, toDate: ToDate,
      });
    }
    return res.json({ view: '~/Views/AdminPanel/NewPerformanceBonus/Index.cshtml', Model: PerformanceBonus, ...ViewBag, ...out });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_FranchisePending');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/AdminPanel/NewPerformanceBonus/Index.cshtml', Model: null, ...ViewBag, ...out });
  }
}));

// ---------------------------------------------------------------- JsonResult getdetails(string USERNAME, int PAYID)
// auth (PORT-NOTE: legacy had no session check; admin member-income data => adminAuth)
router.all(`/admin/${C}/getdetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const USERNAME = nStr(req.p.USERNAME);
  const PAYID = reqInt(req.p.PAYID, 'PAYID');
  // SeprateIncomeDetails @Username,@payid
  const purchasepackdetails = mapRows(await db.proc(DB, 'SeprateIncomeDetails', { Username: USERNAME, payid: PAYID }), PROPS);
  if (purchasepackdetails && purchasepackdetails.length > 0) return res.json(purchasepackdetails);
  return res.json('error');
}));

module.exports = router;
