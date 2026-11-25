'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\House_Voucher.cs
// (class Common.Controllers.AdminPanel.House_VoucherController => /admin/House_Voucher/...). Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch08-common');
const P = require('./_shared/batch08-b-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'House_Voucher';

/** class GetHouse_Voucher */
const HOUSE_VOUCHER_PROPS = ['ROWNUMBER', 'USERNAME', 'MOBILENO', 'DATE', 'TOTALBV', 'DISTRIBUTEBV', 'TOTALMEMBER', 'TOTALINCOME', 'TDS', 'NETINCOME'];

// PORT-NOTE: `private static string Url, Url1` - static fields shared by all requests (kept as module state).
let Url = '';
let Url1 = '';

/** [USP_TRAVELVOUCHER_REPORT] @REGNO,@VOUCHERTYPE,@STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT OUT,@NETINCOME OUT,@TOTALTDS OUT,@TOTALINCOME OUT */
async function travelVoucherReport(Page, MaxRows, SearchField, SearchValue, fromDate, toDate) {
  if (SearchValue === null || SearchValue === undefined) throw B.nullRef(); // SearchValue.Trim()
  return db.proc(DB, 'USP_TRAVELVOUCHER_REPORT', {
    REGNO: '0', VOUCHERTYPE: '3', STARTROWINDEX: Page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: String(SearchValue).trim(),
    FROMDATE: fromDate, TODATE: toDate,
  });
}

/** public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, int? Page, int? ddlcustpage) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, Page, ddlcustpage) {
  const userid = req.user.emp_id;
  const Filename = 'HouseVoucherReport' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, Url, Filename);
  const MaxRows = ddlcustpage === null ? 0 : Number(ddlcustpage); // Convert.ToInt32(int?)
  if (Page === null) Page = 1;
  const listHouseVoucher = mapRows(await travelVoucherReport(Page, MaxRows, SearchField, SearchValue, fromDate, toDate), HOUSE_VOUCHER_PROPS);
  if (listHouseVoucher.length > 0) {
    const vb = {};
    const r = await B.writeXlsExport({
      req, res, ViewBag: vb, sheet: 'HouseVoucher_IncomeReport.xls', Filename,
      headers: ['S.No.', 'Username', 'Mobile No.', 'Date', 'Total BV', 'Distribute BV', 'Total Member', 'Total Income', 'TDS', 'Net Income'],
      rows: listHouseVoucher,
      innerProc: 'GetReferalIncome',
      outerProc: 'GetReferalIncome',
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
    // legacy outer catch only logged (ViewBag.filepath stays the sheet path)
    ViewBag.filepath = B.mapPath('~/AllExcelSheets/HouseVoucher_IncomeReport.xls');
    return r;
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? Dynamicpagging, string SearchField, string SearchValue, string fromDate, string toDate, int? Page, int? ddlcustpage, string BtnExcel)
// auth ([SessionExpireCheck], reads Session["Admin_User"])
// route-config: "AdminPanel/House-Voucher-income-report" -> House_Voucher/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/House-Voucher-income-report'], adminAuth, asyncHandler(async (req, res) => {
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
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (Dynamicpagging === null) Dynamicpagging = 100;
  if (BtnExcel === null) BtnExcel = '';
  const ViewBag = {};
  const Empid = req.user.emp_id;
  const perm = await B.perms(Empid, Url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = perm.excelactive;
  try {
    const MaxRows = Number(Dynamicpagging);
    if (Page === null) Page = 1;
    const rows = await travelVoucherReport(Page, MaxRows, SearchField, SearchValue, fromDate, toDate);
    const listHouseVoucher = mapRows(rows, HOUSE_VOUCHER_PROPS);
    const TotalRecord = P.outIntOr0(rows[0], 'TOTALCOUNT');
    const TotalAllIncome = P.outDec(rows[0], 'TOTALINCOME');
    const TotalNetAllIncome = P.outDec(rows[0], 'NETINCOME');
    const TotalSumTds = P.outDec(rows[0], 'TOTALTDS');
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
      // PORT-NOTE: legacy Response.Redirect to the sheet ended the request; the file is sent directly instead.
      const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, Page, ddlcustpage);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/House_Voucher/Index.cshtml', Model: listHouseVoucher, ...ViewBag });
  } catch (ExpObj) {
    return B.errorView(req, res, ExpObj, 'USP_DIRECTINCOME_REPORT');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue), B.nStr(req.p.fromDate), B.nStr(req.p.toDate),
    B.nInt(req.p.Page), B.nInt(req.p.ddlcustpage));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
