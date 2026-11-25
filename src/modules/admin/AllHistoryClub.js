'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\AllHistoryClub.cs (class AllHistoryClubController => /AllHistoryClub/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const CheckPermissions = require('../../lib/admin/CheckPermissions');
const { adminAuth, legacyUrl, errorInsert, issueAdminToken } = require('./_shared/adminSession');
const { DB, col, str, sv, nint, toInt32 } = require('./_shared/batch03_common');

const router = express.Router();
const C = 'AllHistoryClub';

/** class Pending_Withdrawals (Controllers/AdminPanel/Pending_Withdrawals.cs) */
const PENDING_WITHDRAWALS_PROPS = ['RowNumber', 'Date', 'UserName', 'Grossamount', 'ADMINCHARGE', 'TDS', 'NetAmount', 'AccountNo',
  'AccountHolderName', 'BankName', 'BranchName', 'IFSCCODE', 'Status', 'Name'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (kept as module state).
let url = '';
let url1 = '';

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromDate, string toDate, string ByStatus, int? page, string OrderBy, string releasepayout, string btnexel, string Userdownlinemember, int? Side)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/AllHistory-Club" -> AllHistoryClub/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/AllHistory-Club'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  const orderbydate = sv(req.p.orderbydate);
  let SearchField = sv(req.p.SearchField);
  let SearchValue = sv(req.p.SearchValue);
  let fromDate = sv(req.p.fromDate);
  let toDate = sv(req.p.toDate);
  let ByStatus = sv(req.p.ByStatus);
  let page = nint(req.p.page);
  let OrderBy = sv(req.p.OrderBy);
  let Userdownlinemember = sv(req.p.Userdownlinemember);
  let Side = nint(req.p.Side);
  const ViewBag = {};
  const out = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let loginid = ''; let phone = ''; let accountno = ''; let ifsccode = '';
  let accountholdername = ''; let bankname = ''; let branchname = ''; let username = '';
  if (SearchField === null || SearchValue === null) {
    SearchField = '';
    SearchValue = '';
  } else if (SearchField === 'emailid') loginid = SearchValue.trim();
  else if (SearchField === 'mobile') phone = SearchValue.trim();
  else if (SearchField === 'accnum') accountno = SearchValue.trim();
  else if (SearchField === 'ifsc') ifsccode = SearchValue.trim();
  else if (SearchField === 'accholname') accountholdername = SearchValue.trim();
  else if (SearchField === 'bankname') bankname = SearchValue.trim();
  else if (SearchField === 'branchname') branchname = SearchValue.trim();
  else if (SearchField === 'username') username = SearchValue.trim();
  if (Userdownlinemember === null) Userdownlinemember = '';
  if (OrderBy === null) OrderBy = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ByStatus === null) ByStatus = '';
  if (page === null) page = 1;
  if (Side === null) Side = 0;
  const Empid = req.user.emp_id;
  const perm = await CheckPermissions.GetPageActionPermission(url, Empid);
  ViewBag.isactive = perm._opIsDownloadAllowed;
  ViewBag.isedit = perm._opIsEditAllowed;
  ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging;
    dynamicpagging = toInt32(value); // Convert.ToInt16(value)
  }
  const MaxRows = Number(dynamicpagging);
  let obj1 = [];
  try {
    let TotalRecord = 0;
    // Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid);
    const emp = await new UtilityClass().UpdateAdminUserSession(Empid);
    if (emp) out.token = issueAdminToken(emp);
    const rows = await db.proc(DB, 'USP_PendingBankWithdrawal', {
      WithDrawalFromDate: fromDate, WithDrawalToDate: toDate, LoginId: loginid, Phone: phone, AccountNo: accountno, IFSCCODE: ifsccode,
      AccountHolderName: accountholdername, BANKNAME: bankname, BRANCHNAME: branchname, STARTROWINDEX: page, MAXROWS: MaxRows, Mode: '1',
      Username: username, STATUS: ByStatus.trim(), Userdownlinemember, SIDE: Side,
    });
    obj1 = mapRows(rows, PENDING_WITHDRAWALS_PROPS);
    const rc = str(col(rows[0], 'recordcount'));
    TotalRecord = parseInt(rc === '' ? '0' : rc, 10);
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
    return res.json({ view: '~/Views/AdminPanel/AllHistoryClub/Index.cshtml', Model: obj1, ...ViewBag, ...out });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Bank-Withdrawal-Pending-ByAPI');
    ViewBag.APIerror = 0;
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/AdminPanel/AllHistoryClub/Index.cshtml', Model: obj1, ...ViewBag, ...out });
  }
}));

module.exports = router;
