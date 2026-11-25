'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Bonusincome.cs (class BonusincomeController => /admin/Bonusincome/...)
// Database: affiliate (Db_Affiliate). Model class Bonusincome (same file) => BI_PROPS.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const { str, sp, ip, outVal, ts, tab, nowStamp, exportXls, fmtDate } = require('./_shared/batch04B_common');
const { excelHistory, strTrim, viewPerms, dec2 } = require('./_shared/batch04_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Bonusincome';

const BI_PROPS = ['ROWNUMBER', 'DATE', 'PACKAGEAMT', 'COMMISSIONAMOUNT', 'ADMINCH', 'TDS', 'NETCOMMISSION', 'ToUserName'];

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields.
let url = '';
let url1 = '';

/** [USP_BonusIncomeHistory] @loginid,@STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT OUT */
const bonusHistory = (page, MaxRows, SearchField, SearchValue, fromdate, todate) => db.proc(DB, 'USP_BonusIncomeHistory', {
  loginid: '', STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: strTrim(SearchField), SEARCHVALUE: strTrim(SearchValue),
  FROMDATE: strTrim(fromdate), TODATE: strTrim(todate),
});

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, string btnexel)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/bonus-income-report" -> Bonusincome/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/bonus-income-report'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = ip(req, 'dynamicpagging');
  let orderbydate = sp(req, 'orderbydate');
  let SearchField = sp(req, 'SearchField');
  let SearchValue = sp(req, 'SearchValue');
  let fromdate = sp(req, 'fromdate');
  let todate = sp(req, 'todate');
  let page = ip(req, 'page');
  let ddlcustpage = ip(req, 'ddlcustpage');
  let btnexel = sp(req, 'btnexel');

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
  const ViewBag = await viewPerms(req, url, ['bal']);
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await bonusHistory(page, MaxRows, SearchField, SearchValue, fromdate, todate);
    const AllFreeEpinList = mapRows(rows, BI_PROPS);
    const tc = str(outVal(rows, 'TOTALCOUNT'));
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    await UtilityClass.GridNumbersPerPage(); // int Noofpage (unused)
    if (btnexel === 'Export Excel') {
      if (await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, page, ddlcustpage)) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Bonusincome/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_BonusIncomeHistory');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' });
  }
}));

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage) - true when sent */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, page, ddlcustpage) {
  const userid = req.user.emp_id;
  const Filename = `Leadership_Bonus_${userid}_${nowStamp()}`;
  await excelHistory(userid, url, Filename);
  const MaxRows = ddlcustpage === null ? 0 : Number(ddlcustpage); // Convert.ToInt32(int?) (null => 0)
  if (page === null) page = 1;
  const AllFreeEpinList = mapRows(await bonusHistory(page, MaxRows, SearchField, SearchValue, fromdate, todate), BI_PROPS);
  return exportXls({
    req, res, rows: AllFreeEpinList, sheet: 'Leadership_Bonus', procName: 'USP_BonusIncomeHistory', itemProcName: 'AllFreeEpinList', ViewBag,
    headers: ['S.No. \t', 'Date \t', 'Username \t', 'Income \t'],
    row: (item, w) => {
      w(tab(ts(item.ROWNUMBER)) + ' \t');
      w(tab(fmtDate(item.DATE, 'dd-MM-yyyy')) + ' \t');
      w(tab(ts(item.ToUserName)) + ' \t');
      w(tab(dec2(item.NETCOMMISSION)) + ' \t');
    },
  });
}

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, sp(req, 'SearchField'), sp(req, 'SearchValue'), sp(req, 'fromdate'), sp(req, 'todate'),
    ip(req, 'page'), ip(req, 'ddlcustpage'));
  if (!sent) res.send(''); // void action => empty response
}));

module.exports = router;
