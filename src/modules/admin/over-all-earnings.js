'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\OverAllEarningsController.cs (class Common.Controllers.AdminPanel.OverAllEarningsController
// => /admin/OverAllEarnings/...). Database: affiliate (Db_Affiliate). Procs USP_OVEALALLEARNINGS, USP_EXCEL_DOWNLOAD_HISTORY (+ CheckPermissions lib).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  nInt, nStr, cellStr, tab, dec2, nowStamp, excelHistory, writeXlsExport, perms, outIntOf, trimS,
} = require('./_shared/batch11-common');
const { toDecimalOut } = require('./_shared/batch11-b-common');
const { GET_EARNING_WALLET_HISTORY_PROPS } = require('./_shared/batch08-a2-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'OverAllEarnings';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** [USP_OVEALALLEARNINGS] @PLID,@STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT OUT,@MODE,@INCOMETYPE,
 *  @EarnedMatchingPoints Out,@EarnedDirectPoints Out,@EarnedLevelPoints Out,@EarnedTaskLevelPoints Out,@TotalRoyality Out,@TotalCashReward Out */
function overallEarnings(page, MaxRows, SearchField, SearchValue, fromdate, todate) {
  return db.proc(DB, 'USP_OVEALALLEARNINGS', {
    PLID: '0', STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: trimS(SearchField), SEARCHVALUE: trimS(SearchValue), FROMDATE: trimS(fromdate),
    TODATE: trimS(todate), MODE: '1', INCOMETYPE: '1',
  });
}

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate) {
  const userid = req.user.emp_id;
  const Filename = 'OverAllEarnings_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const rows = await overallEarnings(1, 999999, SearchField, SearchValue, fromdate, todate);
  const AllFreeEpinList = mapRows(rows, GET_EARNING_WALLET_HISTORY_PROPS);
  const TotalRecord = outIntOf(rows, 'TotalCount'); // eslint-disable-line no-unused-vars
  if (AllFreeEpinList.length > 0) {
    let RowNumber = 1;
    return writeXlsExport({
      req, res, ViewBag, sheet: 'OverAllEarnings.xls', Filename, rows: AllFreeEpinList,
      headers: ['S.No.', 'Date', 'Matching', 'Matching Level', 'Growth Bonus', 'Growth Leadership Bonus', 'Total Bonus'],
      innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        w(tab(String(RowNumber)) + ' \t');
        w(tab(cellStr(item, 'EarnedDate')) + ' \t');
        w(tab(cellStr(item, 'EarnedMatchingPoints')) + ' \t');
        w(tab(dec2(item.EarnedBinaryLevelPoints)) + ' \t');
        w(tab(dec2(item.DAILYEARNEDROI)) + ' \t');
        w(tab(dec2(item.EarnedTaskLevelPoints)) + ' \t');
        w(tab(dec2(item.TotalEarnedPoints)) + ' \t');
        RowNumber += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(string SearchField, string btnexel, string SearchValue,
//   string fromdate, string todate, int? page, int? ddlcustpage)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/OverAll-Earnings" -> OverAllEarnings/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/OverAll-Earnings'], adminAuth, asyncHandler(async (req, res) => {
  let SearchField = nStr(req.p.SearchField);
  let btnexel = nStr(req.p.btnexel);
  let SearchValue = nStr(req.p.SearchValue);
  let fromdate = nStr(req.p.fromdate);
  let todate = nStr(req.p.todate);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Empid = req.user.emp_id;
  const ViewBag = {};
  Object.assign(ViewBag, await perms(Empid, url)); // isactive, isedit, excelactive
  if (btnexel === null) btnexel = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await overallEarnings(page, MaxRows, SearchField, SearchValue, fromdate, todate);
  const AllFreeEpinList = mapRows(rows, GET_EARNING_WALLET_HISTORY_PROPS);
  const TotalRecord = outIntOf(rows, 'TotalCount'); // int.Parse(v == "" ? "0" : v)
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.ddlcustpage = ddlcustpage;
  const Noofpage = await UtilityClass.GridNumbersPerPage(); // eslint-disable-line no-unused-vars
  ViewBag.EarnedMatchingPoints = toDecimalOut(rows, 'EarnedMatchingPoints');
  ViewBag.EarnedDirectPoints = toDecimalOut(rows, 'EarnedDirectPoints');
  ViewBag.EarnedLevelPoints = toDecimalOut(rows, 'EarnedLevelPoints');
  ViewBag.EarnedTaskLevelPoints = toDecimalOut(rows, 'EarnedTaskLevelPoints');
  ViewBag.TotalRoyality = toDecimalOut(rows, 'TotalRoyality');
  ViewBag.TotalCashReward = toDecimalOut(rows, 'TotalCashReward');
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/OverallEarnings/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.fromdate), nStr(req.p.todate));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
