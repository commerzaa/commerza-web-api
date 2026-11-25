'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Auto_Matrix_Downline.cs (class Auto_Matrix_DownlineController => /Auto_Matrix_Downline/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const CheckPermissions = require('../../lib/admin/CheckPermissions');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const { DB, col, str, sv, nint, toInt32, toStr, nullRef, tab, nowStamp, excelLink, tsvExport } = require('./_shared/batch03-common');

const router = express.Router();
const C = 'Auto_Matrix_Downline';

/** class ForceMatricsList (Controllers/AdminPanel/Force_Matrics_Downline.cs) */
const PROPS = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC',
  'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName',
  'LCount', 'RCount', 'SideName', 'TITLE'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (module state). (`ExcelList` field unused.)
let url = '';
let url1 = '';

/** db._Member_Master.Where(a => a.regNo == 1).FirstOrDefault()?.userName ?? "" */
async function rootLoginId() {
  const row = await db.queryOne(DB, 'select username from member_master where regno = @Plid limit 1', { Plid: 1 });
  return row ? col(row, 'username') : '';
}

/** public void ExportReport(int? dynamicpagging, string fromdate, string btnexel, string todate, string SearchValue, string SearchField, string SponserID, int? page, string Name, int? Side, string Level, string ActivationStatus) */
async function ExportReport(req, res, ViewBag, dynamicpagging, fromdate, btnexel, todate, SearchValue, SearchField, SponserID, page, Name, Side, Level) {
  const userid = req.user.emp_id;
  const Filename = `Auto_Matrix_Downline${userid}_${nowStamp()}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
  const loginid = await rootLoginId();
  const MaxRows = 10000;
  if (page === null) page = 1;
  if (fromdate === null || todate === null || SponserID === null) nullRef();
  const ForceMatricsList = mapRows(await db.proc(DB, 'USP_FORCEMATRICS', {
    LoginID: loginid, StartRowIndex: page, MaxRows, SearchField, SearchValue, fromDate: fromdate.trim(), ToDate: todate.trim(),
    levenumber: toInt32(Level === '' ? '0' : Level), side: Side, Name: '', Username: '', EmailID: '', SponserID: SponserID.trim(),
    CheckAdminSide: 0, ActivationStatus: 0,
  }), PROPS);
  if (ForceMatricsList.length > 0) {
    return tsvExport({
      req, res, ViewBag, sheet: 'Auto_Matrix_Downline.xls', filename: Filename, rows: ForceMatricsList, innerProc: 'ExportReport', outerProc: 'USP_FORCEMATRICS',
      headers: ['S.No. \t', 'Name \t', 'Username \t', 'Sponsor  \t', 'Parent \t', 'Joining Date \t', 'Activation  Date \t', 'Level \t'],
      cells: (item, w) => {
        for (const k of ['rownumber', 'Name', 'userName', 'spounser_userName', 'root_userName', 'RegDate', 'DOC']) w(tab(toStr(item[k])) + ' \t');
      },
    });
  }
  return false;
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string fromdate, string btnexel, string todate, string SearchValue, string SearchField, string SponserID, int? page, string Name, int? Side, string Level, string ActivationStatus)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Auto-Matrix-Downline" -> Auto_Matrix_Downline/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Auto-Matrix-Downline'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let fromdate = sv(req.p.fromdate);
  let btnexel = sv(req.p.btnexel);
  let todate = sv(req.p.todate);
  let SearchValue = sv(req.p.SearchValue);
  let SearchField = sv(req.p.SearchField);
  let SponserID = sv(req.p.SponserID);
  let page = nint(req.p.page);
  let Name = sv(req.p.Name);
  let Side = nint(req.p.Side);
  let Level = sv(req.p.Level);
  let ActivationStatus = sv(req.p.ActivationStatus);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (btnexel === null) btnexel = '';
  if (SearchValue === null) SearchValue = '';
  if (SearchField === null) SearchField = '';
  if (SponserID === null) SponserID = '';
  if (Name === null) Name = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (Side === null) Side = 0;
  if (Level === null) Level = '';
  if (ActivationStatus === null) ActivationStatus = '0';
  ViewBag.excelactive = await excelLink(url);
  const Empid = req.user.emp_id;
  const perm = await CheckPermissions.GetPageActionPermission(url, Empid);
  ViewBag.isactive = perm._opIsDownloadAllowed;
  ViewBag.isedit = perm._opIsEditAllowed;
  ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
  const loginid = await rootLoginId();
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_FORCEMATRICS', {
    LoginID: loginid, StartRowIndex: page, MaxRows, SearchField, SearchValue, fromDate: fromdate.trim(), ToDate: todate.trim(),
    levenumber: toInt32(Level === '' ? '0' : Level), side: Side, Name: Name.trim(), Username: '', EmailID: '', SponserID: SponserID.trim(),
    CheckAdminSide: 0, ActivationStatus: toInt32(ActivationStatus),
  });
  const ForceMatricsList = mapRows(rows, PROPS);
  const TotalRecord = toInt32(str(col(rows[0], 'totalcount')) || 'x'); // int.Parse(DBNull.ToString()) => FormatException
  ViewBag.CurrentPage = page;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.side = Side;
  ViewBag.SponserID = SponserID;
  ViewBag.Level = Level;
  ViewBag.ActivationStatus = ActivationStatus;
  if (btnexel === 'Export Excel') {
    if (await ExportReport(req, res, ViewBag, dynamicpagging, fromdate, btnexel, todate, SearchValue, SearchField, SponserID, page, Name, Side, Level)) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Auto_Matrix_Downline/Index.cshtml', Model: ForceMatricsList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...12 params...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, nint(req.p.dynamicpagging), sv(req.p.fromdate), sv(req.p.btnexel), sv(req.p.todate),
    sv(req.p.SearchValue), sv(req.p.SearchField), sv(req.p.SponserID), nint(req.p.page), sv(req.p.Name), nint(req.p.Side), sv(req.p.Level));
  if (!sent) res.send('');
}));

module.exports = router;
