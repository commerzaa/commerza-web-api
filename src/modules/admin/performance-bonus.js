'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\PerformanceBonus.cs (class PerformanceBonusController)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert, issueAdminToken } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, reqInt, perms, excelHistory, nowStamp, writeXlsExport, cellStr, col, netFormat, tab, outOf, nullRef,
} = require('./_shared/batch11-common');

const router = express.Router();
const C = 'PerformanceBonus';

/** class PerformanceBonus */
const PERFORMANCEBONUS_PROPS = ['RowNumber', 'USERNAME', 'FromUsername', 'Month', 'TOTALSELFBV', 'GROUPBV', 'COMM_PER', 'INCOME', 'ADMIN_AMT',
  'TDS_AMT', 'Rank', 'TOID', 'DATE'];
/** class PerformanceBonusdetails */
const PERFORMANCEBONUSDETAILS_PROPS = ['ROWNUMBER', 'TOUSERNAME', 'FROMUSERNAME', 'AMOUNT', 'COMM_PER', 'TOTALINCOME', 'ADMIN_AMT', 'TDS_AMT', 'INCOME'];
/** class PendingRequest (Controllers/AdminPanel/Pending_RequestController.cs) */
const PENDINGREQUEST_PROPS = ['RowNumber', 'PLID', 'FRID', 'FPMID', 'FNAME', 'MRP', 'Mobile', 'DATE', 'STATE', 'CITY', 'COUNTRY', 'ADDRESS', 'PINCODE',
  'PackageName', 'PackageID', 'IPADDRESS', 'DESCRIPTION', 'STATUS', 'ACTIVE', 'COMMISSION', 'Taluk', 'District', 'Circle', 'Region', 'StoreType',
  'FRCode', 'Emailid', 'GST', 'TinNo', 'CommissionPer', 'Referralusername', 'Remark', 'USERNAME', 'Sponsor', 'Upline_FRcode', 'Paymentdate',
  'ModeName', 'ReferanceNo', 'Attachment', 'Bank'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate, string ToDate, string SearchField, string SearchValue, string btnexel, string Click, int? Month)
// auth (reads Session["Admin_User"])
// route-config: "AdminPanel/Performance-Bonus" -> PerformanceBonus/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Performance-Bonus'], adminAuth, asyncHandler(async (req, res) => {
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
  if (FromDate === null) FromDate = '';
  if (ToDate === null) ToDate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (Click === null) Click = '';
  if (Month === null) Month = 0;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (btnexel === null) btnexel = ''; // (btnexel is not used further in legacy)
  const Empid = req.user.emp_id;
  const p = await perms(Empid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = p.excelactive;
  try {
    // Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid);
    const EM = await new UtilityClass().UpdateAdminUserSession(Empid);
    if (!EM) throw nullRef(); // EM.Emp_ID on null
    out.token = issueAdminToken(EM);
    const MaxRows = Number(dynamicpagging);
    if (Page === null) Page = 1;
    // 9th positional arg was the literal '' (=> @Detail)
    const rows = await db.proc(DB, 'USP_PerformanceBonus', {
      fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, Month, orderbydate, SearchField, Detail: '',
    });
    const PerformanceBonus = mapRows(rows, PERFORMANCEBONUS_PROPS);
    const tc = outOf(rows, 'TOTALCOUNT');
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
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
    let PerformanceBonus_detils = [];
    if (Click !== '') {
      const d = await db.proc(DB, 'USP_PerformanceBonus', {
        fromDate: '', toDate: '', MAXROWS: MaxRows, STARTROWINDEX: Page, Month: 0, orderbydate, SearchField: '', Detail: Click,
      });
      PerformanceBonus_detils = mapRows(d, PERFORMANCEBONUS_PROPS);
      ViewBag.check = 1;
    }
    ViewBag.Details = PerformanceBonus_detils;
    return res.json({ view: '~/Views/AdminPanel/PerformanceBonus/Index.cshtml', Model: PerformanceBonus, ...ViewBag, ...out });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_FranchisePending');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/AdminPanel/PerformanceBonus/Index.cshtml', Model: null, ...ViewBag, ...out });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"], returns franchise request data). Not called from Index.
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let Page = nInt(req.p.Page);
  const FromDate = nStr(req.p.FromDate);
  const ToDate = nStr(req.p.ToDate);
  const ViewBag = {};
  const userid = req.user.emp_id;
  const Filename = 'Pending_Request_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize();
  if (Page === null) Page = 1;
  const rows = await db.proc(DB, 'USP_FranchisePending', {
    fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, FRID: '',
  });
  const list = mapRows(rows, PENDINGREQUEST_PROPS);
  if (list.length > 0) {
    // PORT-NOTE: 14 header columns but 13 cells per row (no Commision cell) - kept.
    const r = await writeXlsExport({
      req, res, ViewBag, sheet: 'Pending_Request.xls', Filename,
      headers: ['S.No.', 'Name', 'Applied For', 'Commision', 'Mobile', 'Date', 'Address', 'State', 'City', 'PinCode', 'Taluk', 'District', 'Circle', 'Region'],
      rows: list,
      innerProc: 'AllEPinRequestsList',
      outerProc: 'LiUserWiseIWalletStatementsController_Report',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'RowNumber')) + ' \t');
        w(tab(cellStr(item, 'FNAME')) + ' \t');
        w(tab(cellStr(item, 'PackageName')) + ' \t');
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
    if (r.sent) return undefined;
  }
  return res.send(''); // void action
}));

// ---------------------------------------------------------------- public JsonResult getdetails(string USERNAME, int MONTH)
// auth (PORT-NOTE: legacy had no session check; returns member income data => adminAuth per AUTH RULE)
router.all(`/admin/${C}/getdetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const USERNAME = nStr(req.p.USERNAME);
  const MONTH = reqInt(req.p.MONTH, 'MONTH');
  // PORT-NOTE: legacy concatenated USERNAME unquoted into "TOID=" + USERNAME (SQL injection); now a bound parameter compared as text.
  const rows = await db.query(DB, `SELECT ROW_NUMBER() OVER(ORDER BY li.liid DESC) AS rownumber, mm.username AS tousername, mm1.username AS fromusername,
      li.amount AS amount, li.comm_per AS comm_per, (li.income + li.admin_amt + li.tds_amt) AS totalincome, coalesce(admin_amt, 0) AS admin_amt,
      coalesce(tds_amt, 0) AS tds_amt, coalesce(li.income, 0) AS income
    FROM level_income li INNER JOIN member_master mm ON mm.loginid = li.toid LEFT JOIN member_master mm1 ON mm1.loginid = li.fromid
    WHERE levelincometype = 7 AND ishold = 0 AND toid::text = @USERNAME AND extract(month from li.date) = @MONTH`, { USERNAME, MONTH });
  const purchasepackdetails = mapRows(rows, PERFORMANCEBONUSDETAILS_PROPS);
  if (purchasepackdetails && purchasepackdetails.length > 0) return res.json(purchasepackdetails);
  return res.json('error');
}));

module.exports = router;
