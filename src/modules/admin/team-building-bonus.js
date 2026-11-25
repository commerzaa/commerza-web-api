'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Team_Building_Bonus.cs (class Team_Building_BonusController => /admin/Team_Building_Bonus/...)
// Database: affiliate (Db_Affiliate). Procs: USP_LEVELINCOME_REPORTS, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const CheckPermissions = require('../../lib/admin/CheckPermissions');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, cellStr, tab, nowStamp, excelHistory, writeXlsExport, dec2, netFormat, outOf, trimS,
} = require('./_shared/batch11-common');
const { viewRes } = require('./_shared/batch13-08-common');

const router = express.Router();
const C = 'Team_Building_Bonus';

/** class Team_Building_Bonus */
const TBB_PROPS = ['ROWNUMBER', 'FROMID', 'TOID', 'INCOME', 'LEVEL', 'TYPE', 'DATE', 'COMM_PER', 'AMOUNT', 'TDS_PER', 'TDS_AMT', 'ADMIN_AMT',
  'ADMIN_PER', 'IncomeType', 'FROMUSERNAME', 'TOUSERNAME', 'REMARK', 'STATUS', 'ACTIVE', 'KIT_PRICE', 'ISHOLD'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

// public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
async function ExportReport(req, res, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Leadership_Bonus_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = ddlcustpage === null ? 0 : Number(ddlcustpage); void MaxRows; // Convert.ToInt32(ddlcustpage) (unused)
  if (page === null) page = 1;
  // [USP_LEVELINCOME_REPORTS] @STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@SEARCHFIELD,@SEARCHVALUE,@INCOMETYPE,@TOTALCOUNT OUT
  // (positional: the 7th argument is @LEVELINCOMETYPE; no @TOTALIncome / @ISHOLD => proc defaults)
  const AllFreeEpinList = mapRows(await db.proc(DB, 'USP_LEVELINCOME_REPORTS', {
    STARTROWINDEX: page, MAXROWS: '1000000', FROMDATE: trimS(fromdate), TODATE: trimS(todate), SEARCHFIEL: trimS(SearchField),
    SEARCHVALUE: trimS(SearchValue), LEVELINCOMETYPE: 8,
  }), TBB_PROPS);
  if (AllFreeEpinList.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Leadership_Bonus.xls', Filename,
      headers: ['S.No.', 'Date', 'From Username', 'To Username', 'Income', 'Level'],
      rows: AllFreeEpinList,
      innerProc: 'ExportReport',
      outerProc: 'USP_LEVELINCOME_REPORTS',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(netFormat(item.DATE, 'dd-MM-yyyy')) + ' \t');
        w(tab(cellStr(item, 'FROMUSERNAME')) + ' \t');
        w(tab(cellStr(item, 'TOUSERNAME')) + ' \t');
        w(tab(dec2(item.INCOME)) + ' \t');
        w(tab(cellStr(item, 'LEVEL')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, string btnexel, string Date, int? IsHold)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/team-building-bonus" -> Team_Building_Bonus/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/team-building-bonus'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let fromdate = nStr(req.p.fromdate);
  const DateP = nStr(req.p.Date);
  if (DateP !== null) fromdate = await UtilityClass.Decryptword(DateP);
  let ddlcustpage = nInt(req.p.ddlcustpage); if (ddlcustpage === null) ddlcustpage = 100;
  let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
  const d = (k) => { const v = nStr(req.p[k]); return v === null ? '' : v; };
  const orderbydate = d('orderbydate');
  const SearchField = d('SearchField');
  const SearchValue = d('SearchValue');
  if (fromdate === null) fromdate = '';
  const todate = d('todate');
  const btnexel = d('btnexel');
  let IsHold = nInt(req.p.IsHold); if (IsHold === null) IsHold = 0;
  let page = nInt(req.p.page);
  const ViewBag = {};
  const Empid = req.user.emp_id;
  const perm = await CheckPermissions.GetPageActionPermission(url, Empid);
  ViewBag.isactive = perm._opIsDownloadAllowed;
  ViewBag.isedit = perm._opIsEditAllowed;
  ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    // [USP_LEVELINCOME_REPORTS] ...,@LEVELINCOMETYPE,@TOTALCOUNT OUT,@TOTALINCOME OUT,@ISHOLD
    const rows = await db.proc(DB, 'USP_LEVELINCOME_REPORTS', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate.trim(), TODATE: todate.trim(), SEARCHFIEL: SearchField.trim(),
      SEARCHVALUE: SearchValue.trim(), LEVELINCOMETYPE: 8, ISHOLD: IsHold,
    });
    const AllFreeEpinList = mapRows(rows, TBB_PROPS);
    const tc = outOf(rows, 'TOTALCOUNT');
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    const ti = outOf(rows, 'TOTALIncome');
    const TOTALINCOMES = Number(ti === '' ? '0' : ti);
    if (Number.isNaN(TOTALINCOMES)) throw new Error('Input string was not in a correct format.');
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
      const r = await ExportReport(req, res, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, ViewBag);
      if (r.sent) return undefined;
    }
    return viewRes(res, '~/Views/AdminPanel/Team_Building_Bonus/Index.cshtml', AllFreeEpinList, ViewBag);
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_LEVELINCOME_REPORTS');
    return viewRes(res, '~/Views/PageNotFound/Index.cshtml', undefined, ViewBag);
  }
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.fromdate), nStr(req.p.todate),
    nInt(req.p.page), nInt(req.p.ddlcustpage), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
