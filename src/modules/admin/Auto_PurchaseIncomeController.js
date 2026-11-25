'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Auto_PurchaseIncomeController.cs (class Auto_PurchaseIncomeController => /Auto_PurchaseIncome/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const CheckPermissions = require('../../lib/admin/CheckPermissions');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const { DB, col, str, sv, nint, toDecimal, toStr, nullRef, tab, netFormat, tsvExport } = require('./_shared/batch03_common');

const router = express.Router();
const C = 'Auto_PurchaseIncome';

/** class GetAutopurchaseIncome */
const PROPS = ['ROWNUMBER', 'USERNAME', 'Name', 'MOBILE', 'DATE', 'ADMINCHARGE', 'TDS', 'NetIncome', 'MatchCount', 'TotalIncome'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (module state). (`private object AllFreeList` unused.)
let url = '';
let url1 = '';

const fix2 = (v) => { if (v === null || v === undefined) nullRef(); return Number(v).toFixed(2); };
const dec = (v) => toDecimal(str(v) || 'x'); // decimal.Parse(Output.Value.ToString()) (DBNull => FormatException)

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, page) {
  const userid = req.user.emp_id;
  const Filename = `Auto_PurchaseIncome${userid}_${netFormat(new Date(), 'ddMMyyyy')}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
  // eslint-disable-next-line no-unused-vars
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  if (SearchField === null || SearchValue === null || fromdate === null || todate === null) nullRef();
  const AllFreeList = mapRows(await db.proc(DB, 'USP_AUTO_PURCHASEINCOME', {
    STARTROWINDEX: page, MAXROWS: 10000000, REGNO: 0, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
    FROMDATE: fromdate.trim(), TODATE: todate.trim(),
  }), PROPS);
  if (AllFreeList.length > 0) {
    return tsvExport({
      req, res, ViewBag, sheet: 'Auto_PurchaseIncome.xls', filename: Filename, rows: AllFreeList, innerProc: 'USP_AUTO_PURCHASEINCOME',
      outerProc: 'USP_AUTO_PURCHASEINCOME',
      headers: ['S.No. \t', 'UserName \t', 'Name \t', 'MobileNo \t', 'Date \t', 'MatchCount \t', 'TotalIncome \t', 'AdminCharge \t', 'TDS \t', 'NetIncome \t'],
      cells: (item, w) => {
        for (const k of ['ROWNUMBER', 'USERNAME', 'Name', 'MOBILE', 'DATE', 'MatchCount']) w(tab(toStr(item[k])) + ' \t');
        for (const k of ['TotalIncome', 'ADMINCHARGE', 'TDS', 'NetIncome']) w(tab(fix2(item[k])) + ' \t');
      },
    });
  }
  return false;
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, string btnexel)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/auto-purchase-income" -> Auto_PurchaseIncome/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/auto-purchase-income'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let SearchField = sv(req.p.SearchField);
  let SearchValue = sv(req.p.SearchValue);
  let fromdate = sv(req.p.fromdate);
  let todate = sv(req.p.todate);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  let btnexel = sv(req.p.btnexel);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (todate === null) todate = '';
  if (btnexel === null) btnexel = '';
  const Empid = req.user.emp_id;
  const perm = await CheckPermissions.GetPageActionPermission(url, Empid);
  ViewBag.isactive = perm._opIsDownloadAllowed;
  ViewBag.isedit = perm._opIsEditAllowed;
  ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_AUTO_PURCHASEINCOME', {
    STARTROWINDEX: page, MAXROWS: MaxRows, REGNO: 0, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
    FROMDATE: fromdate.trim(), TODATE: todate.trim(),
  });
  const AllFreeList = mapRows(rows, PROPS);
  const tc = str(col(rows[0], 'totalcount'));
  const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
  const TOTALNETINCOMES = dec(col(rows[0], 'totalnetincome'));
  const TOTALINCOMES = dec(col(rows[0], 'totalincome'));
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows; ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.TOTALINCOMES = TOTALINCOMES;
  ViewBag.TOTALNETINCOMES = TOTALNETINCOMES;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.ddlcustpage = ddlcustpage;
  if (btnexel === 'Export Excel') {
    if (await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, page)) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Auto_PurchaseIncome/Index.cshtml', Model: AllFreeList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, sv(req.p.SearchField), sv(req.p.SearchValue), sv(req.p.fromdate), sv(req.p.todate), nint(req.p.page));
  if (!sent) res.send('');
}));

module.exports = router;
