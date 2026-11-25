'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Shoppingwallet_M_M.cs (class Shoppingwallet_M_MController => /admin/Shoppingwallet_M_M/...)
// Database: affiliate (Db_Affiliate).
// Coverage: Index ([SessionExpireCheck]) -> route ; ExportReport (public void => routable) -> route + internal function.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch13-06-common');

const router = express.Router();
const { DB } = B;
const C = 'Shoppingwallet_M_M';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** [Usp_TransferFundToUser] @Mode=13,@TMFTHID,@PLID,@ToPlid,@Amount,@Remark,@StrResult OUT,@TotalCount OUT,@FromDate,@ToDate,@StartRowIndex,
 *  @MaxRows,@SearchUsername,@Typeofcrdr,@paymode,@IncomeData,@orderbydate */
function transferList(Type, Username, fromDate, toDate, StartRowIndex, MaxRows, ToUsername, orderbydate) {
  const p = {
    Mode: '13', TMFTHID: Type, PLID: '0', ToPlid: '0', Amount: '0', Remark: Username, FromDate: fromDate, ToDate: toDate,
    StartRowIndex, MaxRows, SearchUsername: ToUsername, Typeofcrdr: '0', paymode: '0', IncomeData: '0', orderbydate,
  };
  B.need(p);
  return db.proc(DB, 'Usp_TransferFundToUser', p);
}

/** public void ExportReport(string fromDate, string toDate, int? page, string Username, string Type, string ToUsername, int? ddlcustpage) */
async function ExportReport(req, res, ViewBag, fromDate, toDate, page, Username, Type, ToUsername, ddlcustpage) {
  const userid = req.user.emp_id;
  const Filename = 'Fund_Transfer_History_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); void MaxRows; // computed, unused (legacy)
  if (page === null) page = 1;
  const Obj = mapRows(await transferList(Type, Username, fromDate, toDate, 1, 1000000, ToUsername, ''), B.FUND_TRANSFER_HISTORY_PROPS);
  if (Obj.length > 0) {
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
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string fromDate, string toDate, int? page, string Username, string Type, string ToUsername, int? ddlcustpage, string btnexel)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/ShoppingWallet-M-M" -> Shoppingwallet_M_M/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/ShoppingWallet-M-M'], adminAuth, asyncHandler(async (req, res) => {
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
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (Username === null) Username = '';
  if (ToUsername === null) ToUsername = '';
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
    const rows = await transferList(Type, Username, fromDate, toDate, page, MaxRows, ToUsername, orderbydate);
    const Obj = mapRows(rows, B.FUND_TRANSFER_HISTORY_PROPS);
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
      const r = await ExportReport(req, res, ViewBag, fromDate, toDate, page, Username, Type, ToUsername, ddlcustpage);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Shoppingwallet_M_M/Index.cshtml', Model: Obj, ...ViewBag });
  } catch (ExpObj) {
    return B.errorView(req, res, ExpObj, 'Usp_TransferFundToUser');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => B.nStr(req.p[k]);
  const r = await ExportReport(req, res, {}, v('fromDate'), v('toDate'), B.nInt(req.p.page), v('Username'), v('Type'), v('ToUsername'), B.nInt(req.p.ddlcustpage));
  if (!r.sent) res.send('');
}));

module.exports = router;
