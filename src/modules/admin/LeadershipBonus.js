'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\LeadershipBonus.cs (class LeadershipBonusController => /admin/LeadershipBonus/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert, legacyUrl } = require('./_shared/adminSession');
const B = require('./_shared/batch08_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'LeadershipBonus';

/** class LevelIncome */
const LEVEL_INCOME_PROPS = ['ROWNUMBER', 'FROMID', 'TOID', 'INCOME', 'LEVEL', 'TYPE', 'DATE', 'COMM_PER', 'AMOUNT', 'TDS_PER', 'TDS_AMT',
  'ADMIN_AMT', 'ADMIN_PER', 'IncomeType', 'FROMUSERNAME', 'TOUSERNAME', 'REMARK', 'STATUS', 'ACTIVE', 'KIT_PRICE', 'ISHOLD'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** string.Trim() on a possibly-null bound string (null => NullReferenceException) */
const trim = (v) => { if (v === null || v === undefined) throw B.nullRef(); return String(v).trim(); };

// public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
async function ExportReport(req, res, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, ViewBag) {
  const userid = req.user.emp_id; // ((Employee_Master)Session["Admin_User"]).Emp_ID
  const Filename = 'Leadership_Bonus_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = ddlcustpage === null ? 0 : Number(ddlcustpage); // Convert.ToInt32(ddlcustpage) (unused, like legacy)
  void MaxRows;
  if (page === null) page = 1;
  // [USP_LEVELINCOME_REPORTS] @STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@SEARCHFIELD,@SEARCHVALUE,@INCOMETYPE,@TOTALCOUNT OUT
  // (positional => proc params @SEARCHFIEL / @LEVELINCOMETYPE; @TOTALIncome / @ISHOLD left to the proc defaults)
  const rows = await db.proc(DB, 'USP_LEVELINCOME_REPORTS', {
    STARTROWINDEX: page, MAXROWS: '1000000', FROMDATE: trim(fromdate), TODATE: trim(todate), SEARCHFIEL: trim(SearchField),
    SEARCHVALUE: trim(SearchValue), LEVELINCOMETYPE: 10,
  });
  const AllFreeEpinList = mapRows(rows, LEVEL_INCOME_PROPS);
  if (AllFreeEpinList.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Leadership_Bonus.xls', Filename,
      headers: ['S.No.', 'Date', 'From Username', 'To Username', 'Investment', 'Comm.', 'Total Income', 'Admin Ch.', 'TDS', 'Net Income', 'Level'],
      rows: AllFreeEpinList,
      innerProc: 'ExportReport',
      outerProc: 'USP_LEVELINCOME_REPORTS',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.netFormat(item.DATE, 'dd-MM-yyyy')) + ' \t');
        w(B.tab(B.cellStr(item, 'FROMUSERNAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'TOUSERNAME')) + ' \t');
        w(B.tab(B.dec2(item.AMOUNT)) + ' \t');
        w(B.tab(B.dec2(item.COMM_PER)) + ' \t');
        w(B.tab(B.dec2(Number(item.INCOME) + Number(item.TDS_AMT) + Number(item.ADMIN_AMT))) + ' \t');
        w(B.tab(B.dec2(item.ADMIN_AMT)) + ' \t');
        w(B.tab(B.dec2(item.TDS_AMT)) + ' \t');
        w(B.tab(B.dec2(item.INCOME)) + ' \t');
        w(B.tab(B.cellStr(item, 'LEVEL')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, string btnexel, string Date, int? IsHold)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/leadership-bonus-report" -> LeadershipBonus/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/leadership-bonus-report'], adminAuth, asyncHandler(async (req, res) => {
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
  const ViewBag = {};

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (DateP !== null) { fromdate = await UtilityClass.Decryptword(DateP); }
  if (ddlcustpage === null) ddlcustpage = 100;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (btnexel === null) btnexel = '';
  if (IsHold === null) IsHold = -1;

  const Empid = req.user.emp_id;
  Object.assign(ViewBag, await B.perms(Empid, url)); // isactive / isedit / excelactive (outside the try, like legacy)
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    // CommandTimeout 1000
    const rows = await db.proc(DB, 'USP_LEVELINCOME_REPORTS', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate.trim(), TODATE: todate.trim(), SEARCHFIEL: SearchField.trim(),
      SEARCHVALUE: SearchValue.trim(), LEVELINCOMETYPE: 10, ISHOLD: IsHold,
    });
    const AllFreeEpinList = mapRows(rows, LEVEL_INCOME_PROPS);
    const tc = B.str(B.col(rows[0], 'totalcount'));
    const TotalRecord = B.cvtInt(tc === '' ? '0' : tc);
    const ti = B.str(B.col(rows[0], 'totalincome'));
    const TOTALINCOMES = B.cvtDec(ti === '' ? '0' : ti);
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
      const r = await ExportReport(req, res, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, ViewBag);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/LeadershipBonus/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_LEVELINCOME_REPORTS');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue), B.nStr(req.p.fromdate), B.nStr(req.p.todate),
    B.nInt(req.p.page), B.nInt(req.p.ddlcustpage), {});
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
