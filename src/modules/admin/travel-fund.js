'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\TravelFund.cs (class TravelFundController => /admin/TravelFund/...)
// Database: affiliate (Db_Affiliate). Procs USP_TRAVELFUND, USP_FranchisePending, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, issueAdminToken } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, col, str, perms, nowStamp, excelHistory, writeXlsExport, cellStr, tab, netFormat, cvtInt,
} = require('./_shared/batch11-common');

const router = express.Router();
const C = 'TravelFund';

/** CarFund.cs class CarFund */
const CAR_FUND_PROPS = ['RowNumber', 'USERNAME', 'FromUsername', 'Month', 'TOTALSELFBV', 'GROUPBV', 'COMM_PER', 'INCOME', 'ADMIN_AMT', 'TDS_AMT',
  'Point', 'Rank', 'DATE'];
/** Pending_RequestController.cs class PendingRequest */
const PENDING_REQUEST_PROPS = ['RowNumber', 'PLID', 'FRID', 'FPMID', 'FNAME', 'MRP', 'Mobile', 'DATE', 'STATE', 'CITY', 'COUNTRY', 'ADDRESS', 'PINCODE',
  'PackageName', 'PackageID', 'IPADDRESS', 'DESCRIPTION', 'STATUS', 'ACTIVE', 'COMMISSION', 'Taluk', 'District', 'Circle', 'Region', 'StoreType',
  'FRCode', 'Emailid', 'GST', 'TinNo', 'CommissionPer', 'Referralusername', 'Remark', 'USERNAME', 'Sponsor', 'Upline_FRcode', 'Paymentdate',
  'ModeName', 'ReferanceNo', 'Attachment', 'Bank'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** item.DATE.ToString(fmt) on a non-nullable DateTime (DBNull would have failed materialisation => NRE here) */
const dateFmt = (v, fmt) => netFormat(v, fmt);

/**
 * public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue)
 * PORT-NOTE: legacy exports the franchise pending-request list (USP_FranchisePending) from the Travel Fund page; kept as is.
 */
async function ExportReport(req, res, Page, FromDate, ToDate, SearchField, SearchValue, ViewBag) { // eslint-disable-line no-unused-vars
  const userid = req.user.emp_id;
  const Filename = 'Pending_Request_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize();
  if (Page === null) Page = 1;
  // DBO.USP_FranchisePending @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@FRID  (@FRID = '' => SQL Server int conversion => 0)
  const rows = await db.proc(DB, 'USP_FranchisePending', {
    fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, FRID: 0,
  });
  const list = mapRows(rows, PENDING_REQUEST_PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'Pending_Request.xls', Filename, ViewBag, rows: list,
      headers: ['S.No.', 'Name', 'Applied For', 'Commision', 'Mobile', 'Date', 'Address', 'State', 'City', 'PinCode', 'Taluk', 'District', 'Circle', 'Region'],
      innerProc: 'AllEPinRequestsList', outerProc: 'LiUserWiseIWalletStatementsController_Report',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'RowNumber')) + ' \t');
        w(tab(cellStr(item, 'FNAME')) + ' \t');
        w(tab(cellStr(item, 'PackageName')) + ' \t');
        // (COMMISSION column was commented out in legacy; the header "Commision" is still written)
        w(tab(cellStr(item, 'Mobile')) + ' \t');
        w(tab(dateFmt(item.DATE, 'ddMMMyyyy')) + ' \t');
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

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string orderbydate, int? Page,
//   string FromDate, string ToDate, string SearchField, string SearchValue, string btnexel, string Click, int? Month)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/Travel-Fund" -> TravelFund/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Travel-Fund'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let Page = nInt(req.p.Page);
  let FromDate = nStr(req.p.FromDate);
  let ToDate = nStr(req.p.ToDate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let btnexel = nStr(req.p.btnexel);
  let Click = nStr(req.p.Click);
  let Month = nInt(req.p.Month);
  const ViewBag = {};
  const out = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const EM = { Emp_ID: req.user.emp_id };
  if (FromDate === null) FromDate = '';
  if (ToDate === null) ToDate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (Click === null) Click = '';
  if (Month === null) Month = 0;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (btnexel === null) btnexel = '';

  const Decryptt = await UtilityClass.Encryptword('7567685'); // eslint-disable-line no-unused-vars

  const Empid = req.user.emp_id;
  const p = await perms(Empid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = p.excelactive;
  // Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid);
  const emp = await new UtilityClass().UpdateAdminUserSession(Empid);
  if (emp) out.token = issueAdminToken(emp);

  const Employeeid = EM.Emp_ID; // eslint-disable-line no-unused-vars
  const MaxRows = cvtInt(dynamicpagging);
  if (Page === null) Page = 1;
  // DBO.USP_TRAVELFUND @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@Month,@orderbydate,@SearchField,@SearchValue,''  ('' => @Detail)
  const rows = await db.proc(DB, 'USP_TRAVELFUND', {
    fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, Month, orderbydate, SearchField: SearchField.trim(),
    SearchValue: SearchValue.trim(), Detail: '',
  });
  const TravelFund = mapRows(rows, CAR_FUND_PROPS);
  const tc = str(col(rows[0], 'totalcount'));
  const TotalRecord = cvtInt(tc === '' ? '0' : tc);
  ViewBag.CurrentPage = Page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = FromDate;
  ViewBag.toDate = ToDate;
  ViewBag.check = 0;
  if (btnexel === 'Export Excel') {
    const x = await ExportReport(req, res, Page, FromDate, ToDate, SearchField, SearchValue, ViewBag);
    if (x.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/TravelFund/Index.cshtml', Model: TravelFund, ...ViewBag, ...out });
}));

// ---------------------------------------------------------------- public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nInt(req.p.Page), nStr(req.p.FromDate), nStr(req.p.ToDate), nStr(req.p.SearchField),
    nStr(req.p.SearchValue), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

module.exports = router;
