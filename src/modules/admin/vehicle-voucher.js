'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Vehicle_Voucher.cs
// (namespace Common.Controllers.AdminPanel, class Vehicle_VoucherController => /admin/Vehicle_Voucher/...)
// Database: affiliate (Db_Affiliate).
//
// Coverage: Index ([SessionExpireCheck]) -> route ; ExportReport (public void => routable) -> route + internal function (used by Index).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');
const { decOf, int0Of, viewJson, sendVoid } = require('./_shared/batch13-11-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Vehicle_Voucher';

// PORT-NOTE: `private static string Url, Url1` - static fields shared by all requests (ExportReport uses the Url of the last Index call).
let Url = '';
let Url1 = '';

/** class GetVehicle_Voucher */
const PROPS = ['ROWNUMBER', 'USERNAME', 'MOBILENO', 'DATE', 'TOTALBV', 'DISTRIBUTEBV', 'TOTALMEMBER', 'TOTALINCOME', 'TDS', 'NETINCOME'];

/** [USP_TRAVELVOUCHER_REPORT] @REGNO,@VOUCHERTYPE,@STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT OUT,
 *  @NETINCOME OUT,@TOTALTDS OUT,@TOTALINCOME OUT */
function voucherProc(Page, MaxRows, SearchField, SearchValue, fromDate, toDate) {
  if (SearchValue === null) throw B.nullRef(); // SearchValue.Trim()
  return db.proc(DB, 'USP_TRAVELVOUCHER_REPORT', {
    REGNO: '0', VOUCHERTYPE: '2', STARTROWINDEX: Page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue.trim(),
    FROMDATE: fromDate, TODATE: toDate,
  });
}

// public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, int? Page, int? ddlcustpage)
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, Page, ddlcustpage) {
  const userid = req.user.emp_id;
  const Filename = 'VehicleVoucherReport' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, Url, Filename);
  const MaxRows = ddlcustpage === null ? 0 : ddlcustpage; // Convert.ToInt32(int?)
  if (Page === null) Page = 1;
  const listVechileVoucher = mapRows(await voucherProc(Page, MaxRows, SearchField, SearchValue, fromDate, toDate), PROPS);
  if (listVechileVoucher.length > 0) {
    const r = await B.writeXlsExport({
      req, res, ViewBag, sheet: 'VehicleVoucher_IncomeReport.xls', Filename,
      headers: ['S.No.', 'Username', 'Mobile No.', 'Date', 'Total BV', 'Distribute BV', 'Total Member', 'Total Income', 'TDS', 'Net Income'],
      rows: listVechileVoucher, innerProc: 'GetReferalIncome', outerProc: 'GetReferalIncome',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.cellStr(item, 'USERNAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'MOBILENO')) + ' \t');
        w(B.tab(B.netFormat(item.DATE, 'dd-MM-yyyy')) + ' \t');
        w(B.tab(B.dec2(item.TOTALBV)) + ' \t');
        w(B.tab(B.dec2(item.DISTRIBUTEBV)) + ' \t');
        w(B.tab(B.cellStr(item, 'TOTALMEMBER')) + ' \t');
        w(B.tab(B.dec2(item.TOTALINCOME)) + ' \t');
        w(B.tab(B.dec2(item.TDS)) + ' \t');
        w(B.tab(B.dec2(item.NETINCOME)) + ' \t');
      },
    });
    // legacy outer catch did NOT overwrite ViewBag.filepath with the exception message: keep the sheet path
    if (!r.sent) ViewBag.filepath = B.mapPath('~/AllExcelSheets/VehicleVoucher_IncomeReport.xls');
    return r;
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? Dynamicpagging, string SearchField, string SearchValue, string fromDate, string toDate, int? Page, int? ddlcustpage, string BtnExcel)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/Vehicle-Voucher-income-report" -> Vehicle_Voucher/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Vehicle-Voucher-income-report{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  Url1 = legacyUrl(req).slice(1);
  Url = '~' + Url1;
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;
  const SearchField = B.s0(req.p.SearchField);
  const SearchValue = B.s0(req.p.SearchValue);
  const fromDate = B.s0(req.p.fromDate);
  const toDate = B.s0(req.p.toDate);
  let Dynamicpagging = B.nInt(req.p.Dynamicpagging);
  if (Dynamicpagging === null) Dynamicpagging = 100;
  const BtnExcel = B.s0(req.p.BtnExcel);
  let Page = B.nInt(req.p.Page);
  const Empid = req.user.emp_id;
  const ViewBag = {};
  const p = await B.perms(Empid, Url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = p.excelactive;
  try {
    const MaxRows = Dynamicpagging;
    if (Page === null) Page = 1;
    const rows = await voucherProc(Page, MaxRows, SearchField, SearchValue, fromDate, toDate);
    const listVehicleVoucher = mapRows(rows, PROPS);
    const TotalRecord = int0Of(rows, 'TOTALCOUNT');
    const TotalAllIncome = decOf(rows, 'TOTALINCOME');
    const TotalNetAllIncome = decOf(rows, 'NETINCOME');
    const TotalSumTds = decOf(rows, 'TOTALTDS');
    ViewBag.CurrentPage = Page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.Dynamicpagging = Dynamicpagging;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TotalAllIncome = TotalAllIncome;
    ViewBag.TotalSumTds = TotalSumTds;
    ViewBag.TotalNetAllIncome = TotalNetAllIncome;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.ddlcustpage = ddlcustpage;
    if (BtnExcel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, Page, ddlcustpage);
      if (r.sent) return undefined;
    }
    return viewJson(res, '~/Views/AdminPanel/Vehicle_Voucher/Index.cshtml', listVehicleVoucher, ViewBag);
  } catch (ExpObj) {
    return B.errorView(req, res, ExpObj, 'USP_DIRECTINCOME_REPORT');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, int? Page, int? ddlcustpage)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => B.nStr(req.p[k]);
  const r = await ExportReport(req, res, {}, v('SearchField'), v('SearchValue'), v('fromDate'), v('toDate'), B.nInt(req.p.Page),
    B.nInt(req.p.ddlcustpage));
  return sendVoid(res, r);
}));

module.exports = router;
