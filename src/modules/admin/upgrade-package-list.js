'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Upgrade_package_List.cs (class Upgrade_package_ListController => /admin/Upgrade_package_List/...)
// Database: affiliate (Db_Affiliate). Procs Usp_Upgrade_package_list, USP_EXCEL_DOWNLOAD_HISTORY.
// Config: DynamicPagging
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, perms, nowStamp, excelHistory, writeXlsExport, cellStr, tab, dec2, cvtInt,
} = require('./_shared/batch11-common');
const { strictIntOut, strictDecOut, cvtInt16 } = require('./_shared/batch13-10-common');

const router = express.Router();
const C = 'Upgrade_package_List';

/** class Upgrade_package_List */
const UPGRADE_PACKAGE_LIST_PROPS = ['rownumber', 'URID', 'OldTitle', 'OldPrice', 'NewTitle', 'NewPrice', 'TotalPayble', 'Status', 'Paymode', 'username', 'Date'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** public void ExportReport(string SearchField, string SearchValue, string status, string fromDate, string toDate) */
async function ExportReport(req, res, SearchField, SearchValue, status, fromDate, toDate, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Upgrade_Package_List_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); // eslint-disable-line no-unused-vars
  if (SearchField === null || SearchValue === null) throw new Error('Object reference not set to an instance of an object.');
  // Usp_Upgrade_package_list @regNo,@StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@toDate,@status,@TotalCount out,@TotalPayable out
  const list = mapRows(await db.proc(DB, 'Usp_Upgrade_package_list', {
    Regno: 0, StartRowIndex: 1, MaxRows: 999999, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(), fromDate, ToDate: toDate, status,
  }), UPGRADE_PACKAGE_LIST_PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'Upgrade_Package_List.xls', Filename, ViewBag, rows: list,
      headers: ['S.No.', 'Username', 'Date', 'Old Package', 'New Package', 'Net Amount', 'PayMode'],
      innerProc: 'Upgrade_Package_List', outerProc: 'Usp_TransferFundToUser',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'rownumber')) + ' \t');
        w(tab(cellStr(item, 'username')) + ' \t');
        w(tab(cellStr(item, 'Date')) + ' \t');
        w(tab(dec2(item.OldPrice)) + ' \t');
        w(tab(dec2(item.NewPrice)) + ' \t');
        w(tab(dec2(item.TotalPayble)) + ' \t');
        w(tab(cellStr(item, 'Paymode')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField,
//   string btnexel, string SearchValue, string status, int? page, string fromDate, string toDate)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/Upgrade-package-List" -> Upgrade_package_List/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Upgrade-package-List'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let btnexel = nStr(req.p.btnexel);
  let SearchValue = nStr(req.p.SearchValue);
  let status = nStr(req.p.status);
  let page = nInt(req.p.page);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id; // eslint-disable-line no-unused-vars
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging;
    dynamicpagging = cvtInt16(value === undefined ? null : value);
  }
  if (orderbydate === null) orderbydate = '';
  const Empid = req.user.emp_id;
  const ViewBag = {};
  const p = await perms(Empid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = p.excelactive;
  const MaxRows = cvtInt(dynamicpagging);
  if (SearchField === null) SearchField = '';
  if (btnexel === null) btnexel = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (page === null) page = 1;
  if (status === null) status = '';
  // Usp_Upgrade_package_list @regNo,@StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@toDate,@status,@TotalCount out,@TotalPayable out,@orderbydate
  const rows = await db.proc(DB, 'Usp_Upgrade_package_list', {
    Regno: 0, StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(), fromDate, ToDate: toDate, status,
    orderbydate,
  });
  const Allpackage_requestList = mapRows(rows, UPGRADE_PACKAGE_LIST_PROPS);
  const TotalRecord = strictIntOut(rows, 'TotalCount');
  // PORT-NOTE: @TotalPayable is DECIMAL(18,8) in the proc but the C# OUT SqlParameter was BigInt => value truncated to an integer.
  const TOTALBINARYS = Math.trunc(strictDecOut(rows, 'TotalPayable'));
  ViewBag.TOTALNetAmount = TOTALBINARYS;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.status = status;
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.orderbydate = orderbydate;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.servicetax = 0;
  if (btnexel === 'Export Excel') {
    const x = await ExportReport(req, res, SearchField, SearchValue, status, fromDate, toDate, ViewBag);
    if (x.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Upgrade_package_List/Index.cshtml', Model: Allpackage_requestList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string status, string fromDate, string toDate)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.status), nStr(req.p.fromDate),
    nStr(req.p.toDate), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

module.exports = router;
