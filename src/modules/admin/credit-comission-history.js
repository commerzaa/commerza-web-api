'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Credit_Comission_History.cs
// (namespace Common.Controllers.AdminPanel, [SessionExpireCheck] class Credit_Comission_HistoryController => /admin/Credit_Comission_History/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const { pagePermissions, excelLink } = require('./_shared/login-log-common');
const B = require('./_shared/batch05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Credit_Comission_History';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests. (`private Int64 Regno` is per request.)
let url = '';
let url1 = '';

/** class Credit_Comission_History */
const CCH_PROPS = ['RowNumber', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance', 'USERNAME', 'TOUSERNAME',
  'Name', 'Particular'];

const trimOrThrow = (v) => { if (v === null || v === undefined) throw B.nullRef(); return String(v).trim(); };

/** public void ExportReport(string CrDrType, string fromDate, string toDate, string TrType, string SearchField, string SearchValue) */
async function ExportReport(req, res, ViewBag, CrDrType, fromDate, toDate, TrType, SearchField, SearchValue) {
  const userid = req.user.emp_id;
  const Filename = 'Credit_Comission_History_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); void MaxRows;
  // PORT-NOTE: the legacy command text was positional: "...,@avalibalefund out,@SearchField,@SearchValue,@mode,@orderbydate", i.e. the
  // search values landed in the (OUT) parameters @GrossCoinWallet/@UsedCoinWallet and @mode/@orderbydate in @GrossCommissionWallet/
  // @UsedCommissionWallet - so the proc ran with its defaults for @mode/@orderbydate/@SEARCHFIELD/@SEARCHVALUE. Reproduced.
  trimOrThrow(SearchField); trimOrThrow(SearchValue);
  const Obj = mapRows(await db.proc(DB, 'USP_COMMISSION_STATEMENT', {
    PLID: 0, FromDate: fromDate, ToDate: toDate, StartRowIndex: 1, MaxRows: 100000000, CrDrType, TrType: B.cvtInt(TrType),
  }), CCH_PROPS);
  if (Obj.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Credit_Comission_History.xls', Filename,
      headers: ['S.No.', 'Date', 'Username', 'Name', 'Type', 'Amount', 'Particulars'],
      rows: Obj, innerProc: 'Credit_Comission_History', outerProc: 'Usp_TransferFundToUser',
      cells: (item, w) => {
        w('\n');
        for (const k of ['RowNumber', 'ProcessDate', 'USERNAME', 'Name', 'CrDrType', 'Cr_Amount', 'Particular']) {
          w(B.tab(B.cellStr(item, k)) + ' \t'); // Cr_Amount.ToString() (decimal, no format)
        }
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, int? page, string btnexel, string fromDate, string toDate, string CrDrType, string TrType, string username, int? ddlcustpage, string SearchField, string SearchValue)
// auth ([SessionExpireCheck] on the class)
// route-config: "AdminPanel/Credit-Comission-History" -> Credit_Comission_History/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Credit-Comission-History'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let page = B.nInt(req.p.page);
  let btnexel = B.nStr(req.p.btnexel);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let CrDrType = B.nStr(req.p.CrDrType);
  let TrType = B.nStr(req.p.TrType);
  let username = B.nStr(req.p.username);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let Regno = 0;
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (fromDate === null) fromDate = '';
  if (btnexel === null) btnexel = '';
  if (orderbydate === null) orderbydate = '';
  if (toDate === null) toDate = '';
  if (CrDrType === null) CrDrType = '';
  if (TrType === null) TrType = '0';
  if (TrType === '') TrType = '0';
  if (username === null) username = '';
  const ViewBag = {};
  ViewBag.excelactive = await excelLink(url);
  const Employeeid = req.user.emp_id;
  const perm = await pagePermissions(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  let Obj = [];
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    if (username !== '' && username !== null) {
      // PORT-NOTE: legacy concatenated username into the SQL (injection); parameterised.
      const r = await db.scalar(DB, 'select regno from member_master where username = @username limit 1', { username });
      Regno = r === null ? 0 : Number(r);
    } else {
      Regno = 0;
    }
    const rows = await db.proc(DB, 'USP_COMMISSION_STATEMENT', {
      PLID: Regno, FromDate: fromDate, ToDate: toDate, StartRowIndex: page, MaxRows, CrDrType, TrType: B.cvtInt(TrType), mode: '', orderbydate,
      SearchField: SearchField.trim(), SearchValue: SearchValue.trim(),
    });
    Obj = mapRows(rows, CCH_PROPS);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.username = username;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    // PORT-NOTE: OUT params @TotalCount / @cramount read from the first result row; no row => 0.
    const TotalRecord = rows.length ? B.outInt(rows[0], 'totalcount') : 0;
    const TotalCrAmt = rows.length ? B.decOutToInt(rows[0], 'cramount') : 0;
    ViewBag.CurrentPage = page;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TotalCrAmt = TotalCrAmt;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_COMMISSION_STATEMENT');
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found") ends the response
  }
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, CrDrType, fromDate, toDate, TrType, SearchField, SearchValue);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Credit_Comission_History/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string CrDrType, string fromDate, string toDate, string TrType, string SearchField, string SearchValue)
// auth ([SessionExpireCheck] on the class; public method => routable)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const s = (k) => B.nStr(req.p[k]);
  const r = await ExportReport(req, res, {}, s('CrDrType'), s('fromDate'), s('toDate'), s('TrType'), s('SearchField'), s('SearchValue'));
  if (!r.sent) res.send('');
}));

module.exports = router;
