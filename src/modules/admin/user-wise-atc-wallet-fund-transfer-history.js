'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\UserWiseATCWalletFundTransferHistoryController.cs
// (class UserWiseATCWalletFundTransferHistoryController => /admin/UserWiseATCWalletFundTransferHistory/...)
// Database: affiliate (Db_Affiliate).
//
// Coverage: Index (session check) -> route ; ExportReport (public void => routable) -> route + internal function (used by Index) ;
//           ReverseTransaction (JsonResult) -> route.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');
const { viewJson, sendVoid } = require('./_shared/batch13-11-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'UserWiseATCWalletFundTransferHistory';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** class Fund_Transfer_History (Controllers/AdminPanel/Fund_Transfer_History.cs) */
const FTH_PROPS = ['RowNumber', 'FromPlid', 'ToPlid', 'FromUsername', 'ToUsername', 'ToEmail', 'ToFullName', 'Amount', 'Date', 'Remark', 'Type',
  'TransactionID', 'ID', 'reversed'];

/** [Usp_TransferFundToUser] @Mode=3,@TMFTHID,@PLID,@ToPlid,@Amount,@Remark,@StrResult OUT,@TotalCount OUT,@FromDate,@ToDate,@StartRowIndex,@MaxRows,
 *  @SearchUsername,@Typeofcrdr,@paymode,@IncomeData,@orderbydate */
function transferList(Type, Username, fromDate, toDate, StartRowIndex, MaxRows, ToUsername, orderbydate) {
  return db.proc(DB, 'Usp_TransferFundToUser', {
    Mode: '3', TMFTHID: Type, PLID: '0', ToPlid: '0', Amount: '0', Remark: Username, FromDate: fromDate, ToDate: toDate,
    StartRowIndex, MaxRows, SearchUsername: ToUsername, Typeofcrdr: '0', paymode: '0', IncomeData: '0', orderbydate,
  });
}

// public void ExportReport(string fromDate, string toDate, int? page, string Username, string Type, string ToUsername, int? ddlcustpage, string orderbydate)
async function ExportReport(req, res, ViewBag, fromDate, toDate, page, Username, Type, ToUsername, ddlcustpage, orderbydate) {
  const userid = req.user.emp_id;
  const Filename = 'UserWiseAtcWalleHistory_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const Obj = mapRows(await transferList(Type, Username, fromDate, toDate, 1, 999999999, ToUsername, orderbydate), FTH_PROPS);
  if (Obj.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'UserWiseAtcWalleHistory.xls', Filename,
      headers: ['S.No.', 'Date', 'TransferredID', 'TransferredFrom', 'TransferredTo', 'Amount', 'Remark'],
      rows: Obj, innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        const noSpace = (k) => B.cellStr(item, k).split(' ').join('');
        w('\n');
        w(B.tab(B.cellStr(item, 'RowNumber')) + ' \t');
        w(B.tab(B.netFormat(item.Date, 'dd-MM-yyyy')) + ' \t');
        w(B.tab(B.cellStr(item, 'TransactionID')) + ' \t');
        w(B.tab(noSpace('FromUsername')) + ' \t');
        w(B.tab(noSpace('ToUsername')) + ' \t');
        w(B.tab(B.dec2(item.Amount)) + ' \t');
        w(B.tab(noSpace('Remark')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string fromDate, string toDate, int? page, string Username, string Type, string ToUsername, int? ddlcustpage, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/member-wise-atc-fund-history" -> UserWiseATCWalletFundTransferHistory/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/member-wise-atc-fund-history{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const fromDate = B.s0(req.p.fromDate);
  const toDate = B.s0(req.p.toDate);
  const Username = B.s0(req.p.Username);
  const ToUsername = B.s0(req.p.ToUsername);
  let Type = B.nStr(req.p.Type);
  if (Type === null) Type = '0';
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  if (dynamicpagging === null) dynamicpagging = 100;
  const orderbydate = B.s0(req.p.orderbydate);
  const btnexel = B.s0(req.p.btnexel);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;
  let page = B.nInt(req.p.page);
  const ViewBag = {};
  // USP_EXCEL_LINK @url,@ISACTIVE out => Convert.ToInt32(v == "0" ? "0" : v)
  ViewBag.excelactive = await B.excelLink(url);
  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
  const p = await B.inlinePerms(req.user.emp_id, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  try {
    const MaxRows = dynamicpagging;
    if (page === null) page = 1;
    const rows = await transferList(Type, Username, fromDate, toDate, page, MaxRows, ToUsername, orderbydate);
    const Obj = mapRows(rows, FTH_PROPS);
    const TotalRecord = B.outIntOf(rows, 'TotalCount'); // Convert.ToInt32(TotalCount.Value.ToString())
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
      const r = await ExportReport(req, res, ViewBag, fromDate, toDate, page, Username, Type, ToUsername, ddlcustpage, orderbydate);
      if (r.sent) return undefined;
    }
    return viewJson(res, '~/Views/AdminPanel/UserWiseATCWalletFundTransferHistory/Index.cshtml', Obj, ViewBag);
  } catch (ExpObj) {
    return B.errorView(req, res, ExpObj, 'Usp_TransferFundToUser');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, int? page, string Username, string Type, string ToUsername, int? ddlcustpage, string orderbydate)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => B.nStr(req.p[k]);
  const r = await ExportReport(req, res, {}, v('fromDate'), v('toDate'), B.nInt(req.p.page), v('Username'), v('Type'), v('ToUsername'),
    B.nInt(req.p.ddlcustpage), v('orderbydate'));
  return sendVoid(res, r);
}));

// ---------------------------------------------------------------- JsonResult ReverseTransaction(string TASMID)
// auth (reads Session["Admin_User"] outside the try - legacy NullReference without a session)
router.all(`/admin/${C}/ReverseTransaction{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TASMID = B.nStr(req.p.TASMID);
  const Empid = req.user.emp_id;
  let RetMsg = '';
  try {
    // USP_REVERSETRANSACTION @TASMID,@EID,@STRRESULT OUT
    const row = await db.procOne(DB, 'USP_REVERSETRANSACTION', { TASMID, EID: Empid });
    RetMsg = B.str(B.col(row, 'strresult')); // SpOutput.Value.ToString() (DBNull => "")
    return res.json(RetMsg);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_REVERSETRANSACTION');
    RetMsg = 'Error occurred. Please try later';
    return res.json(RetMsg);
  }
}));

module.exports = router;
