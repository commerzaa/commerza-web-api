'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\GenerationIncome.cs (class GenerationIncomeController => /admin/GenerationIncome/...)
// Database: affiliate (Db_Affiliate).
//
// Coverage: Index ([SessionExpireCheck]) -> route ; ExportReport (public void => routable) -> route + internal function (used by Index).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const B = require('./_shared/batch07_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'GenerationIncome';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** class LevelIncome (Controllers/AdminPanel/LeadershipBonus.cs) */
const LI_PROPS = ['ROWNUMBER', 'FROMID', 'TOID', 'INCOME', 'LEVEL', 'TYPE', 'DATE', 'COMM_PER', 'AMOUNT', 'TDS_PER', 'TDS_AMT', 'ADMIN_AMT',
  'ADMIN_PER', 'IncomeType', 'FROMUSERNAME', 'TOUSERNAME', 'REMARK', 'STATUS', 'ACTIVE', 'KIT_PRICE', 'ISHOLD'];

const trimOrThrow = (v) => { if (v === null || v === undefined) throw B.nullRef(); return String(v).trim(); };

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, page, ddlcustpage) {
  const userid = req.user.emp_id;
  const Filename = 'Leadership_Bonus_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = ddlcustpage === null ? 0 : Number(ddlcustpage); void MaxRows; // Convert.ToInt32(ddlcustpage), unused (legacy)
  if (page === null) page = 1;
  // [USP_LEVELINCOME_REPORTS] @STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@SEARCHFIELD,@SEARCHVALUE,@INCOMETYPE(=1, positional => @LEVELINCOMETYPE),@TOTALCOUNT OUT
  const AllFreeEpinList = mapRows(await db.proc(DB, 'USP_LEVELINCOME_REPORTS', {
    STARTROWINDEX: page, MAXROWS: '1000000', FROMDATE: trimOrThrow(fromdate), TODATE: trimOrThrow(todate), SEARCHFIEL: trimOrThrow(SearchField),
    SEARCHVALUE: trimOrThrow(SearchValue), LEVELINCOMETYPE: 1,
  }), LI_PROPS);
  if (AllFreeEpinList.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'GenerationIncome.xls', Filename,
      headers: ['S.No.', 'Date', 'From Username', 'To Username', 'Income', 'Level'],
      rows: AllFreeEpinList, innerProc: 'ExportReport', outerProc: 'USP_LEVELINCOME_REPORTS',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.netFormat(item.DATE, 'dd-MM-yyyy')) + ' \t');
        w(B.tab(B.cellStr(item, 'FROMUSERNAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'TOUSERNAME')) + ' \t');
        w(B.tab(B.dec2(item.INCOME)) + ' \t');
        w(B.tab(B.cellStr(item, 'LEVEL')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, string btnexel, string Date, int? IsHold)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/GenerationIncome" -> GenerationIncome/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/GenerationIncome'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromdate = B.nStr(req.p.fromdate);
  let todate = B.nStr(req.p.todate);
  let page = B.nInt(req.p.page);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  let btnexel = B.nStr(req.p.btnexel);
  const DateP = B.nStr(req.p.Date);
  let IsHold = B.nInt(req.p.IsHold);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (DateP !== null) fromdate = await UtilityClass.Decryptword(DateP); // outside the try (unhandled on failure)
  if (ddlcustpage === null) ddlcustpage = 100;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null || fromdate === undefined) fromdate = '';
  if (todate === null) todate = '';
  if (btnexel === null) btnexel = '';
  if (IsHold === null) IsHold = -1;
  const Empid = req.user.emp_id;
  const ViewBag = {};
  const perm = await B.perms(Empid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = perm.excelactive;
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    // PORT-NOTE: CommandTimeout = 1000 s - pg pool timeout applies.
    const rows = await db.proc(DB, 'USP_LEVELINCOME_REPORTS', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate.trim(), TODATE: todate.trim(), SEARCHFIEL: SearchField.trim(),
      SEARCHVALUE: SearchValue.trim(), LEVELINCOMETYPE: 7, ISHOLD: IsHold,
    });
    const AllFreeEpinList = mapRows(rows, LI_PROPS);
    const tc = B.str(B.col(rows[0], 'totalcount'));
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    const ti = B.str(B.col(rows[0], 'totalincome'));
    const TOTALINCOMES = B.cvtDec(ti === '' ? '0' : ti); // decimal.Parse
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows; ViewBag.dynamicpagging = dynamicpagging;
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
      const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, page, ddlcustpage);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/GenerationIncome/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
  } catch (ExpObj) {
    return B.errorView(req, res, ExpObj, 'USP_LEVELINCOME_REPORTS');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue), B.nStr(req.p.fromdate), B.nStr(req.p.todate),
    B.nInt(req.p.page), B.nInt(req.p.ddlcustpage));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
