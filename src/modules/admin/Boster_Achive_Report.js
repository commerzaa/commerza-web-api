'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Boster_Achive_Report.cs (class Boster_Achive_ReportController => /admin/Boster_Achive_Report/...)
// Database: affiliate (Db_Affiliate). Model class BosterAchiveReport (same file) => BAR_PROPS.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const { str, sp, ip, outVal, ts, tab, nowStamp, exportXls } = require('./_shared/batch04B_common');
const { excelHistory, viewPerms, dec2 } = require('./_shared/batch04_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Boster_Achive_Report';

const BAR_PROPS = ['ROWNUMBER', 'USERNAME', 'MOBILE', 'BOSTERDATE', 'TITLE', 'INVEST_AMOUNT', 'NEWRATE', 'OLDRATE', 'NEWDAYS', 'OLDDAYS'];

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields.
let url = '';
let url1 = '';

/** [USP_BOSTERACHIVEREPORT] @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT OUT (CommandTimeout 1000) */
const report = (page, MaxRows, SearchField, SearchValue, fromdate, todate) => db.proc(DB, 'USP_BOSTERACHIVEREPORT', {
  STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: fromdate, TODATE: todate,
});

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string btnexel, string username, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Boster-Achive-Report" -> Boster_Achive_Report/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Boster-Achive-Report'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = ip(req, 'dynamicpagging');
  let orderbydate = sp(req, 'orderbydate');
  let SearchField = sp(req, 'SearchField');
  let btnexel = sp(req, 'btnexel');
  let username = sp(req, 'username');
  let SearchValue = sp(req, 'SearchValue');
  let fromdate = sp(req, 'fromdate');
  let todate = sp(req, 'todate');
  let page = ip(req, 'page');
  let ddlcustpage = ip(req, 'ddlcustpage');

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (btnexel === null) btnexel = '';
  if (username === null) username = ''; // eslint-disable-line no-unused-vars
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  const ViewBag = await viewPerms(req, url, ['bal']);
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await report(page, MaxRows, SearchField, SearchValue, fromdate, todate);
    const BosterAchiveReport = mapRows(rows, BAR_PROPS);
    const tc = str(outVal(rows, 'TOTALCOUNT'));
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    await UtilityClass.GridNumbersPerPage(); // int Noofpage (unused)
    if (btnexel === 'Export Excel') {
      if (await ExportReport(req, res, ViewBag, fromdate, todate, SearchField, SearchValue)) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Boster_Achive_Report/Index.cshtml', Model: BosterAchiveReport, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_BOSTERACHIVEREPORT');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' });
  }
}));

/** public void ExportReport(string fromdate, string todate, string SearchField, string SearchValue) - true when sent */
async function ExportReport(req, res, ViewBag, fromdate, todate, SearchField, SearchValue) {
  const userid = req.user.emp_id;
  const Filename = `BosterAchiveReport_${userid}_${nowStamp()}`;
  await excelHistory(userid, url, Filename);
  const list = mapRows(await report(1, 9999999, SearchField, SearchValue, fromdate, todate), BAR_PROPS);
  return exportXls({
    req, res, rows: list, sheet: 'BosterAchiveReport', procName: 'usp_Blocked_memberList', itemProcName: 'getblockedMemberList', ViewBag,
    headers: ['S.No. \t', 'Username \t', 'Boster Date \t', 'Mobile \t', 'Package \t', 'Invest Amount \t', 'Old Rate \t', 'New Rate \t', 'Old Days \t', 'New Days \t'],
    row: (item, w) => {
      w(tab(ts(item.ROWNUMBER)) + ' \t');
      w(tab(ts(item.USERNAME)) + ' \t');
      w(tab(ts(item.BOSTERDATE)) + ' \t');
      w(tab(ts(item.MOBILE)) + ' \t');
      w(tab(ts(item.TITLE)) + ' \t');
      w(tab(dec2(item.INVEST_AMOUNT)) + ' \t');
      w(tab(dec2(item.OLDRATE)) + ' \t');
      w(tab(dec2(item.NEWRATE)) + ' \t');
      w(tab(ts(item.OLDDAYS)) + ' \t');
      w(tab(ts(item.NEWDAYS)) + ' \t');
    },
  });
}

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, sp(req, 'fromdate'), sp(req, 'todate'), sp(req, 'SearchField'), sp(req, 'SearchValue'));
  if (!sent) res.send(''); // void action => empty response
}));

module.exports = router;
