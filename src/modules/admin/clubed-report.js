'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Clubed_Report.cs (class Clubed_ReportController => /Clubed_Report/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert, issueAdminToken } = require('./_shared/admin-session');
const B = require('./_shared/batch04-b-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Clubed_Report';

/** class Clubed_Report */
const PROPS = ['RowNumber', 'CHID', 'Accountholdername', 'Ifsc', 'AccountNumber', 'Amount', 'Status', 'ProcessDate', 'ProcessBy',
  'ProcessIPAddress', 'GroupName'];
// class saerchparamClubed_Report: unused property bag (not ported).

// PORT-NOTE: `private static string url, url1` kept as module variables (assigned, never read).
let url = '';
let url1 = '';

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromDate, string toDate, string ByStatus, int? page, string OrderBy, string releasepayout, string btnexel, string Userdownlinemember, int? Side)
// auth (reads Session["Admin_User"]; legacy without a session => NullReference caught => view with APIerror = 0)
// route-config: "AdminPanel/Clubed-Report" -> Clubed_Report/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Clubed-Report'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.ip(req, 'dynamicpagging');
  const orderbydate = B.sp(req, 'orderbydate');
  let SearchField = B.sp(req, 'SearchField');
  let SearchValue = B.sp(req, 'SearchValue');
  let fromDate = B.sp(req, 'fromDate');
  let toDate = B.sp(req, 'toDate');
  let ByStatus = B.sp(req, 'ByStatus');
  let page = B.ip(req, 'page');
  let OrderBy = B.sp(req, 'OrderBy');
  let Userdownlinemember = B.sp(req, 'Userdownlinemember');
  let Side = B.ip(req, 'Side');
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  // legacy computed loginid/phone/accountno/... from SearchField/SearchValue (unused locals)
  if (SearchField === null || SearchValue === null) {
    SearchField = '';
    SearchValue = '';
  }
  if (Userdownlinemember === null) Userdownlinemember = '';
  if (OrderBy === null) OrderBy = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ByStatus === null) ByStatus = '';
  if (page === null) page = 1;
  if (Side === null) Side = 0;
  if (dynamicpagging === null) dynamicpagging = config.app.DynamicPagging == null ? 0 : B.toInt32(config.app.DynamicPagging); // Convert.ToInt16
  let MaxRows = dynamicpagging;
  let obj1 = [];
  const ViewBag = {};
  let token;
  try {
    const Empid = req.user.emp_id;
    // Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid);
    const emp = await new UtilityClass().UpdateAdminUserSession(Empid);
    if (!emp) throw B.NRE(); // EM.Emp_ID on null
    token = issueAdminToken(emp); // refreshed session => refreshed token
    MaxRows = 100;
    const rows = await db.proc(DB, 'usp_execldownlaodclubdata_list', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FromDate: fromDate, ToDate: toDate, status: ByStatus, SearchField, SearchValue,
    });
    obj1 = mapRows(rows, PROPS);
    const rc = B.str(B.outVal(rows, 'Totalrecord'));
    const TotalRecord = B.toInt32(rc === '' ? '0' : rc);
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.CurrentPage = page;
    ViewBag.Userdownlinemember = Userdownlinemember;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.SearchField = SearchField;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.SearchValue = SearchValue;
    ViewBag.ByStatus = ByStatus;
    ViewBag.OrderBy = OrderBy;
    ViewBag.APIerror = 1;
    return res.json({ view: '~/Views/AdminPanel/Clubed_Report/Index.cshtml', Model: obj1, ...ViewBag, token });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Bank-Withdrawal-Pending-ByAPI');
    ViewBag.ErrorMessage = ExpObj.message;
    ViewBag.APIerror = 0;
    return res.json({ view: '~/Views/AdminPanel/Clubed_Report/Index.cshtml', Model: obj1, ...ViewBag, token });
  }
}));

module.exports = router;
