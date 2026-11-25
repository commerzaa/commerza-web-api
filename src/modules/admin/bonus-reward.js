'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Bonus_Reward.cs (class Bonus_RewardController => /admin/Bonus_Reward/...)
// Database: affiliate (Db_Affiliate). Model class Bonus_Reward (same file) => BR_PROPS.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const { str, sp, ip, outVal, ts, tab, nowStamp, exportXls } = require('./_shared/batch04-b-common');
const { excelHistory, strTrim, viewPerms, dec2, decParse } = require('./_shared/batch04-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Bonus_Reward';

const BR_PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'REGNO', 'MTCHBV', 'PER', 'TOTALBV', 'DISTRIBUTEBV', 'TOTALMEMBER', 'TOTALINCOME', 'ADMICHARGE',
  'TDS', 'NETINCOME', 'DATE', 'ACTIVE', 'STATUS'];

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields.
let url = '';
let url1 = '';

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, string btnexel)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/bonus-reward" -> Bonus_Reward/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/bonus-reward'], adminAuth, asyncHandler(async (req, res) => {
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
  if (todate === null) todate = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (btnexel === null) btnexel = '';
  const ViewBag = await viewPerms(req, url, ['bal']);
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    // [USP_BONUSREWARDREPORT] @STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@SEARCHFIEL,@SEARCHVALUE,@INCOMETYPE(1),@TOTALCOUNT OUT,@TOTALAdminc OUT,@TOTALTDS OUT,@TOTALINCOME OUT,@TOTALAmount OUT,@TOTALAMOUNTS OUT
    const rows = await db.proc(DB, 'USP_BONUSREWARDREPORT', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: strTrim(SearchField), SEARCHVALUE: strTrim(SearchValue), INCOMETYPE: 1,
    });
    const bonusreward = mapRows(rows, BR_PROPS);
    const tc = str(outVal(rows, 'TOTALCOUNT'));
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    const TOTALINCOMES = decParse(outVal(rows, 'TOTALINCOME'));
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
    await UtilityClass.GridNumbersPerPage(); // int Noofpage (unused)
    if (btnexel === 'Export Excel') {
      if (await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, page, ddlcustpage)) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Bonus_Reward/Index.cshtml', Model: bonusreward, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_FranchisePending');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/AdminPanel/Bonus_Reward/Index.cshtml', ...ViewBag });
  }
}));

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage) - true when sent */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, page, ddlcustpage) {
  const userid = req.user.emp_id;
  const Filename = `Direct_Referral_Booster_${userid}_${nowStamp()}`;
  await excelHistory(userid, url, Filename);
  const MaxRows = ddlcustpage === null ? 0 : Number(ddlcustpage); // eslint-disable-line no-unused-vars
  if (page === null) page = 1;
  // [USP_BONUSREWARDREPORT] 8 parameters, @MAXROWS "10000000", @INCOMETYPE 4 (sic)
  const rows = await db.proc(DB, 'USP_BONUSREWARDREPORT', {
    STARTROWINDEX: page, MAXROWS: 10000000, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: strTrim(SearchField), SEARCHVALUE: strTrim(SearchValue), INCOMETYPE: 4,
  });
  const AllFreeEpinList = mapRows(rows, BR_PROPS);
  return exportXls({
    req, res, rows: AllFreeEpinList, sheet: 'Direct_Referral_Booster', procName: 'USP_DIRECTINCOME_REPORT', itemProcName: 'AllFreeEpinList', ViewBag,
    headers: ['S.No. \t', 'Date \t', 'UserName \t', 'Name \t', 'Distribute Amount \t', 'Match Point \t', 'Net Income \t'],
    row: (item, w) => {
      w(tab(ts(item.ROWNUMBER)) + ' \t');
      w(tab(ts(item.DATE)) + ' \t');
      w(tab(ts(item.USERNAME)) + ' \t');
      w(tab(ts(item.NAME)) + ' \t');
      w(tab(dec2(item.DISTRIBUTEBV)) + ' \t');
      w(tab(dec2(item.MTCHBV)) + ' \t');
      w(tab(dec2(item.NETINCOME)) + ' \t');
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
