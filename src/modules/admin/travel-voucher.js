'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Travel_VoucherController.cs
// (class Common.Controllers.AdminPanel.Travel_VoucherController => /admin/Travel_Voucher/...)
// Database: affiliate (Db_Affiliate).
const path = require('path');
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');
const { supplied, outDecStrict, tsvFile, XLS_DIR } = require('./_shared/batch13-09-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Travel_Voucher';

// PORT-NOTE: `private static string Url, Url1` - static fields shared by all requests.
let Url = '';
let Url1 = '';

/** class GetTravel_Voucher */
const PROPS = ['ROWNUMBER', 'USERNAME', 'MOBILENO', 'DATE', 'TOTALBV', 'DISTRIBUTEBV', 'TOTALMEMBER', 'TOTALINCOME', 'TDS', 'NETINCOME'];

/** [USP_TRAVELVOUCHER_REPORT] @REGNO,@VOUCHERTYPE,...,@TOTALCOUNT OUT,@NETINCOME OUT,@TOTALTDS OUT,@TOTALINCOME OUT */
const report = (Page, MaxRows, SearchField, SearchValue, fromDate, toDate) => db.proc(DB, 'USP_TRAVELVOUCHER_REPORT', supplied({
  REGNO: '0', VOUCHERTYPE: '1', STARTROWINDEX: Page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: B.trimS(SearchValue),
  FROMDATE: fromDate, TODATE: toDate,
}));

/** public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, int? Page, int? ddlcustpage) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, Page, ddlcustpage) {
  const userid = req.user.emp_id;
  const Filename = 'TravelVoucherReport' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, Url, Filename);
  const MaxRows = B.cvtInt(ddlcustpage); // Convert.ToInt32(int?) : null => 0
  if (Page === null) Page = 1;
  const listTravelVoucher = mapRows(await report(Page, MaxRows, SearchField, SearchValue, fromDate, toDate), PROPS);
  if (listTravelVoucher.length > 0) {
    return tsvFile({
      req, res, ViewBag, filepath: path.join(XLS_DIR(), 'TravelVoucher_IncomeReport.xls'),
      header: 'S.No. \tUsername \tMobile No. \tDate \tTotal BV \tDistribute BV \tTotal Member \tTotal Income \tTDS \tNet Income \t',
      rows: listTravelVoucher,
      innerProc: 'GetReferalIncome',
      outerProc: 'GetReferalIncome',
      outerSetsFilepath: false, // (legacy outer catch did not touch ViewBag.filepath)
      copyFilename: Filename,
      download: 'TravelVoucher_IncomeReport.xls',
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
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? Dynamicpagging, string SearchField, string SearchValue, string fromDate, string toDate, int? Page, int? ddlcustpage, string BtnExcel)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/Travel-Voucher-income-report" -> Travel_Voucher/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Travel-Voucher-income-report'], adminAuth, asyncHandler(async (req, res) => {
  let Dynamicpagging = B.nInt(req.p.Dynamicpagging);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let Page = B.nInt(req.p.Page);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  let BtnExcel = B.nStr(req.p.BtnExcel);

  Url1 = legacyUrl(req).slice(1);
  Url = '~' + Url1;
  const ViewBag = {};
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (Dynamicpagging === null) Dynamicpagging = 100;
  if (BtnExcel === null) BtnExcel = '';
  const Empid = req.user.emp_id;
  Object.assign(ViewBag, await B.perms(Empid, Url));
  try {
    const MaxRows = Number(Dynamicpagging);
    if (Page === null) Page = 1;
    const rows = await report(Page, MaxRows, SearchField, SearchValue, fromDate, toDate);
    const listTravelVoucher = mapRows(rows, PROPS);
    const TotalRecord = B.outIntOf(rows, 'totalcount'); // int.Parse(v == "" ? "0" : v)
    const TotalAllIncome = outDecStrict(rows, 'totalincome'); // decimal.Parse(...)
    const TotalNetAllIncome = outDecStrict(rows, 'netincome');
    const TotalSumTds = outDecStrict(rows, 'totaltds');
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
    return res.json({ view: '~/Views/AdminPanel/Travel_Voucher/Index.cshtml', Model: listTravelVoucher, ...ViewBag });
  } catch (ExpObj) {
    return B.errorView(req, res, ExpObj, 'USP_DIRECTINCOME_REPORT');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, int? Page, int? ddlcustpage)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue), B.nStr(req.p.fromDate),
    B.nStr(req.p.toDate), B.nInt(req.p.Page), B.nInt(req.p.ddlcustpage));
  if (!r.sent) res.send('');
}));

module.exports = router;
