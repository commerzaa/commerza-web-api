'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\NewPerformanceBonus.cs (class NewPerformanceBonusController => /NewPerformanceBonus/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, issueAdminToken, errorInsert } = require('./_shared/adminSession');
const { DB, nInt, nStr, s0, reqInt, perms, nullRef } = require('./_shared/batch10_common');

const router = express.Router();
const C = 'NewPerformanceBonus';

/** class PerformanceIncomeBonusDetails */
const PROPS = ['ROWNUMBER', 'USERNAME', 'ADMIN', 'RANKNAME', 'TOTALPAYBLE', 'TDS', 'QUALIFICATION', 'REQUIRED', 'CUMMULATIVEBV', 'ACCUMULATIVEPV',
  'NewPPV', 'PAYID', 'RECPER', 'selfComm', 'fromComm', 'PVRATE', 'ISSELF'];

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests.
let url = '';
let url1 = '';

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, int? PayId, string orderbydate, int? Page,
//   string FromDate, string ToDate, string SearchField, string SearchValue, string btnexel, string Click, int? Month)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/BonusIncome" -> NewPerformanceBonus/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/BonusIncome'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const FromDate = s0(req.p.FromDate);
  const ToDate = s0(req.p.ToDate);
  const SearchField = s0(req.p.SearchField);
  const SearchValue = s0(req.p.SearchValue);
  // Click / Month / btnexel are defaulted ("" / 0 / "") but never used afterwards
  let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
  const orderbydate = s0(req.p.orderbydate);
  let PayId = nInt(req.p.PayId);
  let Page = nInt(req.p.Page);
  const ViewBag = {};
  const out = {};
  try {
    const Empid = req.user.emp_id;
    // Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid);
    const emp = await new UtilityClass().UpdateAdminUserSession(Empid);
    if (!emp) throw nullRef(); // EM.Emp_ID on a null session object
    out.token = issueAdminToken(emp); // refreshed session (token)
    Object.assign(ViewBag, await perms(Empid, url)); // CheckPermissions.GetPageActionPermission / GetExcelPermission
    const MaxRows = dynamicpagging;
    if (Page === null) Page = 1;
    let PerformanceBonus = [];
    if (PayId === null) {
      PayId = 0;
      // DBO.PerformanceBonusIncomeReport @Username,@PayId
      PerformanceBonus = mapRows(await db.proc(DB, 'PerformanceBonusIncomeReport', { Username: SearchField, PayId }), PROPS);
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
  // SeprateIncomeDetails @Username,@payid,@TotalPayable out  (ViewBag.TotalPayable = the SqlParameter: not part of the JSON)
  const purchasepackdetails = mapRows(await db.proc(DB, 'SeprateIncomeDetails', { Username: USERNAME, payid: PAYID }), PROPS);
  if (purchasepackdetails && purchasepackdetails.length > 0) return res.json(purchasepackdetails);
  return res.json('error');
}));

module.exports = router;
