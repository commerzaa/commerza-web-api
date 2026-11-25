'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\RoyalityIncome.cs (class RoyalityIncomeController, no namespace
// => /admin/RoyalityIncome/...). Database: affiliate (Db_Affiliate). Procs USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK, USP_RoyalityINCOME,
// USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  nInt, nStr, inlinePerms, nowStamp, excelHistory, writeXlsExport, cellStr, tab, dec2, errorView, trimNull, netDateString, nullRef,
} = require('./_shared/batch06-common');
const { outIntOf } = require('./_shared/batch11-common');
const { decOutOf } = require('./_shared/batch13-05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'RoyalityIncome';

/** public class RoyalityIncome */
const ROYALITY_INCOME_PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'DATE', 'TOTALINCOME', 'ADMINCHARGE', 'TDS', 'NETINCOME', 'TOTALBUSSINESS',
  'TOTALACHIVER', 'TransactionType'];

// PORT-NOTE: `static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** DateTime.ToString() */
function dt(v) {
  if (v === null || v === undefined) throw nullRef();
  return v instanceof Date ? netDateString(v) : String(v);
}

/** public void ExportReport(string fromdate, string todate, string SearchField, string SearchValue) */
async function ExportReport(req, res, fromdate, todate, SearchField, SearchValue, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'RoyalityIncome_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  // db.Database.CommandTimeout = 1000
  // [USP_RoyalityINCOME] @REGNO,@STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@SEARCHFIEL,@SEARCHVALUE,@INCOMETYPE,@TOTALCOUNT OUT,@TOTALAMOUNT OUT
  const list = mapRows(await db.proc(DB, 'USP_RoyalityINCOME', {
    REGNO: 0, STARTROWINDEX: 1, MAXROWS: 10000000, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: trimNull(SearchField),
    SEARCHVALUE: trimNull(SearchValue), INCOMETYPE: 1,
  }), ROYALITY_INCOME_PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'RoyalityIncome.xls', Filename, ViewBag, rows: list,
      rawHeaders: 'S.No. \tUsername \tName \tDate\tTotal Income \tAdmin Charge \tTDS \tNet Income \t', // "Date\t" has no space in the legacy code
      innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(cellStr(item, 'NAME')) + ' \t');
        w(tab(dt(item.DATE)) + ' \t');
        w(tab(dec2(item.TOTALINCOME)) + ' \t');
        w(tab(dec2(item.ADMINCHARGE)) + ' \t');
        w(tab(dec2(item.TDS)) + ' \t');
        w(tab(dec2(item.NETINCOME)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField, string btnexel,
//   string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (Session["Admin_User"] dereferenced first, then `== null` => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Royality-Income" -> RoyalityIncome/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Royality-Income'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let btnexel = nStr(req.p.btnexel);
  let SearchValue = nStr(req.p.SearchValue);
  let fromdate = nStr(req.p.fromdate);
  let todate = nStr(req.p.todate);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out ; USP_EXCEL_LINK @url,@ISACTIVE out
  const p = await inlinePerms(Employeeid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = p.excelactive;
  if (btnexel === null) btnexel = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    // db.Database.CommandTimeout = 1000
    const rows = await db.proc(DB, 'USP_RoyalityINCOME', {
      REGNO: 0, STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: SearchField.trim(),
      SEARCHVALUE: SearchValue.trim(), INCOMETYPE: 1,
    });
    const AllFreeEpinList = mapRows(rows, ROYALITY_INCOME_PROPS);
    const TotalRecord = outIntOf(rows, 'TOTALCOUNT');
    const TOTALAMOUNTS = decOutOf(rows, 'TOTALAMOUNT');
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TOTALAMOUNTS = TOTALAMOUNTS;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    if (btnexel === 'Export Excel') {
      const x = await ExportReport(req, res, fromdate, todate, SearchField, SearchValue, ViewBag);
      if (x.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/RoyalityIncome/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_RoyalityAchivers');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string fromdate, string todate, string SearchField, string SearchValue)
// auth (PORT-NOTE: public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.fromdate), nStr(req.p.todate), nStr(req.p.SearchField), nStr(req.p.SearchValue), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

module.exports = router;
