'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\TransactionHistory.cs (class TransactionHistoryController => /admin/TransactionHistory/...)
// Database: affiliate (Db_Affiliate).
const path = require('path');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');
const { supplied, outIntStrict, tsvFile, errorViewMsg, XLS_DIR } = require('./_shared/batch13-09-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'TransactionHistory';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** class TransactionHistory */
const PROPS = ['RowNumber', 'type', 'Cr_amount', 'Dr_amount', 'Date', 'Remark', 'Username', 'Balance', 'DRAMOUNT'];

/** public void ExportReport(string FromDate, string ToDate, string SearchField) */
async function ExportReport(req, res, ViewBag, FromDate, ToDate, SearchField) {
  // var Obj = new List<EmployeeDetails>(); (unused)
  const userid = req.user.emp_id;
  const Filename = 'Transaction_History_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); // unused (call passes 9999999)
  void MaxRows;
  // [Usp_TransactionHistory_F] without @orderbydate
  const WalletCreditHistory = mapRows(await db.proc(DB, 'Usp_TransactionHistory_F', supplied({
    fromDate: FromDate, toDate: ToDate, SearchField, MAXROWS: 9999999, STARTROWINDEX: 1,
  })), PROPS);
  return tsvFile({
    req, res, ViewBag, filepath: path.join(XLS_DIR(), 'Transaction_History.xls'),
    header: 'S.No. \tUsername \tProcessDate \tType \tAmount \tBalance \tParticulars \t',
    rows: WalletCreditHistory,
    innerProc: 'getblockedMemberList',
    outerProc: 'usp_Blocked_memberList',
    copyFilename: Filename,
    download: 'Transaction_History.xls',
    cells: (item, w) => {
      w('\n');
      w(B.tab(B.cellStr(item, 'RowNumber')) + ' \t');
      const Username = B.cellStr(item, 'Username');
      const User_name = Username.replace(/ /g, '');
      w(B.tab(User_name) + ' \t');
      w(B.tab(B.netFormat(item.Date, 'dd-MM-yyyy')) + ' \t');
      w(B.tab(B.cellStr(item, 'type')) + ' \t');
      w(B.tab(B.dec2(item.type === 'DR' ? item.Dr_amount : item.Cr_amount)) + ' \t');
      w(B.tab(B.dec2(item.Balance)) + ' \t');
      const Remark = B.cellStr(item, 'Remark');
      const Remarks = Remark.replace(/ /g, '-');
      w(B.tab(Remarks) + ' \t');
    },
  });
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate, string ToDate, string SearchField, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/TransactionHistory" -> TransactionHistory/Index
// Config: DynamicPagging
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/TransactionHistory'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let Page = B.nInt(req.p.Page);
  let FromDate = B.nStr(req.p.FromDate);
  let ToDate = B.nStr(req.p.ToDate);
  let SearchField = B.nStr(req.p.SearchField);
  let btnexel = B.nStr(req.p.btnexel);

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  const p = await B.inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging;
    dynamicpagging = B.cvtInt(value === undefined ? null : value); // Convert.ToInt16(value)
  }
  if (orderbydate === null) orderbydate = '';
  ViewBag.excelactive = await B.excelLink(url); // USP_EXCEL_LINK
  if (FromDate === null) FromDate = '';
  if (ToDate === null) ToDate = '';
  if (btnexel === null) btnexel = '';
  if (SearchField === null) SearchField = '';
  const SearchValue = '';
  try {
    const MaxRows = Number(dynamicpagging);
    if (Page === null) Page = 1;
    const rows = await db.proc(DB, 'Usp_TransactionHistory_F', {
      fromDate: FromDate, toDate: ToDate, SearchField, MAXROWS: MaxRows, STARTROWINDEX: Page, orderbydate,
    });
    const WalletCreditHistory = mapRows(rows, PROPS);
    const TotalRecord = outIntStrict(rows, 'totalcount');
    const TotalBALANCE = outIntStrict(rows, 'balance');
    const TotalCreadit = outIntStrict(rows, 'cr_amount');
    const TotalDebit = outIntStrict(rows, 'dr_amount');
    ViewBag.orderbydate = orderbydate;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.TotalBALANCE = TotalBALANCE;
    ViewBag.TotalCreadit = TotalCreadit;
    ViewBag.TotalDebit = TotalDebit;
    ViewBag.CurrentPage = Page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = FromDate;
    ViewBag.toDate = ToDate;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, FromDate, ToDate, SearchField);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/TransactionHistory/Index.cshtml', Model: WalletCreditHistory, ...ViewBag });
  } catch (ExpObj) {
    return errorViewMsg(req, res, ExpObj, 'USP_Fund_History', { ErrorMessage: ExpObj.message });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string FromDate, string ToDate, string SearchField)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.FromDate), B.nStr(req.p.ToDate), B.nStr(req.p.SearchField));
  if (!r.sent) res.send('');
}));

module.exports = router;
