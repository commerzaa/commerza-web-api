'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\PurchaseBV.cs (class PurchaseBVController => /admin/PurchaseBV/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nre, nint, nstr, toInt32, col, view, fmtDate, n2, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows,
} = require('./_shared/batch02-common');
const { outIntOf, errorView } = require('./_shared/batch11-common');

const router = express.Router();
const C = 'PurchaseBV';

/** class PurchaseBV */
const PURCHASEBV_PROPS = ['ROWNUMBER', 'Date', 'TOTALBV', 'USERNAME', 'NAME', 'PRODUCTNAME'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (module state).
let url = '';
let url1 = '';

/** [USP_GEN_ALLPURCHASEBVMEMBER] @PLID,@STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT OUT,@TOTALNETCOMMISSION OUT */
async function loadList(SearchField, SearchValue, fromdate, todate, page, MaxRows) {
  if (SearchField === null || SearchValue === null || fromdate === null || todate === null) throw nre(); // .Trim()
  return db.proc(DB, 'USP_GEN_ALLPURCHASEBVMEMBER', {
    PLID: '0', STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
    FROMDATE: fromdate.trim(), TODATE: todate.trim(),
  });
}

/** decimal.Parse(<decimal OUT>.Value.ToString()) (DBNull => FormatException). PORT-NOTE: no rows => PG cannot return the OUT value => 0. */
function decParseOf(rows, name) {
  if (!rows || !rows.length) return 0;
  const v = col(rows[0], name);
  if (v === null || v === undefined || v === '') throw new Error('Input string was not in a correct format.');
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
}

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage) */
async function ExportReport(req, res, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Leadership_Bonus_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  const MaxRows = toInt32(ddlcustpage);
  if (page === null) page = 1; // eslint-disable-line no-param-reassign
  const AllFreeEpinList = mapRows(await loadList(SearchField, SearchValue, fromdate, todate, page, MaxRows), PURCHASEBV_PROPS);
  return tsvDownload({
    req, res, ViewBag, xlsName: 'Leadership_Bonus.xls', Filename,
    headers: ['S.No.', 'USERNAME', 'Name', 'Product Name', 'Date', 'BV'],
    rows: AllFreeEpinList,
    innerProc: 'AllFreeEpinList',
    outerProc: 'USP_BonusIncomeHistory',
    cells: (item, w) => {
      w(tab(cs(item.ROWNUMBER)) + ' \t');
      w(tab(cs(item.USERNAME)) + ' \t');
      w(tab(cs(item.NAME)) + ' \t');
      w(tab(cs(item.PRODUCTNAME)) + ' \t');
      w(tab(fmtDate(item.Date, 'dd-MM-yyyy')) + ' \t');
      w(tab(n2(item.TOTALBV)) + ' \t');
    },
  });
}

// ---------------------------------------------------------------- Index(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/order-bv" -> PurchaseBV/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/order-bv'], adminAuth, asyncHandler(async (req, res) => {
  let SearchField = nstr(req.p.SearchField);
  let SearchValue = nstr(req.p.SearchValue);
  let fromdate = nstr(req.p.fromdate);
  let todate = nstr(req.p.todate);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  let btnexel = nstr(req.p.btnexel);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (btnexel === null) btnexel = '';
  // USP_EXCEL_LINK @url,@ISACTIVE out => Convert.ToInt32(spOutput.Value) (DBNull => InvalidCastException)
  const er = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const ev = col(er, 'isactive');
  if (ev === null || ev === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  ViewBag.isactive = toInt32(ev);
  try {
    const MaxRows = toInt32(ddlcustpage);
    if (page === null) page = 1;
    const rows = await loadList(SearchField, SearchValue, fromdate, todate, page, MaxRows);
    const AllFreeEpinList = mapRows(rows, PURCHASEBV_PROPS);
    const TotalRecord = outIntOf(rows, 'TOTALCOUNT');
    const TOTALAMOUNTS = decParseOf(rows, 'TOTALNETCOMMISSION');
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TOTALAMOUNTS = TOTALAMOUNTS;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, ViewBag);
      if (r.sent) return undefined;
    }
    return view(res, '~/Views/AdminPanel/PurchaseBV/Index.cshtml', AllFreeEpinList, ViewBag);
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_BonusIncomeHistory');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nstr(req.p.SearchField), nstr(req.p.SearchValue), nstr(req.p.fromdate), nstr(req.p.todate),
    nint(req.p.page), nint(req.p.ddlcustpage), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
