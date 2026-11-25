'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Hold_Payout.cs (class Hold_PayoutController => /admin/Hold_Payout/...)
// Database: affiliate (Db_Affiliate).
// The file also declares `public class AllHistoryClub` (plain model, not ported as a class; no consumer here).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert, issueAdminToken } = require('./_shared/admin-session');
const B = require('./_shared/batch08-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Hold_Payout';

/** class PayoutReport (PayoutReportController.cs) */
const PAYOUTREPORT_PROPS = ['RowNumber', 'Date', 'EmailId', 'FULLEmailId', 'UserName', 'FullName', 'PHONE', 'WITHDRAWAMOUNT', 'PayableAmount',
  'AccountNo', 'AccountHolderName', 'BankName', 'BranchName', 'IFSCCODE', 'WDID', 'Status', 'TransactionId', 'ADMIN_REMARK', 'ATC_WalletAddress',
  'ATCUserId', 'ActivityByUserId', 'TDS', 'ADMINCHARGE', 'transactionid', 'Processing_Fee', 'INCOMETYPENAME', 'Repurchase'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (kept as module state).
let url = '';
let url1 = '';

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromDate, string toDate, string ByStatus, int? page, string OrderBy, string releasepayout, string btnexel, string Userdownlinemember, int? Side)
// auth ([SessionExpireCheck], reads Session["Admin_User"])
// route-config: "AdminPanel/Hold-Payout" -> Hold_Payout/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Hold-Payout'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  const orderbydate = B.nStr(req.p.orderbydate);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let ByStatus = B.nStr(req.p.ByStatus);
  let page = B.nInt(req.p.page);
  let OrderBy = B.nStr(req.p.OrderBy);
  let Userdownlinemember = B.nStr(req.p.Userdownlinemember);
  let Side = B.nInt(req.p.Side);
  // releasepayout, btnexel: bound but unused by the legacy body
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
  const perm = await B.perms(Empid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = perm.excelactive;
  if (dynamicpagging === null) {
    dynamicpagging = B.cvtInt(config.app.DynamicPagging); // Convert.ToInt16(value)
  }
  const MaxRows = Number(dynamicpagging);
  let obj1 = [];
  try {
    let TotalRecord = 0;
    // Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid);
    const emp = await new UtilityClass().UpdateAdminUserSession(Empid);
    if (emp) out.token = issueAdminToken(emp);
    // [USP_PendingBankWithdrawal_HOLD] ...,@TOTALWITHDRAWALPOINTS OUT,@TOTALPAYABLEAMOUNT OUT,@STATUS,@RECORDCOUNT OUT,@SUMWITHDRAWALAMT OUT,...
    const rows = await db.proc(DB, 'USP_PendingBankWithdrawal_HOLD', {
      WithDrawalFromDate: fromDate, WithDrawalToDate: toDate, LoginId: loginid, Phone: phone, AccountNo: accountno, IFSCCODE: ifsccode,
      AccountHolderName: accountholdername, BANKNAME: bankname, BRANCHNAME: branchname, STARTROWINDEX: page, MAXROWS: MaxRows, Mode: '1',
      Username: username, STATUS: ByStatus.trim(), Userdownlinemember, SIDE: Side,
    });
    obj1 = mapRows(rows, PAYOUTREPORT_PROPS);
    const rc = B.str(B.col(rows[0], 'RECORDCOUNT'));
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
    return res.json({ view: '~/Views/AdminPanel/Hold_Payout/Index.cshtml', Model: obj1, ...ViewBag, ...out });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Bank-Withdrawal-Pending-ByAPI');
    ViewBag.ErrorMessage = ExpObj.message;
    ViewBag.APIerror = 0;
    return res.json({ view: '~/Views/AdminPanel/Hold_Payout/Index.cshtml', Model: obj1, ...ViewBag, ...out });
  }
}));

module.exports = router;
