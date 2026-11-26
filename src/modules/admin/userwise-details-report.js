'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Userwise_Details_ReportController.cs (class Userwise_Details_ReportController => /admin/Userwise_Details_Report/...)
// Database: affiliate (Db_Affiliate).
//
// Coverage: Index (session check) -> route ; ExportReport (public void => routable) -> route + internal function (used by Index).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');
const { decOf, int0Of, excelLinkObj, viewJson, sendVoid } = require('./_shared/batch13-11-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Userwise_Details_Report';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** class Userwise_Details */
const PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'MOBILE', 'EMAILID', 'CREDITNOOFVOUCHER', 'REDEEMNOOFVOUCHER', 'TOTALCREDITNOOFVOUCHER',
  'TOTALREDEEMNOOFVOUCHER', 'BALACENOOFVOUCHER', 'RECIEVEDNOOFVOUCHER', 'GIFTNOOFVOUCHER'];

/** [DBO].[USP_USERWISE_DETAILS_REPORT] @STARTROWINDEX,@MAXROWINDEX,@FROMDATE,@TODATE,@SEARCHFIELD,@SEARCHVALUE,@TOTALCOUNT OUT,
 *  @TOTALCREDITNOOFVOUCHER OUT,@TOTALREDEEMNOOFVOUCHER OUT,@TOTALBALACENOOFVOUCHER OUT,@TOTALRECIEVEDNOOFVOUCHER OUT,@TOTALGIFTNOOFVOUCHER OUT */
function reportProc(page, MaxRows, FromDate, ToDate, SearchField, SearchValue) {
  // DB.Database.CommandTimeout = 1000
  return db.proc(DB, 'USP_USERWISE_DETAILS_REPORT', {
    STARTROWINDEX: page, MAXROWINDEX: MaxRows, FROMDATE: FromDate, TODATE: ToDate, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue,
  });
}

// public void ExportReport(int? dynamicpagging, string FromDate, string SearchValue, string SearchField, string ToDate, int? page)
async function ExportReport(req, res, ViewBag, dynamicpagging, FromDate, SearchValue, SearchField, ToDate, page) {
  const userid = req.user.emp_id;
  const Filename = 'Userwise_Details_Report' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const Plid = 1;
  let loginid = '';
  const row = await db.queryOne(DB, 'select username from member_master where regno = @Plid limit 1', { Plid });
  if (row) loginid = B.col(row, 'username');
  void loginid; // (unused, like legacy)
  const MaxRows = dynamicpagging === null ? 0 : dynamicpagging; // Convert.ToInt32(int?)
  if (page === null) page = 1;
  const AllFreeEpinlist = mapRows(await reportProc(page, MaxRows, FromDate, ToDate, SearchField, SearchValue), PROPS);
  if (AllFreeEpinlist.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Userwise_Details_Report.xls', Filename,
      headers: ['Sr.No', 'Username', 'Name', 'Mobile', 'Email', 'No of Voucher Generated', 'No of Voucher Recieved', 'Reddem No of Gift',
        'No of Voucher Used', 'Available No of Voucher'],
      rows: AllFreeEpinlist, innerProc: 'ExportReport', outerProc: 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE',
      cells: (item, w) => {
        w('\n');
        for (const k of ['ROWNUMBER', 'USERNAME', 'NAME', 'MOBILE', 'EMAILID', 'CREDITNOOFVOUCHER', 'RECIEVEDNOOFVOUCHER', 'GIFTNOOFVOUCHER',
          'REDEEMNOOFVOUCHER', 'BALACENOOFVOUCHER']) {
          w(B.tab(B.cellStr(item, k)) + ' \t');
        }
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string FromDate, string SearchValue, string SearchField, string ToDate, int? page, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Userwise-Details-Report" -> Userwise_Details_Report/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Userwise-Details-Report{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  const FromDate = B.s0(req.p.FromDate);
  const ToDate = B.s0(req.p.ToDate);
  const SearchField = B.s0(req.p.SearchField);
  const SearchValue = B.s0(req.p.SearchValue);
  const btnexel = B.s0(req.p.btnexel);
  let page = B.nInt(req.p.page);
  if (dynamicpagging === null) dynamicpagging = 100;
  const ViewBag = {};
  // USP_EXCEL_LINK (outside the try in legacy)
  ViewBag.isactive = await excelLinkObj(url);
  try {
    const MaxRows = dynamicpagging;
    if (page === null) page = 1;
    const rows = await reportProc(page, MaxRows, FromDate, ToDate, SearchField, SearchValue);
    const AllFreeEpinlist = mapRows(rows, PROPS);
    const TotalRecord = int0Of(rows, 'TOTALCOUNT');
    ViewBag.TotalCreditNoofvoucher = decOf(rows, 'TOTALCREDITNOOFVOUCHER');
    ViewBag.TotalReademNoofvoucher = decOf(rows, 'TOTALREDEEMNOOFVOUCHER');
    ViewBag.TotalBlanceNoofvoucher = decOf(rows, 'TOTALBALACENOOFVOUCHER');
    ViewBag.TotalReceivedNoofvoucher = decOf(rows, 'TOTALRECIEVEDNOOFVOUCHER');
    ViewBag.TotalGiftNoofvoucher = decOf(rows, 'TOTALGIFTNOOFVOUCHER');
    ViewBag.CurrentPage = page;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.fromDate = FromDate;
    ViewBag.toDate = ToDate;
    ViewBag.dynamicpagging = dynamicpagging;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, dynamicpagging, FromDate, SearchValue, SearchField, ToDate, page);
      if (r.sent) return undefined;
    }
    return viewJson(res, '~/Views/AdminPanel/Userwise_Details_Report/Index.cshtml', AllFreeEpinlist, ViewBag);
  } catch (ExpObj) {
    return B.errorView(req, res, ExpObj, 'USP_BonusIncomeHistory');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(int? dynamicpagging, string FromDate, string SearchValue, string SearchField, string ToDate, int? page)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nInt(req.p.dynamicpagging), B.nStr(req.p.FromDate), B.nStr(req.p.SearchValue),
    B.nStr(req.p.SearchField), B.nStr(req.p.ToDate), B.nInt(req.p.page));
  return sendVoid(res, r);
}));

module.exports = router;
