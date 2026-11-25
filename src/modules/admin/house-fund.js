'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\HouseFund.cs (class HouseFundController => /admin/HouseFund/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert, issueAdminToken } = require('./_shared/admin-session');
const B = require('./_shared/batch08-common');
const P = require('./_shared/batch08-b-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'HouseFund';

/** class CarFund (CarFund.cs) */
const CARFUND_PROPS = ['RowNumber', 'USERNAME', 'FromUsername', 'Month', 'TOTALSELFBV', 'GROUPBV', 'COMM_PER', 'INCOME', 'ADMIN_AMT', 'TDS_AMT',
  'Point', 'Rank', 'DATE'];
/** class PendingRequest (Pending_RequestController.cs) */
const PENDINGREQUEST_PROPS = ['RowNumber', 'PLID', 'FRID', 'FPMID', 'FNAME', 'MRP', 'Mobile', 'DATE', 'STATE', 'CITY', 'COUNTRY', 'ADDRESS',
  'PINCODE', 'PackageName', 'PackageID', 'IPADDRESS', 'DESCRIPTION', 'STATUS', 'ACTIVE', 'COMMISSION', 'Taluk', 'District', 'Circle', 'Region',
  'StoreType', 'FRCode', 'Emailid', 'GST', 'TinNo', 'CommissionPer', 'Referralusername'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (kept as module state).
let url = '';
let url1 = '';

/** public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue) */
async function ExportReport(req, res, ViewBag, Page, FromDate, ToDate, SearchField, SearchValue) {
  void SearchField; void SearchValue; // not used by the legacy body
  const userid = req.user.emp_id;
  const Filename = 'Pending_Request_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize();
  if (Page === null) Page = 1;
  // DBO.USP_FranchisePending @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@FRID  (CommandTimeout 1000)
  const list = mapRows(await db.proc(DB, 'USP_FranchisePending', {
    fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, FRID: '',
  }), PENDINGREQUEST_PROPS);
  if (list.length > 0) {
    // PORT-NOTE: legacy header row has 14 columns ("Commision" included) but each data row writes 13 cells (no COMMISSION) - kept.
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Pending_Request.xls', Filename,
      headers: ['S.No.', 'Name', 'Applied For', 'Commision', 'Mobile', 'Date', 'Address', 'State', 'City', 'PinCode', 'Taluk', 'District',
        'Circle', 'Region'],
      rows: list,
      innerProc: 'AllEPinRequestsList',
      outerProc: 'LiUserWiseIWalletStatementsController_Report',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'RowNumber')) + ' \t');
        w(B.tab(B.cellStr(item, 'FNAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'PackageName')) + ' \t');
        w(B.tab(B.cellStr(item, 'Mobile')) + ' \t');
        w(B.tab(B.netFormat(item.DATE, 'ddMMMyyyy')) + ' \t');
        w(B.tab(B.cellStr(item, 'ADDRESS')) + ' \t');
        w(B.tab(B.cellStr(item, 'STATE')) + ' \t');
        w(B.tab(B.cellStr(item, 'CITY')) + ' \t');
        w(B.tab(B.cellStr(item, 'PINCODE')) + ' \t');
        w(B.tab(B.cellStr(item, 'Taluk')) + ' \t');
        w(B.tab(B.cellStr(item, 'District')) + ' \t');
        w(B.tab(B.cellStr(item, 'Circle')) + ' \t');
        w(B.tab(B.cellStr(item, 'Region')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate, string ToDate, string SearchField, string SearchValue, string btnexel, string Click, int? Month)
// auth ([SessionExpireCheck], reads Session["Admin_User"])
// route-config: "AdminPanel/House-Fund" -> HouseFund/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/House-Fund'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let Page = B.nInt(req.p.Page);
  let FromDate = B.nStr(req.p.FromDate);
  let ToDate = B.nStr(req.p.ToDate);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let btnexel = B.nStr(req.p.btnexel);
  let Click = B.nStr(req.p.Click);
  let Month = B.nInt(req.p.Month);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (FromDate === null) FromDate = '';
  if (ToDate === null) ToDate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (Click === null) Click = ''; // unused afterwards
  if (Month === null) Month = 0;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (btnexel === null) btnexel = '';
  const ViewBag = {};
  const out = {};
  try {
    const Empid = req.user.emp_id;
    // Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid);
    const emp = await new UtilityClass().UpdateAdminUserSession(Empid);
    if (emp) out.token = issueAdminToken(emp);
    if (!emp) throw B.nullRef(); // EM.Emp_ID on the refreshed (null) session object
    const perm = await B.perms(Empid, url);
    ViewBag.isactive = perm.isactive;
    ViewBag.isedit = perm.isedit;
    ViewBag.excelactive = perm.excelactive;
    const MaxRows = Number(dynamicpagging);
    if (Page === null) Page = 1;
    // DBO.USP_HouseFUND @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@Month,@orderbydate,@SearchField,@SearchValue,''  (CommandTimeout 1000)
    const rows = await db.proc(DB, 'USP_HouseFUND', {
      fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, Month, orderbydate, SearchField: SearchField.trim(),
      SearchValue: SearchValue.trim(), Detail: '',
    });
    const HouseFund = mapRows(rows, CARFUND_PROPS);
    const TotalRecord = P.outIntOr0(rows[0], 'TOTALCOUNT');
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
      // PORT-NOTE: legacy Response.Redirect to the sheet ended the request; the file is sent directly instead.
      const r = await ExportReport(req, res, ViewBag, Page, FromDate, ToDate, SearchField, SearchValue);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/HouseFund/Index.cshtml', Model: HouseFund, ...ViewBag, ...out });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_FranchisePending');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/AdminPanel/HouseFund/Index.cshtml', Model: null, ...ViewBag, ...out });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nInt(req.p.Page), B.nStr(req.p.FromDate), B.nStr(req.p.ToDate), B.nStr(req.p.SearchField),
    B.nStr(req.p.SearchValue));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
