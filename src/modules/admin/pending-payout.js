'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Pending_Payout.cs (class Pending_PayoutController, no namespace
// => /admin/Pending_Payout/...). Database: affiliate (Db_Affiliate). Procs USP_EXCEL_LINK, USP_GETEXCELPERMISIONSTATUS,
// USP_BANKWITHDRAWLREQUESTREPORT_pendingpayout, Get_AdminATCDetails (+ ATCAPI.GetATCWalletBalance), USP_EXCEL_DOWNLOAD_HISTORY,
// USP_BANKWITHDRAWLREQUESTREPORT.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  nInt, nStr, cellStr, tab, dec2, nowStamp, excelHistory, writeXlsExport, inlinePerms, outIntOf,
} = require('./_shared/batch11-common');
const { PAYOUT_REPORT_PROPS, toDecimalOut, atcBlock, tabN } = require('./_shared/batch11-b-common');
const { dynPaging } = require('./_shared/batch06-common');
const { excelLinkBlank } = require('./_shared/batch13-01-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Pending_Payout';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, string ByStatus, int? page, string OrderBy,
 *  string Userdownlinemember)  (its call in Index is commented out in the legacy code) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, ByStatus, page, OrderBy, Userdownlinemember) {
  const userid = req.user.emp_id;
  const Filename = 'PayoutReport_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  let loginid = ''; let phone = ''; let accountno = ''; let ifsccode = '';
  let accountholdername = ''; let bankname = '';
  let branchname = ''; let username = '';
  const MaxRows = await UtilityClass.GridPageSize(); // eslint-disable-line no-unused-vars
  if (SearchField === null || SearchValue === null) {
    SearchField = '';
    SearchValue = '';
  } else if (SearchField === 'emailid') {
    loginid = SearchValue.trim();
  } else if (SearchField === 'mobile') {
    phone = SearchValue.trim();
  } else if (SearchField === 'accnum') {
    accountno = SearchValue.trim();
  } else if (SearchField === 'ifsc') {
    ifsccode = SearchValue.trim();
  } else if (SearchField === 'accholname') {
    accountholdername = SearchValue.trim();
  } else if (SearchField === 'bankname') {
    bankname = SearchValue.trim();
  } else if (SearchField === 'branchname') {
    branchname = SearchValue.trim();
  } else if (SearchField === 'username') {
    username = SearchValue.trim();
  }
  if (OrderBy === null) OrderBy = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ByStatus === null) ByStatus = '';
  if (page === null) page = 1;
  // [USP_BANKWITHDRAWLREQUESTREPORT] @WithDrawalFromDate,@WithDrawalToDate,@LoginId,@Phone,@AccountNo,@IFSCCODE,@AccountHolderName,@BANKNAME,
  //   @BRANCHNAME,@STARTROWINDEX,@MAXROWS,@Mode,@Username,@TOTALWITHDRAWALPOINTS OUT,@TOTALPAYABLEAMOUNT OUT,@STATUS,@RECORDCOUNT OUT,
  //   @SUMWITHDRAWALAMT OUT,@Userdownlinemember
  const Obj = mapRows(await db.proc(DB, 'USP_BANKWITHDRAWLREQUESTREPORT', {
    WithDrawalFromDate: fromDate, WithDrawalToDate: toDate, LoginId: loginid, Phone: phone, AccountNo: accountno, IFSCCODE: ifsccode,
    AccountHolderName: accountholdername, BANKNAME: bankname, BRANCHNAME: branchname, STARTROWINDEX: page, MAXROWS: '100000', Mode: '1',
    Username: username, STATUS: ByStatus.trim(), Userdownlinemember,
  }), PAYOUT_REPORT_PROPS);
  if (Obj.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'BankWithdrawalRequestReport.xls', Filename, rows: Obj, downloadName: ' PayoutReport.xls',
      rawHeaders: 'S.No. \tDate \tUsername \tName \tA/c Holder Name. \tBank Name \tAccount No. \tIFSC \tBranch \tTDS \tAmount \tPayableAmount  \t'
        + 'Status \tActivity By \t',
      innerProc: 'ExportReport', outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'RowNumber')) + ' \t');
        w(tab(cellStr(item, 'Date')) + ' \t');
        w(tab(cellStr(item, 'UserName')) + ' \t');
        w(tab(cellStr(item, 'FullName')) + ' \t');
        w(tab(cellStr(item, 'AccountHolderName')) + ' \t');
        w(tab(cellStr(item, 'BankName')) + ' \t');
        w(tab("'" + cellStr(item, 'AccountNo')) + ' \t');
        w(tab(cellStr(item, 'IFSCCODE')) + ' \t');
        w(tab(cellStr(item, 'BranchName')) + ' \t');
        w(tab(dec2(item.TDS)) + ' \t');
        w(tab(cellStr(item, 'WITHDRAWAMOUNT')) + ' \t');
        w(tab(dec2(item.PayableAmount)) + ' \t');
        w(tab(cellStr(item, 'Status')) + ' \t');
        w(tabN(cellStr(item, 'ActivityByUserId'), 3) + ' \t'); // legacy replaced "\t" with 3 spaces here
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue,
//   string fromDate, string toDate, string ByStatus, int? page, string OrderBy, string releasepayout, string btnexel, string Userdownlinemember,
//   int? Side, string btnexelreadonly)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Pending-Payout" -> Pending_Payout/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Pending-Payout'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let ByStatus = nStr(req.p.ByStatus);
  let page = nInt(req.p.page);
  let OrderBy = nStr(req.p.OrderBy);
  let btnexel = nStr(req.p.btnexel);
  let Userdownlinemember = nStr(req.p.Userdownlinemember);
  let Side = nInt(req.p.Side);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let loginid = ''; let phone = ''; let accountno = ''; let ifsccode = '';
  let accountholdername = ''; let bankname = '';
  let branchname = ''; let username = '';
  if (btnexel === null) btnexel = ''; // eslint-disable-line no-unused-vars
  const ViewBag = {};
  ViewBag.excelactive = await excelLinkBlank(url);
  ViewBag.excelactive = await excelLinkBlank(url); // (legacy ran the same USP_EXCEL_LINK block twice)
  if (dynamicpagging === null) dynamicpagging = dynPaging();
  if (orderbydate === null) orderbydate = '';
  const Employeeid = req.user.emp_id;
  const p = await inlinePerms(Employeeid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;

  const MaxRows = Number(dynamicpagging);
  if (SearchField === null || SearchValue === null) {
    SearchField = '';
    SearchValue = '';
  } else if (SearchField === 'emailid') {
    loginid = SearchValue.trim();
  } else if (SearchField === 'mobile') {
    phone = SearchValue.trim();
  } else if (SearchField === 'AccountNo') {
    accountno = SearchValue.trim();
  } else if (SearchField === 'IFSCCODE') {
    ifsccode = SearchValue.trim();
  } else if (SearchField === 'accholname') {
    accountholdername = SearchValue.trim();
  } else if (SearchField === 'BankName') {
    bankname = SearchValue.trim();
  } else if (SearchField === 'branchname') {
    branchname = SearchValue.trim();
  } else if (SearchField === 'username') {
    username = SearchValue.trim();
  } else if (SearchField === 'AccountHolderName') {
    accountholdername = SearchValue.trim();
  }
  if (Userdownlinemember === null) Userdownlinemember = '';
  if (OrderBy === null) OrderBy = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ByStatus === null) ByStatus = '';
  if (page === null) page = 1;
  if (Side === null) Side = 0;
  // [USP_BANKWITHDRAWLREQUESTREPORT_pendingpayout] @WithDrawalFromDate,@WithDrawalToDate,@LoginId,@Phone,@AccountNo,@IFSCCODE,@AccountHolderName,
  //   @BANKNAME,@BRANCHNAME,@STARTROWINDEX,@MAXROWS,@Mode,@Username,@TOTALWITHDRAWALPOINTS OUT,@TOTALPAYABLEAMOUNT OUT,@STATUS,@RECORDCOUNT OUT,
  //   @SUMWITHDRAWALAMT OUT,@Userdownlinemember,@SIDE,@totalTDS,@TotalAdminC,@SUMWITHDRAWLPOINTS1,@TotalAmt,@orderbydate
  const rows = await db.proc(DB, 'USP_BANKWITHDRAWLREQUESTREPORT_pendingpayout', {
    WithDrawalFromDate: fromDate, WithDrawalToDate: toDate, LoginId: loginid, Phone: phone, AccountNo: accountno, IFSCCODE: ifsccode,
    AccountHolderName: accountholdername, BANKNAME: bankname, BRANCHNAME: branchname, STARTROWINDEX: page, MAXROWS: MaxRows, Mode: '1',
    Username: username, STATUS: ByStatus.trim(), Userdownlinemember, SIDE: Side, totalTDS: '0', TotalAdminC: '0', SUMWITHDRAWLPOINTS1: '0',
    TotalAmt: '0', orderbydate,
  });
  const Obj = mapRows(rows, PAYOUT_REPORT_PROPS);
  const TotalRecord = outIntOf(rows, 'RECORDCOUNT'); // int.Parse(v == "" ? "0" : v)
  ViewBag.orderbydate = orderbydate;
  ViewBag.dynamicpagging = dynamicpagging;
  let SumofWithdrawal = 0;
  SumofWithdrawal = toDecimalOut(rows, 'SUMWITHDRAWALAMT'); // Convert.ToDecimal(OUT.Value)
  ViewBag.totalWithdrawal = SumofWithdrawal;
  ViewBag.CurrentPage = page;
  ViewBag.Userdownlinemember = Userdownlinemember;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.SearchValue = SearchValue;
  ViewBag.ByStatus = ByStatus;
  ViewBag.OrderBy = OrderBy;
  // [Get_AdminATCDetails] + ATCAPI.GetATCWalletBalance (inner catch "ItemForPayoutRelease", outer catch "USP_BANKWITHDRAWLREQUESTREPORT")
  await atcBlock(req, ViewBag, 'ItemForPayoutRelease', 'USP_BANKWITHDRAWLREQUESTREPORT');
  return res.json({ view: '~/Views/AdminPanel/Pending_Payout/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate,
//   string ByStatus, int? page, string OrderBy, string Userdownlinemember)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.fromDate), nStr(req.p.toDate),
    nStr(req.p.ByStatus), nInt(req.p.page), nStr(req.p.OrderBy), nStr(req.p.Userdownlinemember));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
