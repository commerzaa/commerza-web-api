'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ReferralBonus.cs (class ReferralBonusController => /admin/ReferralBonus/...)
// Database: affiliate (Db_Affiliate). Procs: USP_DIRECTINCOME_REPORT, USP_EXCEL_DOWNLOAD_HISTORY, USP_ADMIN_EARNING_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, cvtInt, cvtDec, perms, excelHistory, nowStamp, writeXlsExport, cellStr, tab, dec2, netFormat, errorView, trimS,
} = require('./_shared/batch12-common');
const { rowsOut, omitNull } = require('./_shared/batch13-03-common');

const router = express.Router();
const C = 'ReferralBonus';

/** class GetReferalIncome */
const GET_REFERAL_INCOME_PROPS = ['ROWNUMBER', 'FROMID', 'TOID', 'INCOME', 'LEVEL', 'TYPE', 'DATE', 'COMM_PER', 'AMOUNT', 'TDS_PER', 'TDS_AMT', 'ADMIN_AMT',
  'ADMIN_PER', 'IncomeType', 'FROMUSERNAME', 'TOUSERNAME', 'TOTALAMOUNT', 'SystemProcessPer', 'SystemProcessAmount', 'Net', 'ISSKIP', 'FROMNAME', 'TONAME'];
/** class GetEarningDetails */
const GET_EARNING_DETAILS_PROPS = ['ROWNUMBER', 'EarnedDate', 'MatchingBv', 'EarnedPoints', 'FromUserName', 'IncomeType', 'Payid', 'EmailId', 'LoginId'];
// (class GetEarningWalletHistory is declared in the C# file but not used by this controller)

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, page, ddlcustpage) {
  const userid = req.user.emp_id;
  const Filename = 'Referral_Bonus_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = cvtInt(ddlcustpage); // Convert.ToInt32(ddlcustpage) (unused: @MAXROWS is "10000000")
  void MaxRows;
  if (page === null) page = 1;
  // [USP_DIRECTINCOME_REPORT] @STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@SEARCHFIEL,@SEARCHVALUE,@INCOMETYPE,@TOTALCOUNT OUT
  const AllFreeEpinList = mapRows(await db.proc(DB, 'USP_DIRECTINCOME_REPORT', omitNull({
    STARTROWINDEX: page, MAXROWS: '10000000', FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: trimS(SearchField), SEARCHVALUE: trimS(SearchValue),
    INCOMETYPE: 1,
  })), GET_REFERAL_INCOME_PROPS);
  if (AllFreeEpinList.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Referral_Bonus.xls', downloadName: 'Referral_Bonus.xls', Filename,
      headers: ['S.No.', 'Date', 'From UserName', 'To UserName', 'Investment', 'Comm.', 'Total Income', 'TDS', 'Payble'],
      rows: AllFreeEpinList,
      innerProc: 'GetReferalIncome',
      outerProc: 'USP_DIRECTINCOME_REPORT',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(netFormat(item.DATE, 'dd-MMM-yyyy')) + ' \t');
        w(tab(cellStr(item, 'FROMUSERNAME')) + ' \t');
        w(tab(cellStr(item, 'TOUSERNAME')) + ' \t');
        w(tab(dec2(item.AMOUNT)) + ' \t');
        w(tab(dec2(item.COMM_PER)) + ' \t');
        w(tab(dec2(item.TOTALAMOUNT)) + ' \t');
        w(tab(dec2(item.TDS_AMT)) + ' \t');
        w(tab(dec2(item.INCOME)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField,
//   string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, string btnexel, string Date, int? IsHold)
// auth ([SessionExpireCheck]: no session => redirect "~/secure-admin-login-.../logout")
// route-config: "AdminPanel/referral-bonus-report" -> ReferralBonus/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/referral-bonus-report'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromdate = nStr(req.p.fromdate);
  let todate = nStr(req.p.todate);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  let btnexel = nStr(req.p.btnexel);
  const Date_ = nStr(req.p.Date);
  let IsHold = nInt(req.p.IsHold);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  // ReferralUrl = Request.Url.ToString(); ReferralUrlrequesturl = ReferralUrl.Split('?')
  // PORT-NOTE: Uri.ToString() is unescaped; the raw query part is URI-decoded here (kept raw if decoding fails).
  const ReferralUrl = req.originalUrl || req.url || '';
  const ReferralUrlrequesturl = ReferralUrl.split('?');
  let usernameurl = '';
  if (ReferralUrlrequesturl.length >= 2) {
    let q = ReferralUrlrequesturl[1];
    try { q = decodeURIComponent(q); } catch (_) { /* keep raw */ }
    usernameurl = await UtilityClass.Decryptword(q);
    if (usernameurl !== '') {
      SearchField = 'TOUSERNAME';
      SearchValue = usernameurl;
    }
  }
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (Date_ !== null) fromdate = await UtilityClass.Decryptword(Date_);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (btnexel === null) btnexel = '';
  if (IsHold === null) IsHold = -1;
  const Empid = req.user.emp_id;
  const ViewBag = {};
  Object.assign(ViewBag, await perms(Empid, url)); // CheckPermissions.GetPageActionPermission + GetExcelPermission
  try {
    const MaxRows = cvtInt(dynamicpagging);
    if (page === null) page = 1;
    // [USP_DIRECTINCOME_REPORT] @STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@SEARCHFIEL,@SEARCHVALUE,@INCOMETYPE,@TOTALCOUNT OUT,@TOTALAdminc out,
    //   @TOTALTDS Out,@TOTALINCOME OUT,@TOTALAmount Out,@TOTALAMOUNTS OUT,@ISHOLD,@orderbydate   (CommandTimeout 1000)
    const rows = await db.proc(DB, 'USP_DIRECTINCOME_REPORT', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
      INCOMETYPE: 1, ISHOLD: IsHold, orderbydate,
    });
    const AllFreeEpinList = mapRows(rows, GET_REFERAL_INCOME_PROPS);
    // PORT-NOTE: with no rows PG cannot return the OUT values => 0 (the legacy code treated DBNull the same way).
    const o = (n) => { const v = rowsOut(rows, n); return v === null ? '' : v; };
    const tc = o('TOTALCOUNT');
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    if (Number.isNaN(TotalRecord)) throw new Error('Input string was not in a correct format.');
    let TOTALAdminCharge = 0; let TOTALTDSCharge = 0; let TOTALINCOMES = 0; let TOTALAmounts = 0; let TOTALAMOUNT = 0;
    if (o('TOTALAdminc') !== '') TOTALAdminCharge = cvtDec(o('TOTALAdminc'));
    if (o('TOTALTDS') !== '') TOTALTDSCharge = cvtDec(o('TOTALTDS'));
    if (o('TOTALINCOME') !== '') TOTALINCOMES = cvtDec(o('TOTALINCOME'));
    if (o('TOTALAmount') !== '') TOTALAmounts = cvtDec(o('TOTALAmount'));
    if (o('TOTALAMOUNTS') !== '') TOTALAMOUNT = cvtDec(o('TOTALAMOUNTS'));
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.TOTALAdminCharge = TOTALAdminCharge;
    ViewBag.TOTALTDSCharge = TOTALTDSCharge;
    ViewBag.TOTALINCOMES = TOTALINCOMES;
    ViewBag.TOTALAmounts = TOTALAmounts;
    ViewBag.TOTALAMOUNT = TOTALAMOUNT;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.IsHold = IsHold;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, page, ddlcustpage);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/ReferralBonus/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_DIRECTINCOME_REPORT');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate,
//   int? page, int? ddlcustpage)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.fromdate), nStr(req.p.todate),
    nInt(req.p.page), nInt(req.p.ddlcustpage));
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult GetEarning(string Earninigdate, string Mode)
// auth (legacy had no session check; member earning data => adminAuth)
router.all(`/admin/${C}/GetEarning{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Earninigdate = nStr(req.p.Earninigdate);
  const Mode = nStr(req.p.Mode);
  const ddlcustpages = 100;
  const Rows = cvtInt(ddlcustpages);
  // [USP_ADMIN_EARNING_HISTORY] @PLID,@StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@ToDate,@TotalCount out,@Mode
  const fromDate = trimS(Earninigdate);
  const EarningList = mapRows(await db.proc(DB, 'USP_ADMIN_EARNING_HISTORY', {
    PLID: cvtInt('1'), StartRowIndex: cvtInt('1'), MaxRows: Rows, SearchField: '', SearchValue: '', fromDate, ToDate: '', Mode: cvtInt(Mode),
  }), GET_EARNING_DETAILS_PROPS);
  return res.json(EarningList);
}));

module.exports = router;
