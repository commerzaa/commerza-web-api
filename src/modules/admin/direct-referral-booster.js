'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Direct_Referral_Booster.cs (class Direct_Referral_BoosterController, no namespace => /Direct_Referral_Booster/...)
// Database: affiliate (Db_Affiliate). Procs USP_DIRECTINCOME_REPORT, USP_EXCEL_DOWNLOAD_HISTORY, USP_ADMIN_EARNING_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  nInt, nStr, col, str, cvtInt, cvtDec, perms, nowStamp, excelHistory, writeXlsExport, cellStr, tab, dec2, errorView, trimNull,
} = require('./_shared/batch06-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Direct_Referral_Booster';

/** ReferralBonus.cs class GetReferalIncome */
const GET_REFERAL_INCOME_PROPS = ['ROWNUMBER', 'FROMID', 'TOID', 'INCOME', 'LEVEL', 'TYPE', 'DATE', 'COMM_PER', 'AMOUNT', 'TDS_PER', 'TDS_AMT',
  'ADMIN_AMT', 'ADMIN_PER', 'IncomeType', 'FROMUSERNAME', 'TOUSERNAME', 'TOTALAMOUNT', 'SystemProcessPer', 'SystemProcessAmount', 'Net', 'ISSKIP',
  'FROMNAME', 'TONAME'];
/** ReferralBonus.cs class GetEarningDetails */
const GET_EARNING_DETAILS_PROPS = ['ROWNUMBER', 'EarnedDate', 'MatchingBv', 'EarnedPoints', 'FromUserName', 'IncomeType', 'Payid', 'EmailId', 'LoginId'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** decimal.Parse(x.Value.ToString()) (DBNull => "" => FormatException) */
function decParse(v) {
  const s = str(v);
  if (s === '') throw new Error('Input string was not in a correct format.');
  return cvtDec(s);
}

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage) */
async function ExportReport(req, res, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Direct_Referral_Booster_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = ddlcustpage === null ? 0 : Number(ddlcustpage); // eslint-disable-line no-unused-vars
  if (page === null) page = 1;
  // [USP_DIRECTINCOME_REPORT] @STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@SEARCHFIEL,@SEARCHVALUE,@INCOMETYPE,@TOTALCOUNT OUT
  // PORT-NOTE: the export passes @INCOMETYPE = 4 while Index passes 1 (legacy behaviour kept).
  const list = mapRows(await db.proc(DB, 'USP_DIRECTINCOME_REPORT', {
    STARTROWINDEX: page, MAXROWS: '10000000', FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: trimNull(SearchField),
    SEARCHVALUE: trimNull(SearchValue), INCOMETYPE: 4,
  }), GET_REFERAL_INCOME_PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'Direct_Referral_Booster.xls', Filename, ViewBag, rows: list,
      headers: ['S.No.', 'Date', 'From UserName', 'To UserName', 'Income'],
      innerProc: 'AllFreeEpinList', outerProc: 'USP_DIRECTINCOME_REPORT',
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
// route-config: "AdminPanel/Direct-Referral-Booster" -> Direct_Referral_Booster/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Direct-Referral-Booster'], adminAuth, asyncHandler(async (req, res) => {
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
  if (todate === null) todate = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (btnexel === null) btnexel = '';
  const Empid = req.user.emp_id;
  const ViewBag = {};
  const p = await perms(Empid, url); // CheckPermissions.GetPageActionPermission + GetExcelPermission
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = p.excelactive;
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    // [USP_DIRECTINCOME_REPORT] @STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@SEARCHFIEL,@SEARCHVALUE,@INCOMETYPE,@TOTALCOUNT OUT,@TOTALAdminc OUT,
    //   @TOTALTDS OUT,@TOTALINCOME OUT,@TOTALAmount OUT,@TOTALAMOUNTS OUT
    const rows = await db.proc(DB, 'USP_DIRECTINCOME_REPORT', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
      INCOMETYPE: 1,
    });
    const AllFreeEpinList = mapRows(rows, GET_REFERAL_INCOME_PROPS);
    const tc = str(col(rows[0], 'TOTALCOUNT'));
    const TotalRecord = cvtInt(tc === '' ? '0' : tc);
    const TOTALINCOMES = decParse(col(rows[0], 'TOTALINCOME'));
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
    if (btnexel === 'Export Excel') {
      const x = await ExportReport(req, res, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, ViewBag);
      if (x.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Direct_Referral_Booster/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_DIRECTINCOME_REPORT');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (PORT-NOTE: public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.fromdate), nStr(req.p.todate),
    nInt(req.p.page), nInt(req.p.ddlcustpage), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult GetEarning(string Earninigdate, string Mode)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetEarning{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Earninigdate = nStr(req.p.Earninigdate);
  const Mode = nStr(req.p.Mode);
  const ddlcustpages = 100;
  const Rows = ddlcustpages;
  // [USP_ADMIN_EARNING_HISTORY] @PLID,@StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@ToDate,@TotalCount out,@Mode
  const fromDate = trimNull(Earninigdate);
  const EarningList = mapRows(await db.proc(DB, 'USP_ADMIN_EARNING_HISTORY', {
    PLID: 1, StartRowIndex: 1, MaxRows: Rows, SearchField: '', SearchValue: '', fromDate, ToDate: '', Mode: cvtInt(Mode),
  }), GET_EARNING_DETAILS_PROPS);
  return res.json(EarningList);
}));

module.exports = router;
