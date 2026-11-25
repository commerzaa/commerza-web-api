'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Luxury_Fund.cs (class Luxury_FundController => /Luxury_Fund/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert, issueAdminToken } = require('./_shared/adminSession');
const {
  DB, nInt, nStr, s0, outOf, excelHistory, nowStamp, writeXlsExport, tab, cellStr, netFormat, col, nullRef,
} = require('./_shared/batch09_common');

const router = express.Router();
const C = 'Luxury_Fund';

/** class CarFund (Controllers/AdminPanel/CarFund.cs) */
const CARFUND = ['RowNumber', 'USERNAME', 'FromUsername', 'Month', 'TOTALSELFBV', 'GROUPBV', 'COMM_PER', 'INCOME', 'ADMIN_AMT', 'TDS_AMT', 'Point', 'Rank', 'DATE'];
/** class PendingRequest (Controllers/AdminPanel/Pending_RequestController.cs) */
const PENDING_REQUEST = ['RowNumber', 'PLID', 'FRID', 'FPMID', 'FNAME', 'MRP', 'Mobile', 'DATE', 'STATE', 'CITY', 'COUNTRY', 'ADDRESS', 'PINCODE',
  'PackageName', 'PackageID', 'IPADDRESS', 'DESCRIPTION', 'STATUS', 'ACTIVE', 'COMMISSION', 'Taluk', 'District', 'Circle', 'Region'];
// class Luxuary_Fund (EWRID, FROMBUSINESS, ...) is declared in the C# file but never used.

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate, string ToDate,
//   string SearchField, string SearchValue, string btnexel, string Click, int? Month)
// auth (reads Session["Admin_User"]; legacy had no explicit null check - NullReference went to the catch)
// route-config: "AdminPanel/Luxury-Fund" -> Luxury_Fund/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Luxury-Fund'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const FromDate = s0(req.p.FromDate);
  const ToDate = s0(req.p.ToDate);
  const SearchField = s0(req.p.SearchField);
  const SearchValue = s0(req.p.SearchValue);
  const Click = s0(req.p.Click); void Click;
  let Month = nInt(req.p.Month); if (Month === null) Month = 0;
  let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
  const orderbydate = s0(req.p.orderbydate);
  const btnexel = s0(req.p.btnexel); void btnexel; // (Index never calls ExportReport)
  let Page = nInt(req.p.Page);
  const ViewBag = {};
  const out = {};
  // USP_EXCEL_LINK @url,@ISACTIVE out  (result ignored: isactive = 0)
  await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  ViewBag.excelactive = 0;
  try {
    const Empid = req.user.emp_id;
    const emp = await new UtilityClass().UpdateAdminUserSession(Empid); // Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid)
    if (emp) out.token = issueAdminToken(emp);
    if (!emp) throw nullRef(); // EM.Emp_ID on a null session object
    const MaxRows = dynamicpagging;
    if (Page === null) Page = 1;
    // DBO.USP_TRAVELFUND @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@Month,@orderbydate,@SearchField,''  ('' => 9th param @SearchValue)
    const rows = await db.proc(DB, 'USP_TRAVELFUND', {
      fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, Month, orderbydate, SearchField, SearchValue: '',
    });
    const TravelFund = mapRows(rows, CARFUND);
    const tc = outOf(rows, 'totalcount');
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    Object.assign(ViewBag, {
      CurrentPage: Page, GridPageSize: MaxRows, TotalRecord, dynamicpagging, orderbydate, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      SearchField, SearchValue, fromDate: FromDate, toDate: ToDate, check: 0,
    });
    return res.json({ view: '~/Views/AdminPanel/Luxury_Fund/Index.cshtml', Model: TravelFund, ...ViewBag, ...out });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_FranchisePending');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/AdminPanel/Luxury_Fund/Index.cshtml', Model: null, ...ViewBag, ...out });
  }
}));

// public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue)
async function ExportReport(req, res, Page, FromDate, ToDate, SearchField, SearchValue, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Pending_Request_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize();
  if (Page === null) Page = 1;
  // DBO.USP_FranchisePending @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@FRID   (@FRID = "")
  const rows = await db.proc(DB, 'USP_FranchisePending', {
    fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page,
    FRID: 0, // PORT-NOTE: legacy passed "" to the int @FRID (SQL Server converts '' to 0)
  });
  const list = mapRows(rows, PENDING_REQUEST);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Pending_Request.xls', Filename,
      headers: ['S.No.', 'Name', 'Applied For', 'Commision', 'Mobile', 'Date', 'Address', 'State', 'City', 'PinCode', 'Taluk', 'District', 'Circle', 'Region'],
      rows: list, innerProc: 'AllEPinRequestsList', outerProc: 'LiUserWiseIWalletStatementsController_Report',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'RowNumber')) + ' \t');
        w(tab(cellStr(item, 'FNAME')) + ' \t');
        w(tab(cellStr(item, 'PackageName')) + ' \t');
        // (sic) no "Commision" column value is written - columns shift by one, like legacy
        w(tab(cellStr(item, 'Mobile')) + ' \t');
        w(tab(netFormat(col(item, 'DATE'), 'ddMMMyyyy')) + ' \t');
        w(tab(cellStr(item, 'ADDRESS')) + ' \t');
        w(tab(cellStr(item, 'STATE')) + ' \t');
        w(tab(cellStr(item, 'CITY')) + ' \t');
        w(tab(cellStr(item, 'PINCODE')) + ' \t');
        w(tab(cellStr(item, 'Taluk')) + ' \t');
        w(tab(cellStr(item, 'District')) + ' \t');
        w(tab(cellStr(item, 'Circle')) + ' \t');
        w(tab(cellStr(item, 'Region')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nInt(req.p.Page), nStr(req.p.FromDate), nStr(req.p.ToDate), nStr(req.p.SearchField), nStr(req.p.SearchValue), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
