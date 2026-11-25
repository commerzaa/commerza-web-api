'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Fund_Transfer_History.cs (class Fund_Transfer_HistoryController => /admin/Fund_Transfer_History/...)
// Database: affiliate (Db_Affiliate).
//
// Coverage: Index ([SessionExpireCheck]) -> route ; ExportReport (public void => routable) -> route + internal function (used by Index).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch07-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Fund_Transfer_History';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** class Fund_Transfer_History */
const FTH_PROPS = ['RowNumber', 'FromPlid', 'ToPlid', 'FromUsername', 'ToUsername', 'ToEmail', 'ToFullName', 'Amount', 'Date', 'Remark', 'Type',
  'TransactionID', 'ID', 'reversed'];

/** [Usp_TransferFundToUser] @Mode=4 ... (history listing) */
async function transferList(Type, Username, fromDate, toDate, StartRowIndex, MaxRows, ToUsername, orderbydate, Remark) {
  return db.proc(DB, 'Usp_TransferFundToUser', {
    Mode: '4', TMFTHID: Type, PLID: '0', ToPlid: '0', Amount: '0', Remark: Username, FromDate: fromDate, ToDate: toDate,
    StartRowIndex, MaxRows, SearchUsername: ToUsername, Typeofcrdr: '0', paymode: '0', IncomeData: '0', orderbydate, RemarkNew: Remark,
  });
}

/** public void ExportReport(string fromDate, string toDate, int? page, string Username, string Type, string ToUsername, int? ddlcustpage, string Remark, string orderbydate) */
async function ExportReport(req, res, ViewBag, fromDate, toDate, page, Username, Type, ToUsername, ddlcustpage, Remark, orderbydate) {
  const userid = req.user.emp_id;
  const Filename = 'Fund_Transfer_History_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); void MaxRows; // computed, unused (legacy)
  if (page === null) page = 1;
  // proc call is outside the try in legacy (exceptions propagate to the caller)
  const Obj = mapRows(await transferList(Type, Username, fromDate, toDate, 1, 10000000, ToUsername, orderbydate, Remark), FTH_PROPS);
  const noSpace = (item, k) => B.cellStr(item, k).split(' ').join('');
  return B.writeXlsExport({
    req, res, ViewBag, sheet: 'Fund_Transfer_History.xls', Filename,
    headers: ['S.No.', 'Date', 'TransferredID', 'TransferredFrom', 'TransferredTo', 'Amount', 'Remark'],
    rows: Obj, innerProc: 'Fund_Transfer_History', outerProc: 'Usp_TransferFundToUser',
    cells: (item, w) => {
      w('\n');
      w(B.tab(B.cellStr(item, 'RowNumber')) + ' \t');
      w(B.tab(B.netFormat(item.Date, 'dd-MM-yyyy')) + ' \t');
      w(B.tab(B.cellStr(item, 'TransactionID')) + ' \t');
      w(B.tab(noSpace(item, 'FromUsername')) + ' \t');
      w(B.tab(noSpace(item, 'ToUsername')) + ' \t');
      w(B.tab(B.dec2(item.Amount)) + ' \t');
      w(B.tab(noSpace(item, 'Remark')) + ' \t');
    },
  });
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string fromDate, string toDate, int? page, string Username, string Type, string ToUsername, int? ddlcustpage, string btnexel, string Remark)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/member-fund-transfer-history" -> Fund_Transfer_History/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/member-fund-transfer-history'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let page = B.nInt(req.p.page);
  let Username = B.nStr(req.p.Username);
  let Type = B.nStr(req.p.Type);
  let ToUsername = B.nStr(req.p.ToUsername);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  let btnexel = B.nStr(req.p.btnexel);
  let Remark = B.nStr(req.p.Remark);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (Username === null) Username = '';
  if (ToUsername === null) ToUsername = '';
  if (Remark === null) Remark = '';
  if (Type === null) Type = '0';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (btnexel === null) btnexel = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  const Empid = req.user.emp_id;
  const ViewBag = {};
  const perm = await B.perms(Empid, url); // CheckPermissions.GetPageActionPermission + GetExcelPermission
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = perm.excelactive;
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await transferList(Type, Username, fromDate, toDate, page, MaxRows, ToUsername, orderbydate, Remark);
    const Obj = mapRows(rows, FTH_PROPS);
    // Convert.ToInt32(TotalCount.Value.ToString()) - OUT param read from the first result row.
    // PORT-NOTE: no result row => 0 (the OUT value is not available without a row).
    const TotalRecord = rows.length ? B.outInt(rows[0], 'totalcount') : 0;
    ViewBag.CurrentPage = page;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.GridPageSize = ddlcustpage;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.Username = Username;
    ViewBag.ToUsername = ToUsername;
    ViewBag.Type = Type;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, fromDate, toDate, page, Username, Type, ToUsername, ddlcustpage, Remark, orderbydate);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Fund_Transfer_History/Index.cshtml', Model: Obj, ...ViewBag });
  } catch (ExpObj) {
    return B.errorView(req, res, ExpObj, 'Usp_TransferFundToUser');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.fromDate), B.nStr(req.p.toDate), B.nInt(req.p.page), B.nStr(req.p.Username),
    B.nStr(req.p.Type), B.nStr(req.p.ToUsername), B.nInt(req.p.ddlcustpage), B.nStr(req.p.Remark), B.nStr(req.p.orderbydate));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
