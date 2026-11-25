'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Leadership_IncomeController.cs
// (namespace Common.Controllers.AdminPanel, class Leadership_IncomeController => /admin/Leadership_Income/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch08-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Leadership_Income';

/** class GetLeadership */
const LEADERSHIP_PROPS = ['ROWNUMBER', 'USERNAME', 'MOBILENO', 'DATE', 'TOTALBUSINESS', 'DISTRIBUTEBUSINESS', 'TOTALPOINT', 'PERPOINTVALUE',
  'SELFPOINT', 'TOTALINCOME', 'TDS', 'NETINCOME'];

// PORT-NOTE: `private static string Url, Url1` - static fields shared by all requests (ExportReport uses the Url of the last Index call).
let Url = '';
let Url1 = '';

const trim = (v) => { if (v === null || v === undefined) throw B.nullRef(); return String(v).trim(); };

/** [USP_LEADERSHIP_INCOME] @REGNO,@STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT OUT,@NETINCOME OUT,@TOTALINCOME OUT */
async function leadershipIncome(Page, MaxRows, SearchField, SearchValue, fromDate, toDate) {
  return db.proc(DB, 'USP_LEADERSHIP_INCOME', {
    REGNO: '0', STARTROWINDEX: Page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: trim(SearchValue), FROMDATE: fromDate, TODATE: toDate,
  });
}

// public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, int? Page, int? ddlcustpage)
async function ExportReport(req, res, SearchField, SearchValue, fromDate, toDate, Page, ddlcustpage, ViewBag) {
  const userid = req.user.emp_id; // ((Employee_Master)Session["Admin_User"]).Emp_ID
  const Filename = 'LeadershipIncomeReport' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, Url, Filename);
  const MaxRows = ddlcustpage === null ? 0 : Number(ddlcustpage); // Convert.ToInt32(ddlcustpage) (unused, like legacy)
  void MaxRows;
  if (Page === null) Page = 1;
  const rows = await leadershipIncome(Page, 9999999, SearchField, SearchValue, fromDate, toDate);
  const listLeaderShip = mapRows(rows, LEADERSHIP_PROPS);
  if (listLeaderShip.length > 0) {
    const tmp = {};
    const r = await B.writeXlsExport({
      req, res, ViewBag: tmp, sheet: 'Leadership_IncomeReport.xls', Filename,
      headers: ['S.No.', 'Username', 'Mobile No.', 'Date', 'Total Business', 'Distribute Business', 'Total Point', 'Per Point Value',
        'Self Point', 'Total Income', 'TDS', 'Net Income'],
      rows: listLeaderShip,
      innerProc: 'GetReferalIncome',
      outerProc: null, // legacy outer catch: `catch (Exception) { throw; }` (no ErrorInsert)
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.cellStr(item, 'USERNAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'MOBILENO')) + ' \t');
        w(B.tab(B.netFormat(item.DATE, 'dd-MM-yyyy')) + ' \t');
        w(B.tab(B.dec2(item.TOTALBUSINESS)) + ' \t');
        w(B.tab(B.dec2(item.DISTRIBUTEBUSINESS)) + ' \t');
        w(B.tab(B.dec2(item.TOTALPOINT)) + ' \t');
        w(B.tab(B.dec2(item.PERPOINTVALUE)) + ' \t');
        w(B.tab(B.dec2(item.SELFPOINT)) + ' \t');
        w(B.tab(B.dec2(item.TOTALINCOME)) + ' \t');
        w(B.tab(B.dec2(item.TDS)) + ' \t');
        w(B.tab(B.dec2(item.NETINCOME)) + ' \t');
      },
    });
    if (!r.sent) throw new Error(tmp.filepath); // `throw;` - rethrown to the caller (Index catch / 500)
    ViewBag.filepath = tmp.filepath;
    return r;
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? Dynamicpagging, string SearchField, string SearchValue, string fromDate, string toDate, int? Page, int? ddlcustpage, string BtnExcel)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/Leadership-Income-report" -> Leadership_Income/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Leadership-Income-report'], adminAuth, asyncHandler(async (req, res) => {
  let Dynamicpagging = B.nInt(req.p.Dynamicpagging);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let Page = B.nInt(req.p.Page);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  let BtnExcel = B.nStr(req.p.BtnExcel);
  const ViewBag = {};

  Url1 = legacyUrl(req).slice(1);
  Url = '~' + Url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (Dynamicpagging === null) Dynamicpagging = 100;
  if (BtnExcel === null) BtnExcel = '';

  const Empid = req.user.emp_id;
  Object.assign(ViewBag, await B.perms(Empid, Url)); // isactive / isedit / excelactive (outside the try)
  try {
    const MaxRows = Number(Dynamicpagging);
    if (Page === null) Page = 1;
    const rows = await leadershipIncome(Page, MaxRows, SearchField, SearchValue, fromDate, toDate);
    const listLeaderShip = mapRows(rows, LEADERSHIP_PROPS);
    const tc = B.str(B.col(rows[0], 'totalcount'));
    const TotalRecord = B.cvtInt(tc === '' ? '0' : tc);
    // decimal.Parse(TotalIncome.Value.ToString()) - no "" guard: DBNull => FormatException
    const parseDec = (v) => { const s = B.str(v); if (s === '') throw new Error('Input string was not in a correct format.'); return B.cvtDec(s); };
    const TotalAllIncome = parseDec(B.col(rows[0], 'netincome'));      // @NETINCOME OUT
    const TotalNetAllIncome = parseDec(B.col(rows[0], 'totalincome')); // @TOTALINCOME OUT
    ViewBag.CurrentPage = Page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.Dynamicpagging = Dynamicpagging;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TotalAllIncome = TotalAllIncome;
    ViewBag.TotalNetAllIncome = TotalNetAllIncome;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.ddlcustpage = ddlcustpage;
    if (BtnExcel === 'Export Excel') {
      const r = await ExportReport(req, res, SearchField, SearchValue, fromDate, toDate, Page, ddlcustpage, ViewBag);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Leadership_Income/Index.cshtml', Model: listLeaderShip, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_DIRECTINCOME_REPORT');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, int? Page, int? ddlcustpage)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue), B.nStr(req.p.fromDate), B.nStr(req.p.toDate),
    B.nInt(req.p.Page), B.nInt(req.p.ddlcustpage), {});
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
