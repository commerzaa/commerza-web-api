'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\CarFund.cs (class CarFundController => /admin/CarFund/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const {
  s, ni, col, str, netStr, nowStamp, tab, permissions, excelHistory, sendTsv,
} = require('./_shared/batch04-a-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'CarFund';

/** class CarFund */
const PROPS = ['RowNumber', 'USERNAME', 'FromUsername', 'Month', 'TOTALSELFBV', 'GROUPBV', 'COMM_PER', 'INCOME', 'ADMIN_AMT', 'TDS_AMT', 'Point', 'Rank', 'DATE'];

// private static string url, url1 (process-wide). (private string regno = "" - unused instance field)
let url = '';
let url1 = '';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** DateTime.ToString("ddMMMyyyy") */
function ddMMMyyyy(d) {
  if (d === null || d === undefined) throw new Error('Specified cast is not valid.');
  const x = d instanceof Date ? d : new Date(d);
  return `${String(x.getDate()).padStart(2, '0')}${MON[x.getMonth()]}${x.getFullYear()}`;
}

// ---------------------------------------------------------------- public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue)
async function ExportReport(req, res, ViewBag, Page, FromDate, ToDate) {
  const userid = req.user.emp_id;
  const Filename = `Pending_Request_${userid}_${nowStamp()}`;
  await excelHistory(userid, url, Filename);
  const MaxRows = Number(await UtilityClass.GridPageSize());
  if (Page === null) Page = 1;
  const CarFund = []; // List<CarFund> CarFund = new List<CarFund>();  never filled
  // DBO.USP_FranchisePending @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@FRID
  const LiUserWiseIWalletStatementsController_Report = await db.proc(DB, 'USP_FranchisePending', {
    fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, FRID: '',
  });
  // PORT-NOTE: legacy tested `CarFund.Count > 0` on the never-filled list => the export file is never written (kept: unreachable branch).
  if (CarFund.length > 0) {
    return sendTsv({
      req, res, ViewBag, sheet: 'Pending_Request.xls', Filename, rows: LiUserWiseIWalletStatementsController_Report,
      rowErrProc: 'AllEPinRequestsList', outerErrProc: 'LiUserWiseIWalletStatementsController_Report',
      headers: ['S.No.', 'Name', 'Applied For', 'Commision', 'Mobile', 'Date', 'Address', 'State', 'City', 'PinCode', 'Taluk', 'District', 'Circle', 'Region'],
      cells: (item, w) => {
        const v = (k) => netStr(col(item, k) === undefined ? null : col(item, k));
        w(tab(v('RowNumber')) + ' \t');
        w(tab(v('FNAME')) + ' \t');
        w(tab(v('PackageName')) + ' \t');
        w(tab(v('Mobile')) + ' \t');
        w(tab(ddMMMyyyy(col(item, 'DATE'))) + ' \t');
        w(tab(v('ADDRESS')) + ' \t');
        w(tab(v('STATE')) + ' \t');
        w(tab(v('CITY')) + ' \t');
        w(tab(v('PINCODE')) + ' \t');
        w(tab(v('Taluk')) + ' \t');
        w(tab(v('District')) + ' \t');
        w(tab(v('Circle')) + ' \t');
        w(tab(v('Region')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate, string ToDate, string SearchField, string SearchValue, string btnexel, string Click, int? Month)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Car-Fund" -> CarFund/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Car-Fund'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = ni(req.p.dynamicpagging); let orderbydate = s(req.p.orderbydate); let Page = ni(req.p.Page);
  let FromDate = s(req.p.FromDate); let ToDate = s(req.p.ToDate); let SearchField = s(req.p.SearchField); let SearchValue = s(req.p.SearchValue);
  let btnexel = s(req.p.btnexel); let Click = s(req.p.Click); let Month = ni(req.p.Month);
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
  if (btnexel === null) btnexel = '';
  const ViewBag = {};
  try {
    const perm = await permissions(url, req.user.emp_id);
    ViewBag.isactive = perm.isactive;
    ViewBag.isedit = perm.isedit;
    ViewBag.excelactive = perm.excelactive;
    const MaxRows = Number(dynamicpagging);
    if (Page === null) Page = 1;
    // DBO.USP_CARFUND @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@Month,@orderbydate,@SearchField,@SearchValue,'' (@Detail)
    const raw = await db.proc(DB, 'USP_CARFUND', {
      fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, Month, orderbydate, SearchField: SearchField.trim(),
      SearchValue: SearchValue.trim(), Detail: '',
    });
    const CarFund = mapRows(raw, PROPS);
    const tc = str(col(raw[0], 'totalcount'));
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
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, Page, FromDate, ToDate, SearchField, SearchValue);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/CarFund/Index.cshtml', Model: CarFund, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_FranchisePending');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/AdminPanel/CarFund/Index.cshtml', Model: null, ...ViewBag });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, ni(req.p.Page), s(req.p.FromDate), s(req.p.ToDate), s(req.p.SearchField), s(req.p.SearchValue));
  if (!r.sent) res.send('');
}));

module.exports = router;
