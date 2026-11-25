'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Daily_Voucher_ReportController.cs
// (class Daily_Voucher_ReportController => /admin/Daily_Voucher_Report/...)
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
const C = 'Daily_Voucher_Report';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests. (`private string regno` is unused.)
let url = '';
let url1 = '';

/** class DailyVoucher */
const DV_PROPS = ['RowNumber', 'DATE', 'CREDITNOOFVOUCHER', 'REDEEMNOOFVOUCHER', 'TOTALCREDITNOOFVOUCHER', 'TOTALREDEEMNOOFVOUCHER',
  'BALACENOOFVOUCHER', 'RECIEVEDNOOFVOUCHER', 'GIFTNOOFVOUCHER'];

/** decimal.Parse(<scale-0 decimal OUT>.Value.ToString()) : DBNull "" => FormatException */
function decParse0(row, name) {
  const v = B.col(row, name);
  if (v === null || v === undefined || v === '') throw new Error('Input string was not in a correct format.');
  return Math.round(Number(v));
}

/** public void ExportReport(string fromDate, string toDate, int? page, int? dynamicpagging) */
async function ExportReport(req, res, ViewBag, fromDate, toDate, page, dynamicpagging) {
  const userid = req.user.emp_id;
  const Filename = 'Daily_Voucher_Report' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = dynamicpagging === null || dynamicpagging === undefined ? 0 : Number(dynamicpagging);
  if (page === null || page === undefined) page = 1;
  const Plid = 1;
  let loginid = '';
  const row = await db.queryOne(DB, 'select username from member_master where regno = @Plid limit 1', { Plid });
  if (row !== null) loginid = row.username;
  void loginid; // unused (legacy)
  // DBO.Usp_Daily_VOUCHER_REPORT ... @TOTALCREDIT OUT,@TOTALDEBIT OUT (CommandTimeout 1000 s => pg pool timeout)
  const AllFreeEpinlist = mapRows(await db.proc(DB, 'Usp_Daily_VOUCHER_REPORT', {
    StartRowIndex: page, MaxRowIndex: MaxRows, FROM: fromDate, TO: toDate,
  }), DV_PROPS);
  if (AllFreeEpinlist.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Daily_Voucher_Report.xls', Filename,
      headers: ['Sr.No', 'Date', 'No of Voucher Generated', 'No of Voucher Recieved', 'Reddem No of Gift', 'No of Voucher Used', 'Available No of Voucher'],
      rows: AllFreeEpinlist, innerProc: 'ExportReport', outerProc: 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'RowNumber')) + ' \t');
        w(B.tab(item.DATE === null ? '01-Jan-0001' : B.netFormat(item.DATE, 'dd-MMM-yyyy')) + ' \t'); // Convert.ToDateTime(null) => MinValue
        for (const k of ['CREDITNOOFVOUCHER', 'RECIEVEDNOOFVOUCHER', 'GIFTNOOFVOUCHER', 'TOTALCREDITNOOFVOUCHER', 'BALACENOOFVOUCHER']) {
          w(B.tab(B.cellStr(item, k)) + ' \t');
        }
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string fromDate, string toDate, int? page, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Daily-Voucher-Report" -> Daily_Voucher_Report/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Daily-Voucher-Report'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let page = B.nInt(req.p.page);
  let btnexel = B.nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (btnexel === null) btnexel = '';
  const Empid = req.user.emp_id;
  const ViewBag = {};
  Object.assign(ViewBag, await B.perms(Empid, url)); // CheckPermissions
  // USP_EXCEL_LINK @url,@ISACTIVE out => ViewBag.isactive = Convert.ToInt32(Value) (DBNull => InvalidCastException)
  const xl = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const xv = B.col(xl, 'isactive');
  if (xv === null || xv === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  ViewBag.isactive = Number(xv);
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'Usp_Daily_VOUCHER_REPORT', { StartRowIndex: page, MaxRowIndex: MaxRows, FROM: fromDate, TO: toDate });
    const AllFreeEpinlist = mapRows(rows, DV_PROPS);
    // PORT-NOTE: OUT params read from the first result row (no row => 0); scale-0 decimal OUT params (rounded); NULL => FormatException like DBNull.
    const r0 = rows[0] || { totalcount: 0, totalcreditnoofvoucher: 0, totalredeemnoofvoucher: 0, totalbalacenoofvoucher: 0, totalrecievednoofvoucher: 0, totalgiftnoofvoucher: 0 };
    const tc = B.str(B.col(r0, 'totalcount'));
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    ViewBag.TotalCreditNoofvoucher = decParse0(r0, 'totalcreditnoofvoucher');
    ViewBag.TotalReademNoofvoucher = decParse0(r0, 'totalredeemnoofvoucher');
    ViewBag.TotalBlanceNoofvoucher = decParse0(r0, 'totalbalacenoofvoucher');
    ViewBag.TotalReceivedNoofvoucher = decParse0(r0, 'totalrecievednoofvoucher');
    ViewBag.TotalGiftNoofvoucher = decParse0(r0, 'totalgiftnoofvoucher');
    ViewBag.CurrentPage = page;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.dynamicpagging = dynamicpagging;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, fromDate, toDate, page, dynamicpagging);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Daily_Voucher_Report/Index.cshtml', Model: AllFreeEpinlist, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_BonusIncomeHistory');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, int? page, int? dynamicpagging)
// auth (public method => routable; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.fromDate), B.nStr(req.p.toDate), B.nInt(req.p.page), B.nInt(req.p.dynamicpagging));
  if (!r.sent) res.send('');
}));

module.exports = router;
