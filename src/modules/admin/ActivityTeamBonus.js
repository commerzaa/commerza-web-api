'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ActivityTeamBonus.cs (class ActivityTeamBonusController => /admin/ActivityTeamBonus/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nint, nstr, nre, toDec, outStr, col, view, perms, fmtDate, n2, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows,
} = require('./_shared/batch02_common');

const router = express.Router();
const C = 'ActivityTeamBonus';

/** class GrowthLeadershipBonus */
const GLB_PROPS = ['ROWNUMBER', 'FROMID', 'TOID', 'INCOME', 'LEVEL', 'TYPE', 'DATE', 'COMM_PER', 'AMOUNT', 'TDS_PER', 'TDS_AMT', 'ADMIN_AMT',
  'ADMIN_PER', 'IncomeType', 'FROMUSERNAME', 'TOUSERNAME', 'REMARK', 'STATUS', 'ACTIVE', 'KIT_PRICE', 'ISHOLD'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

// public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
async function ExportReport(req, res, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Growth_Leadership_Bonus_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  const MaxRows = ddlcustpage === null ? 0 : Number(ddlcustpage); // Convert.ToInt32(ddlcustpage) (unused, like legacy)
  void MaxRows;
  if (page === null) page = 1;
  if (fromdate === null || todate === null || SearchField === null || SearchValue === null) throw nre();
  // [USP_LEVELINCOME_REPORTS] ... @LEVELINCOMETYPE,@TOTALCOUNT OUT  (no @TOTALIncome / @ISHOLD => proc defaults)
  const rows = await db.proc(DB, 'USP_LEVELINCOME_REPORTS', {
    STARTROWINDEX: page, MAXROWS: '1000000', FROMDATE: fromdate.trim(), TODATE: todate.trim(), SEARCHFIEL: SearchField.trim(),
    SEARCHVALUE: SearchValue.trim(), LEVELINCOMETYPE: 3,
  });
  const AllFreeEpinList = mapRows(rows, GLB_PROPS);
  if (AllFreeEpinList.length > 0) {
    return tsvDownload({
      req, res, ViewBag, xlsName: 'Growth_Leadership_Bonus.xls', Filename,
      headers: ['S.No.', 'Date', 'From Username', 'To Username', 'Income', 'Level'],
      rows: AllFreeEpinList,
      innerProc: 'AllFreeEpinList',
      outerProc: 'USP_LEVELINCOME_REPORTS',
      cells: (item, w) => {
        w(tab(cs(item.ROWNUMBER)) + ' \t');
        w(tab(fmtDate(item.DATE, 'dd-MM-yyyy')) + ' \t');
        w(tab(cs(item.FROMUSERNAME)) + ' \t');
        w(tab(cs(item.TOUSERNAME)) + ' \t');
        w(tab(n2(item.INCOME)) + ' \t');
        w(tab(cs(item.LEVEL)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string myquery, string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, string btnexel, string Date, int? IsHold)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/growth-leadership-bonus-report" -> ActivityTeamBonus/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/growth-leadership-bonus-report'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = nstr(req.p.orderbydate);
  const myquery = nstr(req.p.myquery);
  let SearchField = nstr(req.p.SearchField);
  let SearchValue = nstr(req.p.SearchValue);
  let fromdate = nstr(req.p.fromdate);
  let todate = nstr(req.p.todate);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  let btnexel = nstr(req.p.btnexel);
  let DateP = nstr(req.p.Date);
  let IsHold = nint(req.p.IsHold);
  const ViewBag = {};

  if (myquery !== null) {
    // Convert.ToDateTime(UtilityClass.Decryptword(myquery)).ToString("yyyy-MM-dd")  (outside the try => unhandled on bad input)
    const dec = await UtilityClass.Decryptword(myquery);
    const d = new Date(dec);
    if (!dec || Number.isNaN(d.getTime())) throw new Error('String was not recognized as a valid DateTime.');
    ViewBag.date = fmtDate(d, 'yyyy-MM-dd');
    fromdate = ViewBag.date;
    todate = ViewBag.date;
  }
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let AllFreeEpinList = [];
  try {
    if (DateP !== null) { DateP = await UtilityClass.Decryptword(DateP); }
    if (ddlcustpage === null) ddlcustpage = 100;
    if (SearchField === null) SearchField = '';
    if (SearchValue === null) SearchValue = '';
    if (fromdate === null) fromdate = '';
    if (todate === null) todate = '';
    if (btnexel === null) btnexel = '';
    if (IsHold === null) IsHold = -1;

    const Empid = req.user.emp_id;
    await perms(url, Empid, ViewBag);
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_LEVELINCOME_REPORTS', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate.trim(), TODATE: todate.trim(), SEARCHFIEL: SearchField.trim(),
      SEARCHVALUE: SearchValue.trim(), LEVELINCOMETYPE: 3, ISHOLD: IsHold,
    });
    AllFreeEpinList = mapRows(rows, GLB_PROPS);
    const tc = outStr(col(rows[0], 'totalcount'));
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    const TOTALINCOMES = toDec(outStr(col(rows[0], 'totalincome'))); // decimal.Parse(TOTALINCOME.Value.ToString())
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TOTALINCOMES = TOTALINCOMES;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.orderbydate = orderbydate;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.ddlcustpage = ddlcustpage;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, ViewBag);
      if (r.sent) return undefined;
    }
    return view(res, '~/Views/AdminPanel/ActivityTeamBonus/Index.cshtml', AllFreeEpinList, ViewBag);
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'DisbaleGoogleAuthentication');
    return view(res, '~/Views/PageNotFound/Index.cshtml', AllFreeEpinList, ViewBag);
  }
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nstr(req.p.SearchField), nstr(req.p.SearchValue), nstr(req.p.fromdate), nstr(req.p.todate),
    nint(req.p.page), nint(req.p.ddlcustpage), {});
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
