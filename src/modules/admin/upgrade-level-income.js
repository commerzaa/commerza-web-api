'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\UpgradeLevelIncome.cs (class UpgradeLevelIncomeController => /admin/UpgradeLevelIncome/...)
// Database: affiliate (Db_Affiliate). Procs USP_DIRECTINCOME_REPORT, USP_EXCEL_DOWNLOAD_HISTORY, USP_ADMIN_EARNING_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, col, str, cvtInt, perms, nowStamp, excelHistory, writeXlsExport, cellStr, tab, dec2, errorView, nullRef,
} = require('./_shared/batch11-common');
const { strictDecOut } = require('./_shared/batch13-10-common');

const router = express.Router();
const C = 'UpgradeLevelIncome';

/** ReferralBonus.cs class GetReferalIncome */
const GET_REFERAL_INCOME_PROPS = ['ROWNUMBER', 'FROMID', 'TOID', 'INCOME', 'LEVEL', 'TYPE', 'DATE', 'COMM_PER', 'AMOUNT', 'TDS_PER', 'TDS_AMT',
  'ADMIN_AMT', 'ADMIN_PER', 'IncomeType', 'FROMUSERNAME', 'TOUSERNAME', 'TOTALAMOUNT', 'SystemProcessPer', 'SystemProcessAmount', 'Net', 'ISSKIP',
  'FROMNAME', 'TONAME'];
/** ReferralBonus.cs class GetEarningDetails */
const GET_EARNING_DETAILS_PROPS = ['ROWNUMBER', 'EarnedDate', 'MatchingBv', 'EarnedPoints', 'FromUserName', 'IncomeType', 'Payid', 'EmailId', 'LoginId'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage) */
async function ExportReport(req, res, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = ' UpgradeLevelIncome' + userid + '_' + nowStamp(); // (leading space kept from legacy)
  await excelHistory(userid, url, Filename);
  const MaxRows = ddlcustpage === null ? 0 : ddlcustpage; // eslint-disable-line no-unused-vars
  if (page === null) page = 1;
  if (SearchField === null || SearchValue === null) throw nullRef();
  // [USP_DIRECTINCOME_REPORT] @STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@SEARCHFIEL,@SEARCHVALUE,@INCOMETYPE,@TOTALCOUNT OUT
  const list = mapRows(await db.proc(DB, 'USP_DIRECTINCOME_REPORT', {
    STARTROWINDEX: page, MAXROWS: '10000000', FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
    INCOMETYPE: 5,
  }), GET_REFERAL_INCOME_PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'UpgradeLevelIncome.xls', Filename, ViewBag, rows: list,
      headers: ['S.No.', 'Date', 'From UserName', 'To UserName', 'Income'],
      innerProc: 'GetReferalIncome', outerProc: 'USP_DIRECTINCOME_REPORT',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'DATE')) + ' \t');
        w(tab(cellStr(item, 'FROMUSERNAME')) + ' \t');
        w(tab(cellStr(item, 'TOUSERNAME')) + ' \t');
        w(tab(dec2(item.INCOME)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField,
//   string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, string btnexel)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/Upgrade-Level-Income" -> UpgradeLevelIncome/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Upgrade-Level-Income'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromdate = nStr(req.p.fromdate);
  let todate = nStr(req.p.todate);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  let btnexel = nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (todate === null) todate = '';
  if (btnexel === null) btnexel = '';
  const Empid = req.user.emp_id;
  const ViewBag = {};
  const p = await perms(Empid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = p.excelactive;
  try {
    const MaxRows = cvtInt(dynamicpagging);
    if (page === null) page = 1;
    // [USP_DIRECTINCOME_REPORT] @STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@SEARCHFIEL,@SEARCHVALUE,@INCOMETYPE,@TOTALCOUNT OUT,@TOTALINCOME OUT
    const rows = await db.proc(DB, 'USP_DIRECTINCOME_REPORT', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
      INCOMETYPE: 5,
    });
    const AllFreeEpinList = mapRows(rows, GET_REFERAL_INCOME_PROPS);
    const tc = str(col(rows[0], 'TOTALCOUNT'));
    const TotalRecord = cvtInt(tc === '' ? '0' : tc);
    // PORT-NOTE: the legacy EXEC passed its 9th argument positionally ("@TOTALINCOME OUT"), which binds to the proc's 9th
    // parameter @TOTALAdminc (not @TOTALINCOME). The value shown as TOTALINCOMES is therefore the proc's @TOTALAdminc.
    const TOTALINCOMES = strictDecOut(rows, 'TOTALAdminc');
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TOTALINCOMES = TOTALINCOMES;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    const Noofpage = await UtilityClass.GridNumbersPerPage(); // eslint-disable-line no-unused-vars
    if (btnexel === 'Export Excel') {
      const x = await ExportReport(req, res, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, ViewBag);
      if (x.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/UpgradeLevelIncome/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_DIRECTINCOME_REPORT');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.fromdate), nStr(req.p.todate),
    nInt(req.p.page), nInt(req.p.ddlcustpage), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult GetEarning(string Earninigdate, string Mode)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetEarning{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Earninigdate = nStr(req.p.Earninigdate);
  const Mode = nStr(req.p.Mode);
  const ddlcustpages = 100;
  const Rows = ddlcustpages;
  if (Earninigdate === null) throw nullRef(); // Earninigdate.Trim()
  // [USP_ADMIN_EARNING_HISTORY] @PLID,@StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@ToDate,@TotalCount out,@Mode
  const EarningList = mapRows(await db.proc(DB, 'USP_ADMIN_EARNING_HISTORY', {
    PLID: 1, STARTROWINDEX: 1, MAXROWS: Rows, SEARCHFIELD: '', SEARCHVALUE: '', FROMDATE: Earninigdate.trim(), TODATE: '', Mode: cvtInt(Mode),
  }), GET_EARNING_DETAILS_PROPS);
  return res.json(EarningList);
}));

module.exports = router;
