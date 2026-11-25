'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Binary_Level_IncomeController.cs
// (namespace Common.Controllers.AdminPanel, class Binary_Level_IncomeController => /Binary_Level_Income/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const CheckPermissions = require('../../lib/admin/CheckPermissions');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const { DB, col, str, sv, nint, toDecimal, toStr, nullRef, tab, netFormat, nowStamp, tsvExport } = require('./_shared/batch03-common');

const router = express.Router();
const C = 'Binary_Level_Income';

/** class BinaryIncomeLevelReport */
const PROPS = ['ROWNUMBER', 'FROMID', 'TOID', 'INCOME', 'LEVEL', 'TYPE', 'DATE', 'COMM_PER', 'AMOUNT', 'TDS_PER', 'TDS_AMT', 'ADMIN_AMT',
  'ADMIN_PER', 'IncomeType', 'FROMUSERNAME', 'TOUSERNAME', 'REMARK', 'STATUS', 'ACTIVE', 'KIT_PRICE', 'ISHOLD', 'TOTALAMOUNT', 'Net', 'Earned',
  'REPURCHASE_AMOUNT', 'REPURCHASE_PER'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (module state).
let url = '';
let url1 = '';

const fix2 = (v) => { if (v === null || v === undefined) nullRef(); return Number(v).toFixed(2); };
/** Convert.ToDateTime(string) (FormatException on invalid text) */
function toDateTime(s) {
  if (s === null || s === undefined) return new Date(1, 0, 1); // Convert.ToDateTime(null) => DateTime.MinValue
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error('String was not recognized as a valid DateTime.');
  return d;
}

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, int? IsHold) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, IsHold) {
  const userid = req.user.emp_id;
  const Filename = `Binary_Level_Income_${userid}_${nowStamp()}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
  // eslint-disable-next-line no-unused-vars
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  if (fromdate === null || todate === null || SearchField === null || SearchValue === null) nullRef();
  const AllFreeEpinList = mapRows(await db.proc(DB, 'USP_LEVELINCOME_REPORTS', {
    STARTROWINDEX: page, MAXROWS: 10000000, FROMDATE: fromdate.trim(), TODATE: todate.trim(), SEARCHFIELD: SearchField.trim(),
    SEARCHVALUE: SearchValue.trim(), INCOMETYPE: 1, ISHOLD: IsHold,
  }), PROPS);
  if (AllFreeEpinList.length > 0) {
    return tsvExport({
      req, res, ViewBag, sheet: 'Binary_Level_Income.xls', filename: Filename, rows: AllFreeEpinList, innerProc: 'AllFreeEpinList',
      outerProc: 'USP_LEVELINCOME_REPORTS',
      headers: ['S.No. \t', 'Date \t', 'From UserName \t', 'To UserName \t', 'Investment \t', 'Comm(%) \t', 'Earning \t', 'Admin \t', 'tds \t',
        'Income \t', 'Level\t'],
      cells: (item, w) => {
        for (const k of ['ROWNUMBER', 'DATE', 'FROMUSERNAME', 'TOUSERNAME']) w(tab(toStr(item[k])) + ' \t');
        for (const k of ['AMOUNT', 'COMM_PER', 'TOTALAMOUNT', 'ADMIN_AMT', 'TDS_AMT', 'INCOME']) w(tab(fix2(item[k])) + ' \t');
        w(tab(toStr(item.LEVEL)) + ' \t');
      },
    });
  }
  return false;
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string myquery, string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, string btnexel, string Date, int? IsHold)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/binary-level-income" -> Binary_Level_Income/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/binary-level-income'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = sv(req.p.orderbydate);
  const myquery = sv(req.p.myquery);
  let SearchField = sv(req.p.SearchField);
  let SearchValue = sv(req.p.SearchValue);
  let fromdate = sv(req.p.fromdate);
  let todate = sv(req.p.todate);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  let btnexel = sv(req.p.btnexel);
  const Date_ = sv(req.p.Date);
  let IsHold = nint(req.p.IsHold);
  const ViewBag = {};
  if (myquery !== null) {
    ViewBag.date = netFormat(toDateTime(await UtilityClass.Decryptword(myquery)), 'yyyy-MM-dd');
    fromdate = ViewBag.date;
    todate = ViewBag.date;
  }
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  // binarylevelUrl = Request.Url.ToString(); split('?') => everything after the first '?' is decrypted as a user name
  // PORT-NOTE: the raw (still URL-encoded) query text is used; legacy Uri.ToString() unescaped it. Like legacy, ANY plain query string
  // is passed to Decryptword (legacy threw on non-encrypted text).
  const binarylevelrequesturl = req.originalUrl.split('?');
  let username = '';
  if (binarylevelrequesturl.length >= 2) {
    username = await UtilityClass.Decryptword(binarylevelrequesturl[1]);
    if (username !== '') {
      SearchField = 'TOUSERNAME';
      SearchValue = username;
    }
  }
  if (Date_ !== null) fromdate = await UtilityClass.Decryptword(Date_);
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  let AllFreeEpinList = [];
  try {
    if (ddlcustpage === null) ddlcustpage = 100;
    if (SearchField === null) SearchField = '';
    if (SearchValue === null) SearchValue = '';
    if (fromdate === null) fromdate = '';
    if (todate === null) todate = '';
    if (btnexel === null) btnexel = '';
    if (IsHold === null) IsHold = -1;
    const Empid = req.user.emp_id;
    const perm = await CheckPermissions.GetPageActionPermission(url, Empid);
    ViewBag.isactive = perm._opIsDownloadAllowed;
    ViewBag.isedit = perm._opIsEditAllowed;
    ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_LEVELINCOME_REPORTS', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: String(fromdate).trim(), TODATE: String(todate).trim(), SEARCHFIELD: String(SearchField).trim(),
      SEARCHVALUE: String(SearchValue).trim(), INCOMETYPE: 1, ISHOLD: IsHold,
    });
    AllFreeEpinList = mapRows(rows, PROPS);
    const tc = str(col(rows[0], 'totalcount'));
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    const TOTALINCOMES = toDecimal(str(col(rows[0], 'totalincome')) || 'x'); // decimal.Parse(DBNull.ToString()) => FormatException
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows; ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TOTALINCOMES = TOTALINCOMES;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    if (btnexel === 'Export Excel') {
      if (await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, IsHold)) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Binary_Level_Income/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_LEVELINCOME_REPORTS');
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found")
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, int? IsHold)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, sv(req.p.SearchField), sv(req.p.SearchValue), sv(req.p.fromdate), sv(req.p.todate),
    nint(req.p.page), nint(req.p.ddlcustpage), nint(req.p.IsHold));
  if (!sent) res.send('');
}));

module.exports = router;
