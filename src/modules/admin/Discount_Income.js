'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Discount_Income.cs (class Discount_IncomeController, no namespace => /Discount_Income/...)
// Database: affiliate (Db_Affiliate). Procs USP_DISCOUNT_MEMBERFORADMINPANELINCOME, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  nInt, nStr, col, str, cvtInt, perms, nowStamp, excelHistory, writeXlsExport, cellStr, tab, dec2, errorView,
} = require('./_shared/batch06_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Discount_Income';

/** public class Discount_Income */
const DISCOUNT_INCOME_PROPS = ['ROWNUMBER', 'FROMUSERNAME', 'TOUSERNAME', 'DATE', 'INCOME', 'LEVEL'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** [USP_DISCOUNT_MEMBERFORADMINPANELINCOME] @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT OUT,@PLID */
const callProc = (page, MaxRows, SearchField, SearchValue, fromdate, todate) => db.proc(DB, 'USP_DISCOUNT_MEMBERFORADMINPANELINCOME', {
  STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: fromdate, TODATE: todate, PLID: '',
});

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage) */
async function ExportReport(req, res, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Discount_Income' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = ddlcustpage === null ? 0 : Number(ddlcustpage); // Convert.ToInt32(int?) null => 0
  if (page === null) page = 1;
  const list = mapRows(await callProc(page, MaxRows, SearchField, SearchValue, fromdate, todate), DISCOUNT_INCOME_PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'Discount_Income.xls', Filename, ViewBag, rows: list,
      rawHeaders: 'S.No. \tFrom UserName\tTo UserName\tDate \tIncome \tLevel \t',
      innerProc: 'AllFreeEpinList', outerProc: 'USP_DISCOUNT_MEMBERFORADMINPANELINCOME',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'FROMUSERNAME')) + ' \t');
        w(tab(cellStr(item, 'TOUSERNAME')) + ' \t');
        w(tab(cellStr(item, 'DATE')) + ' \t');
        w(tab(dec2(item.INCOME)) + ' \t');
        w(tab(dec2(item.LEVEL)) + ' \t'); // int.ToString("0.00")
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField,
//   string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, string btnexel)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/Discount-Income" -> Discount_Income/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Discount-Income'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromdate = nStr(req.p.fromdate);
  let todate = nStr(req.p.todate);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  let btnexel = nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (btnexel === null) btnexel = '';
  const Empid = req.user.emp_id;
  const ViewBag = {};
  const p = await perms(Empid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = p.excelactive;
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await callProc(page, MaxRows, SearchField, SearchValue, fromdate, todate);
    const list = mapRows(rows, DISCOUNT_INCOME_PROPS);
    const tc = str(col(rows[0], 'TOTALCOUNT'));
    const TotalRecord = cvtInt(tc === '' ? '0' : tc);
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    if (btnexel === 'Export Excel') {
      const x = await ExportReport(req, res, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, ViewBag);
      if (x.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Discount_Income/Index.cshtml', Model: list, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_DISCOUNT_MEMBERFORADMINPANELINCOME');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (PORT-NOTE: public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.fromdate), nStr(req.p.todate),
    nInt(req.p.page), nInt(req.p.ddlcustpage), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

module.exports = router;
