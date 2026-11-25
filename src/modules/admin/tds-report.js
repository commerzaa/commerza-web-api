'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\TDSReport.cs (class TDSReportController => /admin/TDSReport/...)
// Database: affiliate (Db_Affiliate). Procs: USP_TDS_INCOME_REPORT, USP_EXCEL_DOWNLOAD_HISTORY. Table member_master.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const CheckPermissions = require('../../lib/admin/CheckPermissions');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, cellStr, tab, nowStamp, excelHistory, writeXlsExport, dec2, cvtInt, trimS,
} = require('./_shared/batch11-common');
const { viewRes, outStrictInt, outStrictDec, rootLoginId } = require('./_shared/batch13-08-common');

const router = express.Router();
const C = 'TDSReport';

/** class TDSReport */
const TDS_PROPS = ['ROWNUMBERS', 'USERNAME', 'NAME', 'REGDATE', 'DOC', 'ADMINCHARGE', 'TDS', 'KYCSTATUS'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests. `private List<TDSReport> ExcelList` is never used.
let url = '';
let url1 = '';

// public void ExportReport(string SearchField, string SearchValue, string KYCSTATUS, string fromdate, string todate)
async function ExportReport(req, res, SearchField, SearchValue, KYCSTATUS, fromdate, todate, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'TDSReport' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const loginid = await rootLoginId();
  const MaxRows = 50; void MaxRows; // Convert.ToInt32(50) (unused)
  // USP_TDS_INCOME_REPORT @LOGINID,...,@KYCSTATUS,@TotalCount out,@TOTALADMINCHARGE out,@TOTALTDS out  (no @orderbydate => default)
  const LRMember = mapRows(await db.proc(DB, 'USP_TDS_INCOME_REPORT', {
    LOGINID: loginid, STARTROWINDEX: 1, MAXROWS: 999999, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: trimS(fromdate),
    TODATE: trimS(todate), KYCSTATUS: trimS(KYCSTATUS),
  }), TDS_PROPS);
  if (LRMember.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'All_TDS.List.xls', Filename,
      headers: ['s.No.', 'USERNAME', 'NAME', 'REGISTRATIONDATE', 'ACTIVATIONDATE', 'Amount', 'ADMINCHARGE'],
      rows: LRMember,
      innerProc: 'TDSReport',
      outerProc: 'USP_TDS_INCOME_REPORT',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBERS')) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(cellStr(item, 'NAME')) + ' \t');
        w(tab(cellStr(item, 'REGDATE')) + ' \t');
        w(tab(cellStr(item, 'DOC')) + ' \t');
        w(tab(dec2(item.TDS)) + ' \t');
        w(tab(dec2(item.ADMINCHARGE)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string KYCSTATUS, string fromdate, string todate, int? page, string btnexel)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/TDS-Income-Report" -> TDSReport/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/TDS-Income-Report'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const d = (k, def) => { const v = nStr(req.p[k]); return v === null ? def : v; };
  const SearchField = d('SearchField', '');
  const SearchValue = d('SearchValue', '');
  const fromdate = d('fromdate', '');
  let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
  const orderbydate = d('orderbydate', '');
  const todate = d('todate', '');
  const btnexel = d('btnexel', '');
  const KYCSTATUS = d('KYCSTATUS', '0');
  let page = nInt(req.p.page);
  const ViewBag = {};
  const Empid = req.user.emp_id;
  const perm = await CheckPermissions.GetPageActionPermission(url, Empid);
  ViewBag.isactive = perm._opIsDownloadAllowed;
  ViewBag.isedit = perm._opIsEditAllowed;
  ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
  const loginid = await rootLoginId(); // db._Member_Master.Where(a => a.regNo == 1)
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_TDS_INCOME_REPORT', {
    LOGINID: loginid, STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: fromdate.trim(),
    TODATE: todate.trim(), KYCSTATUS: cvtInt(KYCSTATUS), orderbydate: orderbydate.trim(),
  });
  const LRMember = mapRows(rows, TDS_PROPS);
  const TotalRecord = outStrictInt(rows, 'TOTALCOUNT');
  const TOTALAdminCharge = outStrictDec(rows, 'TOTALADMINCHARGE');
  const TOTALTDSCharge = outStrictDec(rows, 'TOTALTDS');
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.TOTALAdminCharge = TOTALAdminCharge;
  ViewBag.TOTALTDSCharge = TOTALTDSCharge;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, SearchField, SearchValue, KYCSTATUS, fromdate, todate, ViewBag);
    if (r.sent) return undefined;
  }
  return viewRes(res, '~/Views/AdminPanel/TDSReport/Index.cshtml', LRMember, ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.KYCSTATUS), nStr(req.p.fromdate),
    nStr(req.p.todate), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
