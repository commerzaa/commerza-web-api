'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Payit_Forword_List.cs (class Payit_Forword_ListController, no namespace
// => /admin/Payit_Forword_List/...). Database: affiliate (Db_Affiliate). Procs USP_EXCEL_LINK, USP_GETEXCELPERMISIONSTATUS,
// USP_PAID_FORWORDLIST_BYADMIN, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  nInt, nStr, cellStr, tab, dec2, nowStamp, excelHistory, writeXlsExport, errorView, excelLink, inlinePerms, decOutIntOf,
} = require('./_shared/batch11-common');
const { strictOutInt } = require('./_shared/batch11-b-common');
const { dynPaging } = require('./_shared/batch06-common');
const { PAYIT_FORWORD_LIST_PROPS } = require('./_shared/batch13-01-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Payit_Forword_List';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** public void ExportReport(string SearchField, string SearchValue, int? page, string OrderBy, string FROMDATE, string TODATE, string ByUser, string ForUser) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, page, OrderBy, FROMDATE, TODATE, ByUser, ForUser) {
  const userid = req.user.emp_id;
  const Filename = 'Payit_Forward_List_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); // eslint-disable-line no-unused-vars
  if (SearchField === null || SearchValue === null) { SearchField = ''; SearchValue = ''; }
  if (OrderBy === null) OrderBy = '';
  if (page === null) page = 1;
  // [USP_PAID_FORWORDLIST_BYADMIN] @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@USERNAME,@PaymentMode,@ByUser,@ForUser,@TOTALCOUNT out
  const AllFreeEpinList = mapRows(await db.proc(DB, 'USP_PAID_FORWORDLIST_BYADMIN', {
    STARTROWINDEX: page, MAXROWS: '100000', SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE, TODATE, USERNAME: '', PaymentMode: '',
    ByUser, ForUser,
  }), PAYIT_FORWORD_LIST_PROPS);
  if (AllFreeEpinList.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Payit_Forward_List.xls', Filename, rows: AllFreeEpinList, downloadName: ' Payit_Forward_List.xls',
      headers: ['S.No.', 'Puchase Date', 'By User', 'For User', 'Package Name', 'USD', 'Coin', 'Mode Name', 'Status', 'Remark'],
      innerProc: 'PayitForword_list', outerProc: 'USP_PAID_FORWORDLIST_BYADMIN',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'TFLID')) + ' \t');
        w(tab(cellStr(item, 'PURCHASEDATE')) + ' \t');
        w(tab(cellStr(item, 'BYUSER')) + ' \t');
        w(tab(cellStr(item, 'FORUSER')) + ' \t');
        w(tab(cellStr(item, 'ALLPACKAGENAME')) + ' \t');
        w(tab(dec2(item.INR)) + ' \t');
        w(tab(dec2(item.ATC)) + ' \t');
        w(tab(cellStr(item, 'MODENAME')) + ' \t');
        w(tab(cellStr(item, 'STATUS')) + ' \t');
        w(tab(cellStr(item, 'REMARK')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue,
//   int? page, string OrderBy, string FROMDATE, string TODATE, string ByUser, string ForUser, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Payit-Forword-List" -> Payit_Forword_List/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Payit-Forword-List{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let page = nInt(req.p.page);
  let OrderBy = nStr(req.p.OrderBy);
  let FROMDATE = nStr(req.p.FROMDATE);
  let TODATE = nStr(req.p.TODATE);
  let ByUser = nStr(req.p.ByUser);
  let ForUser = nStr(req.p.ForUser);
  let btnexel = nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (FROMDATE === null) FROMDATE = '';
  if (TODATE === null) TODATE = '';
  if (dynamicpagging === null) dynamicpagging = dynPaging();
  if (orderbydate === null) orderbydate = '';
  if (ByUser === null) ByUser = '';
  if (ForUser === null) ForUser = '';
  if (btnexel === null) btnexel = '';
  const ViewBag = {};
  ViewBag.excelactive = await excelLink(url);
  const Employeeid = req.user.emp_id;
  const p = await inlinePerms(Employeeid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  try {
    const MaxRows = Number(dynamicpagging);
    if (SearchField === null || SearchValue === null) { SearchField = ''; SearchValue = ''; }
    if (OrderBy === null) OrderBy = '';
    if (page === null) page = 1;
    // [USP_PAID_FORWORDLIST_BYADMIN] ... @ByUser,@ForUser,@TOTALCOUNT out,@TOTALAMOUNTINR OUT,@TOTALATC OUT,@orderbydate
    const rows = await db.proc(DB, 'USP_PAID_FORWORDLIST_BYADMIN', {
      STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE, TODATE, USERNAME: '', PaymentMode: '',
      ByUser: ByUser.trim(), ForUser: ForUser.trim(), orderbydate,
    });
    const AllFreeEpinList = mapRows(rows, PAYIT_FORWORD_LIST_PROPS);
    const TotalRecord = decOutIntOf(rows, 'TOTALCOUNT'); // int.Parse(<decimal OUT>.ToString())
    const TOTALAMOUNTSINR = decOutIntOf(rows, 'TOTALAMOUNTINR'); // int.Parse(<decimal OUT>.ToString())
    const TOTALATCS = strictOutInt(rows, 'TOTALATC');
    ViewBag.CurrentPage = page; ViewBag.orderbydate = orderbydate;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TOTALAMOUNTSINR = TOTALAMOUNTSINR;
    ViewBag.TOTALATCS = TOTALATCS;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.FROMDATE = FROMDATE;
    ViewBag.TODATE = TODATE;
    ViewBag.ByUser = ByUser;
    ViewBag.ForUser = ForUser;
    ViewBag.OrderBy = OrderBy;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, page, OrderBy, FROMDATE, TODATE, ByUser, ForUser);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Payit_Forword_List/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_PAID_FORWORDLIST_BYADMIN');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, int? page, string OrderBy,
//   string FROMDATE, string TODATE, string ByUser, string ForUser)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nStr(req.p.SearchField), nStr(req.p.SearchValue), nInt(req.p.page), nStr(req.p.OrderBy),
    nStr(req.p.FROMDATE), nStr(req.p.TODATE), nStr(req.p.ByUser), nStr(req.p.ForUser));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
