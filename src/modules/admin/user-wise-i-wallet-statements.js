'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\UserWiseIWalletStatementsController.cs
// (class UserWiseIWalletStatementsController => /admin/UserWiseIWalletStatements/...)
// Database: affiliate (Db_Affiliate).
//
// Coverage: Index -> route ; ExportReport (public void => routable) -> route + internal function (used by Index).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');
const { decOf, int0Of, viewJson, sendVoid } = require('./_shared/batch13-11-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'UserWiseIWalletStatements';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** class MemberEwalletStatement */
const PROPS = ['RowNumber', 'type', 'Amount', 'Date', 'Remark', 'Username', 'MemberName', 'Mobile', 'CURRENTBALANCE', 'DRAMOUNT', 'Particular'];

/** [USP_Fund_History] @TFHID,@FROMDATE,@TODATE,@STARTROWINDEX,@MAXROWS,@STRRESULT OUT,@TOTALCOUNT OUT,@TOTALCRAMOUNT OUT,@TOTALDRAMOUNT OUT,
 *  @CRDRTYPE,@TRTYPE,@CRAMOUNT OUT,@DRAMOUNT OUT,@AVALIBALEFUND OUT,@MODE,@ORDERBYDATE,@EMP_ID,@SESSIONID,@REMARK,@SearchFields,@SEARCHVALUE */
function fundHistory(Plid, FromDate, ToDate, Page, MaxRows, SearchField, orderbydate, Remark, SearchFields, SearchValue) {
  // CommandTimeout = 1000
  return db.proc(DB, 'USP_Fund_History', {
    TFHID: Plid, FROMDATE: FromDate, TODATE: ToDate, STARTROWINDEX: Page, MAXROWS: MaxRows, CRDRTYPE: SearchField, TRTYPE: '0', MODE: '0',
    ORDERBYDATE: orderbydate, EMP_ID: 0, SESSIONID: '0', REMARK: Remark, SearchFields, SEARCHVALUE: SearchValue,
  });
}

// public void ExportReport(int? Page, string orderbydate, string SearchFields, string FromDate, string ToDate, string SearchField, string Remark, string SearchValue, int? transtype)
async function ExportReport(req, res, ViewBag, Page, orderbydate, SearchFields, FromDate, ToDate, SearchField, Remark, SearchValue, transtype) {
  void transtype; // (unused, like legacy)
  const Plid = 0;
  const userid = req.user.emp_id;
  const Filename = 'Ewallet_Statement' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = 1000000;
  if (Page === null) Page = 1;
  const MemberEwalletStatement_List = mapRows(
    await fundHistory(Plid, FromDate, ToDate, Page, MaxRows, SearchField, orderbydate, Remark, SearchFields, SearchValue), PROPS);
  if (MemberEwalletStatement_List.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Ewallet_Statement.xls', Filename,
      headers: ['S.No.', 'Date', 'Username', 'Name', 'Mobile', 'Type', 'Amount', 'Particulars'],
      rows: MemberEwalletStatement_List, innerProc: 'USP_Fund_History', outerProc: 'MemberEwalletStatement_List',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'RowNumber')) + ' \t');
        w(B.tab(B.cellStr(item, 'Date')) + ' \t');
        w(B.tab(B.cellStr(item, 'Username')) + ' \t');
        w(B.tab(B.cellStr(item, 'MemberName')) + ' \t');
        w(B.tab(B.cellStr(item, 'Mobile')) + ' \t');
        w(B.tab(B.cellStr(item, 'type')) + ' \t'); // Regex.Replace(null) => ArgumentNullException
        if (item.type === 'Dr') w(B.tab(B.dec2(item.DRAMOUNT)) + ' \t');
        else w(B.tab(B.dec2(item.Amount)) + ' \t');
        w(B.tab(B.cellStr(item, 'Remark')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate, string ToDate, string SearchField, string SearchFields, string SearchValue, string btnexel, string Remark, int? type, int? transtype)
// auth (reads Session["Admin_User"] - legacy NullReference without a session)
// route-config: "AdminPanel/Ewallet-statements" -> UserWiseIWalletStatements/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Ewallet-statements{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  const Plid = 0;
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let Page = B.nInt(req.p.Page);
  const btnexel = B.nStr(req.p.btnexel);
  const type = B.nInt(req.p.type);
  let transtype = B.nInt(req.p.transtype);
  const Remark = B.s0(req.p.Remark);
  let FromDate = B.s0(req.p.FromDate);
  let ToDate = B.s0(req.p.ToDate);
  if (dynamicpagging === null) dynamicpagging = 100;
  const orderbydate = B.s0(req.p.orderbydate);
  let SearchField = B.s0(req.p.SearchField);
  let SearchValue = B.s0(req.p.SearchValue);
  let SearchFields = B.s0(req.p.SearchFields);
  if (transtype === null) transtype = -1;

  if (type === 1) {
    FromDate = await UtilityClass.Decryptword(FromDate);
    ToDate = await UtilityClass.Decryptword(ToDate);
    SearchField = await UtilityClass.Decryptword(SearchField);
  } else if (type === 2) {
    SearchValue = await UtilityClass.Decryptword(SearchValue);
    SearchField = await UtilityClass.Decryptword(SearchField);
  } else if (type === 3) {
    SearchFields = 'USERNAME';
    SearchValue = await UtilityClass.Decryptword(SearchValue);
  } else {
    transtype = -1;
  }
  const ViewBag = {};
  try {
    const Empid = req.user.emp_id;
    const p = await B.perms(Empid, url);
    ViewBag.isactive = p.isactive;
    ViewBag.isedit = p.isedit;
    ViewBag.excelactive = p.excelactive;
    const MaxRows = dynamicpagging;
    if (Page === null) Page = 1;
    const rows = await fundHistory(Plid, FromDate, ToDate, Page, MaxRows, SearchField, orderbydate, Remark, SearchFields, SearchValue);
    const MemberEwalletStatement_List = mapRows(rows, PROPS);
    const TotalRecord = int0Of(rows, 'TOTALCOUNT');
    const TotalCR = decOf(rows, 'TOTALCRAMOUNT');
    const TotalDR = decOf(rows, 'TOTALDRAMOUNT');
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.CurrentPage = Page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TotalCR = TotalCR;
    ViewBag.TotalDR = TotalDR;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ToDate = ToDate;
    ViewBag.FromDate = FromDate;
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, Page, orderbydate, SearchFields, FromDate, ToDate, SearchField, Remark, SearchValue, transtype);
      if (r.sent) return undefined;
    }
    return viewJson(res, '~/Views/AdminPanel/UserWiseIWalletStatements/Index.cshtml', MemberEwalletStatement_List, ViewBag);
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_Fund_History');
    ViewBag.ErrorMessage = ExpObj.message;
    return viewJson(res, '~/Views/PageNotFound/Index.cshtml', null, ViewBag);
  }
}));

// ---------------------------------------------------------------- public void ExportReport(int? Page, string orderbydate, string SearchFields, string FromDate, string ToDate, string SearchField, string Remark, string SearchValue, int? transtype)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => B.nStr(req.p[k]);
  const r = await ExportReport(req, res, {}, B.nInt(req.p.Page), v('orderbydate'), v('SearchFields'), v('FromDate'), v('ToDate'),
    v('SearchField'), v('Remark'), v('SearchValue'), B.nInt(req.p.transtype));
  return sendVoid(res, r);
}));

module.exports = router;
