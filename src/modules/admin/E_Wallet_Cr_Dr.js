'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\E_Wallet_Cr_Dr.cs (class E_Wallet_Cr_DrController, no namespace => /E_Wallet_Cr_Dr/...)
// Database: affiliate (Db_Affiliate). Procs USP_FUND_HISTORY, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const {
  nInt, nStr, col, str, cvtInt, perms, nowStamp, excelHistory, writeXlsExport, cellStr, tab, dec2, nullRef,
} = require('./_shared/batch06_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'E_Wallet_Cr_Dr';

/** public class EwalletStatement */
const EWALLET_STATEMENT_PROPS = ['RowNumber', 'type', 'Amount', 'Date', 'Remark', 'Username', 'CURRENTBALANCE', 'DRAMOUNT', 'MemberName', 'PAYMODE', 'Particular'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** [USP_FUND_HISTORY] @TFHID,@FROMDATE,@TODATE,@StartRowIndex,@MaxRows,@StrResult,@TotalCount OUT,@TOTALCRAMOUNT OUT,@TOTALDRAMOUNT OUT,@CRDRTYPE,
 *  @TRTYPE,@CRAMOUNT OUT,@DRAMOUNT OUT,@AVALIBALEFUND OUT,@MODE,@ORDERBYDATE,@Emp_ID,@SessionID,@Remark,@SearchFields,@SearchValue,@transtype */
const fundHistory = (o) => db.proc(DB, 'USP_FUND_HISTORY', {
  TFHID: o.Plid, FROMDATE: o.FromDate, TODATE: o.ToDate, StartRowIndex: o.Page, MaxRows: o.MaxRows, StrResult: '', CRDRTYPE: o.SearchField,
  TRTYPE: 0, MODE: 1, ORDERBYDATE: o.orderbydate, Emp_ID: o.Empid, SessionID: '0', Remark: o.Remark, SearchFields: o.SearchFields,
  SearchValue: o.SearchValue, transtype: o.transtype,
});

/** public void ExportReport(string FromDate, string ToDate, string orderbydate, int? Page, int? Plid, string SearchField, string Remark,
 *  string SearchFields, string SearchValue, int? transtype)   (no try/catch in legacy => errors propagate to the caller) */
async function ExportReport(req, res, FromDate, ToDate, orderbydate, Page, Plid, SearchField, Remark, SearchFields, SearchValue, transtype, ViewBag) {
  const userid = req.user.emp_id;
  const Empid = req.user.emp_id;
  const Filename = 'All_Member_List_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize();
  const list = mapRows(await fundHistory({
    Plid, FromDate, ToDate, Page, MaxRows, SearchField, orderbydate, Empid, Remark, SearchFields, SearchValue, transtype,
  }), EWALLET_STATEMENT_PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'All_Member_List.xls', Filename, ViewBag, rows: list, rethrow: true,
      headers: ['S.No.', 'ProcessDate', 'UserName', 'Name', 'Paymode', 'Type', 'Amount', 'Remarks'],
      innerProc: 'AllEPinRequestsList',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'RowNumber')) + ' \t');
        w(tab(cellStr(item, 'Date')) + ' \t');
        w(tab(cellStr(item, 'Username')) + ' \t');
        w(tab(cellStr(item, 'MemberName').split(' ').join('')) + ' \t');
        w(tab(cellStr(item, 'PAYMODE')) + ' \t');
        const T = () => { if (item.type === null || item.type === undefined) throw nullRef(); return String(item.type).toUpperCase(); };
        if (T() === 'CR') w(tab('Cr') + ' \t');
        else if (T() === 'DR') w(tab('DR') + ' \t');
        if (T() === 'CR') w(tab(dec2(item.Amount)) + ' \t');
        else if (T() === 'DR') w(tab(dec2(item.DRAMOUNT)) + ' \t');
        if (item.Remark !== null && item.Remark !== undefined) w(tab(String(item.Remark)) + ' \t');
        else w(tab('') + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate,
//   string ToDate, string SearchField, string SearchFields, string SearchValue, string btnexel, string Remark, int? transtype)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/E-Wallet-Cr-Dr" -> E_Wallet_Cr_Dr/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/E-Wallet-Cr-Dr'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let Page = nInt(req.p.Page);
  let FromDate = nStr(req.p.FromDate);
  let ToDate = nStr(req.p.ToDate);
  let SearchField = nStr(req.p.SearchField);
  let SearchFields = nStr(req.p.SearchFields);
  let SearchValue = nStr(req.p.SearchValue);
  const btnexel = nStr(req.p.btnexel);
  let Remark = nStr(req.p.Remark);
  let transtype = nInt(req.p.transtype);
  const Plid = 0;
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (FromDate === null) FromDate = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (ToDate === null) ToDate = '';
  if (Remark === null) Remark = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (SearchFields === null) SearchFields = '';
  if (transtype === null) transtype = -1;
  const Empid = req.user.emp_id;
  const ViewBag = {};
  const p = await perms(Empid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = p.excelactive;
  try {
    const MaxRows = Number(dynamicpagging);
    if (Page === null) Page = 1;
    const rows = await fundHistory({
      Plid, FromDate, ToDate, Page, MaxRows, SearchField, orderbydate, Empid, Remark, SearchFields, SearchValue, transtype,
    });
    const EwalletStatementList = mapRows(rows, EWALLET_STATEMENT_PROPS);
    const tc = str(col(rows[0], 'TotalCount'));
    const TotalRecord = cvtInt(tc === '' ? '0' : tc);
    ViewBag.CurrentPage = Page;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ToDate = ToDate;
    ViewBag.FromDate = FromDate;
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    if (btnexel === 'Export Excel') {
      const x = await ExportReport(req, res, FromDate, ToDate, orderbydate, Page, Plid, SearchField, Remark, SearchFields, SearchValue, transtype, ViewBag);
      if (x.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/E_Wallet_Cr_Dr/Index.cshtml', Model: EwalletStatementList, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_Fund_History');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml', ...ViewBag });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string FromDate, string ToDate, string orderbydate, int? Page, int? Plid,
//   string SearchField, string Remark, string SearchFields, string SearchValue, int? transtype)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.FromDate), nStr(req.p.ToDate), nStr(req.p.orderbydate), nInt(req.p.Page), nInt(req.p.Plid),
    nStr(req.p.SearchField), nStr(req.p.Remark), nStr(req.p.SearchFields), nStr(req.p.SearchValue), nInt(req.p.transtype), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

module.exports = router;
