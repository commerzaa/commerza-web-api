'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Daily_Voucher_DetailsController.cs
// (class Daily_Voucher_DetailsController => /admin/Daily_Voucher_Details/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Daily_Voucher_Details';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** class DailyVoucher_Details */
const DVD_PROPS = ['ROWNUMBER', 'FULLNAME', 'USERNAME', 'FROMUSERNAME', 'EMAILID', 'MOBILE', 'KID', 'COUPONNO', 'CREATEDATE', 'USEDDATE', 'USEDIP',
  'ACTIVE', 'STATUS', 'LEVEL', 'ISHOLD', 'TYPE', 'REMARK', 'DATE', 'TRANSACTION_ID'];

/** Convert.ToDateTime(string).ToString("dd-MMM-yyyy") (null => DateTime.MinValue) */
function dmy(s) {
  if (s === null || s === undefined) return '01-Jan-0001';
  return B.netFormat(s, 'dd-MMM-yyyy');
}

/** public void ExportReport(int? dynamicpagging, string SearchField, string Searchvalue, string Datetype, string fromDate, string toDate, int? Status, int? page) */
async function ExportReport(req, res, ViewBag, dynamicpagging, SearchField, Searchvalue, Datetype, fromDate, toDate, Status, page) {
  const userid = req.user.emp_id;
  const Filename = 'Daily_Voucher_DetailsReport' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = dynamicpagging === null || dynamicpagging === undefined ? 0 : Number(dynamicpagging);
  if (page === null || page === undefined) page = 1;
  // [DBO].[USP_Daily_Voucher_DetailsReport] without @INCOMETYPE (legacy export) - CommandTimeout 1000 s => pg pool timeout
  const AllFreeEpinlist = mapRows(await db.proc(DB, 'USP_Daily_Voucher_DetailsReport', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: Searchvalue, DATETYPE: Datetype, FROMDATE: fromDate,
    TODATE: toDate, STATUS: Status,
  }), DVD_PROPS);
  if (AllFreeEpinlist.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Daily_Voucher_DetailsReport.xls', Filename,
      headers: ['Sr.No', 'Name', 'User Name', 'FromUser Name', 'Email ID', 'Mobile', 'Coupon No', 'Created Date', 'Used Date', 'Remark', 'Status'],
      rows: AllFreeEpinlist, innerProc: 'ExportReport', outerProc: 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE',
      cells: (item, w) => {
        w('\n');
        for (const k of ['ROWNUMBER', 'FULLNAME', 'USERNAME', 'FROMUSERNAME', 'EMAILID', 'MOBILE', 'COUPONNO']) w(B.tab(B.cellStr(item, k)) + ' \t');
        w(B.tab(dmy(item.CREATEDATE)) + ' \t');
        w(B.tab(dmy(item.USEDDATE)) + ' \t');
        w(B.tab(B.cellStr(item, 'REMARK')) + ' \t');
        if (Number(item.ACTIVE) === 1) w(B.tab('Active') + ' \t');
        else if (Number(item.ACTIVE) === 0) w(B.tab('Used') + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? type, int? dynamicpagging, string IncomeType, string SearchField, string Searchvalue, string Datetype, string fromDate, string toDate, int? Status, int? page, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Daily-Voucher-Details-Report" -> Daily_Voucher_Details/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Daily-Voucher-Details-Report'], adminAuth, asyncHandler(async (req, res) => {
  const type = B.nInt(req.p.type);
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let IncomeType = B.nStr(req.p.IncomeType);
  let SearchField = B.nStr(req.p.SearchField);
  let Searchvalue = B.nStr(req.p.Searchvalue);
  let Datetype = B.nStr(req.p.Datetype);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let Status = B.nInt(req.p.Status);
  let page = B.nInt(req.p.page);
  let btnexel = B.nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (type === 1) {
    SearchField = 'USERNAME';
    Searchvalue = await UtilityClass.Decryptword(Searchvalue);
  }
  fromDate = await UtilityClass.Decryptword(fromDate);
  toDate = await UtilityClass.Decryptword(toDate);
  Datetype = await UtilityClass.Decryptword(Datetype);
  IncomeType = await UtilityClass.Decryptword(IncomeType);
  if (dynamicpagging === null) dynamicpagging = 100;
  if (IncomeType === null || IncomeType === undefined) IncomeType = '';
  if (fromDate === null || fromDate === undefined) fromDate = '';
  if (SearchField === null) SearchField = '';
  if (Searchvalue === null || Searchvalue === undefined) Searchvalue = '';
  if (Datetype === null || Datetype === undefined) Datetype = '';
  if (toDate === null || toDate === undefined) toDate = '';
  if (Status === null) Status = -1;
  if (btnexel === null) btnexel = '';
  const ViewBag = {};
  // USP_EXCEL_LINK @url,@ISACTIVE out => Convert.ToInt32(Value) (DBNull => InvalidCastException)
  const xl = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const xv = B.col(xl, 'isactive');
  if (xv === null || xv === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  ViewBag.isactive = Number(xv);
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_Daily_Voucher_DetailsReport', {
      STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: Searchvalue, DATETYPE: Datetype, FROMDATE: fromDate,
      TODATE: toDate, STATUS: Status, INCOMETYPE: IncomeType,
    });
    const AllFreeEpinlist = mapRows(rows, DVD_PROPS);
    // PORT-NOTE: @TOTALCOUNT OUT read from the first result row ("" => 0).
    const tc = B.str(B.col(rows[0] || null, 'totalcount'));
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    ViewBag.CurrentPage = page;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = Searchvalue;
    ViewBag.Datetype = Datetype;
    ViewBag.Status = Status;
    ViewBag.dynamicpagging = dynamicpagging;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, dynamicpagging, SearchField, Searchvalue, Datetype, fromDate, toDate, Status, page);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Daily_Voucher_Details/Index.cshtml', Model: AllFreeEpinlist, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_BonusIncomeHistory');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(int? dynamicpagging, string SearchField, string Searchvalue, string Datetype, string fromDate, string toDate, int? Status, int? page)
// auth (public method => routable; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const s = (k) => B.nStr(req.p[k]);
  const r = await ExportReport(req, res, {}, B.nInt(req.p.dynamicpagging), s('SearchField'), s('Searchvalue'), s('Datetype'), s('fromDate'), s('toDate'),
    B.nInt(req.p.Status), B.nInt(req.p.page));
  if (!r.sent) res.send('');
}));

module.exports = router;
