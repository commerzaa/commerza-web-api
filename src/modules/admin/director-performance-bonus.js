'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\DirectorPerformanceBonus.cs (class DirectorPerformanceBonusController, no namespace => /DirectorPerformanceBonus/...)
// Database: affiliate (Db_Affiliate). Procs DirectorPerformanceBonus, SeprateDirectorIncomeDetails.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert, issueAdminToken } = require('./_shared/admin-session');
const { nInt, nStr, reqInt, perms } = require('./_shared/batch06-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'DirectorPerformanceBonus';

/** public class DirectorPerformanceBonusDetails */
const DPB_DETAILS_PROPS = ['ROWNUMBER', 'USERNAME', 'ADMIN', 'RANKNAME', 'TOTALPAYBLE', 'TDS', 'CUMMULATIVEBV', 'ACCUMULATIVEPV', 'PAYID'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, Int32? PayId, string orderbydate, int? Page, string FromDate,
//   string ToDate, string SearchField, string SearchValue, string btnexel, string Click, int? Month)
// auth (PORT-NOTE: legacy dereferenced Session["Admin_User"] inside its try => adminAuth)
// route-config: "AdminPanel/NewDirector-Bonus" -> DirectorPerformanceBonus/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/NewDirector-Bonus'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let PayId = nInt(req.p.PayId);
  let orderbydate = nStr(req.p.orderbydate);
  let Page = nInt(req.p.Page);
  let FromDate = nStr(req.p.FromDate);
  let ToDate = nStr(req.p.ToDate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let btnexel = nStr(req.p.btnexel); // eslint-disable-line no-unused-vars
  let Click = nStr(req.p.Click); // eslint-disable-line no-unused-vars
  let Month = nInt(req.p.Month); // eslint-disable-line no-unused-vars
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (FromDate === null) FromDate = '';
  if (ToDate === null) ToDate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (Click === null) Click = '';
  if (Month === null) Month = 0;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (btnexel === null) btnexel = '';
  const ViewBag = {};
  try {
    const Empid = req.user.emp_id;
    const emp = await new UtilityClass().UpdateAdminUserSession(Empid); // Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid)
    const token = emp ? issueAdminToken(emp) : undefined;
    const p = await perms(Empid, url);
    ViewBag.isactive = p.isactive;
    ViewBag.isedit = p.isedit;
    ViewBag.excelactive = p.excelactive;
    const MaxRows = Number(dynamicpagging);
    if (Page === null) Page = 1;
    let PerformanceBonus = [];
    if (PayId === null) {
      PayId = 0;
      // DBO.DirectorPerformanceBonus @Username,@PayId
      PerformanceBonus = mapRows(await db.proc(DB, 'DirectorPerformanceBonus', { Username: SearchField, PayId }), DPB_DETAILS_PROPS);
      ViewBag.CurrentPage = Page;
      ViewBag.TotalRecord = 100;
      ViewBag.dynamicpagging = MaxRows;
      ViewBag.orderbydate = orderbydate;
      ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
      ViewBag.SearchField = SearchField;
      ViewBag.SearchValue = SearchValue;
      ViewBag.fromDate = FromDate;
      ViewBag.toDate = ToDate;
    }
    const out = { view: '~/Views/AdminPanel/DirectorPerformanceBonus/Index.cshtml', Model: PerformanceBonus, ...ViewBag };
    if (token) out.token = token; // refreshed Session["Admin_User"]
    return res.json(out);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_FranchisePending');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/AdminPanel/DirectorPerformanceBonus/Index.cshtml', ...ViewBag });
  }
}));

// ---------------------------------------------------------------- JsonResult getdetails(string USERNAME, int PAYID)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/getdetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const USERNAME = nStr(req.p.USERNAME);
  const PAYID = reqInt(req.p.PAYID, 'PAYID');
  // SeprateDirectorIncomeDetails @LOGINID,@PAYID
  const purchasepackdetails = mapRows(await db.proc(DB, 'SeprateDirectorIncomeDetails', { LOGINID: USERNAME, PAYID }), DPB_DETAILS_PROPS);
  if (purchasepackdetails !== null && purchasepackdetails.length > 0) {
    return res.json(purchasepackdetails);
  }
  return res.json('error');
}));

module.exports = router;
