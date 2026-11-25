'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\DateWiseLability.cs (class DateWiseLabilityController => /admin/DateWiseLability/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const { pagePermissions, excelLink } = require('./_shared/loginLogCommon');
const B = require('./_shared/batch05_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'DateWiseLability';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** class DateWiseLability */
const DWL_PROPS = ['RowNumber', 'Date', 'Binary', 'ROI', 'ROILevel', 'LEVELINCOME', 'BinaryLevelIncome', 'RollUp', 'DirectIncomes'];

/** Convert.ToDecimal(<scale-0 decimal OUT>.Value.ToString() == "0" ? "0" : Value.ToString()) - DBNull "" => FormatException */
function outDec(v) {
  const s = v === null || v === undefined ? '' : String(Math.round(Number(v)));
  if (s === '0') return 0;
  if (s === '' || Number.isNaN(Number(s))) throw new Error('Input string was not in a correct format.');
  return Number(s);
}

/** public void ExportReport(string FromDate, string ToDate, string SearchField, string SearchValue) */
async function ExportReport(req, res, ViewBag, FromDate, ToDate, SearchField, SearchValue) {
  void SearchField; void SearchValue; // not used by the legacy export query
  const userid = req.user.emp_id;
  const Filename = 'Date_Wise_Lability_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  // DBO.USP_ALLINCOMEDATEWISE @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out (CommandTimeout 1000 s => pg pool timeout)
  const list = mapRows(await db.proc(DB, 'USP_ALLINCOMEDATEWISE', {
    fromDate: FromDate, toDate: ToDate, MAXROWS: 99999999, STARTROWINDEX: 1,
  }), DWL_PROPS);
  if (list.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Date_Wise_Lability.xls', Filename, setFilepath: false,
      headers: ['S.No.', 'Date', 'Binary', 'ROI', 'ROI-Le', 'Level-In', 'Binary-Le', 'RollUp', 'Direct'],
      rows: list, innerProc: 'ProfileUpdate', outerProc: 'Usp_Profile_Update',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'RowNumber')) + ' \t');
        w(B.tab(B.cellStr(item, 'Date')) + ' \t');
        for (const k of ['Binary', 'ROI', 'ROILevel', 'LEVELINCOME', 'BinaryLevelIncome', 'RollUp', 'DirectIncomes']) w(B.tab(B.dec2(item[k])) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, int? Page, string btnexel, string FromDate, string ToDate, string SearchField, string SearchValue)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/DateWiseLability" -> DateWiseLability/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/DateWiseLability'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let Page = B.nInt(req.p.Page);
  let btnexel = B.nStr(req.p.btnexel);
  let FromDate = B.nStr(req.p.FromDate);
  let ToDate = B.nStr(req.p.ToDate);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging;
    dynamicpagging = value === undefined || value === null || value === '' ? 0 : parseInt(value, 10);
  }
  if (orderbydate === null) orderbydate = '';
  const ViewBag = {};
  const perm = await pagePermissions(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK
  const Plid = 0; void Plid;
  if (FromDate === null) FromDate = '';
  if (ToDate === null) ToDate = '';
  if (btnexel === null) btnexel = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  try {
    const MaxRows = Number(dynamicpagging);
    if (Page === null) Page = 1;
    const rows = await db.proc(DB, 'USP_ALLINCOMEDATEWISE', {
      fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, orderbydate,
    });
    const DateWiseLability = mapRows(rows, DWL_PROPS);
    // PORT-NOTE: OUT params read from the first result row (no row => every OUT value 0); decimal OUT params had scale 0 in SqlClient (rounded).
    const r0 = rows[0] || { totalcount: 0, roi: 0, directincomes: 0, binary: 0, roilevel: 0, levelincome: 0, binarylevelincome: 0, rollup: 0 };
    const tcs = B.str(B.col(r0, 'totalcount'));
    if (tcs === '') throw new Error('Input string was not in a correct format.'); // Convert.ToInt32(DBNull.ToString())
    const TotalRecord = parseInt(tcs === '0' ? '0' : tcs, 10);
    const raw = (c) => B.col(r0, c);
    // PORT-NOTE: legacy bug kept - SUMROI takes @DIRECTINCOMES unless @ROI is "0".
    const roiS = raw('roi') === null || raw('roi') === undefined ? '' : String(Math.round(Number(raw('roi'))));
    const SUMROI = roiS === '0' ? 0 : outDec(raw('directincomes'));
    const SUMBINARY = outDec(raw('binary'));
    const SUMROILEVEL = outDec(raw('roilevel'));
    const SUMLEVELINCOME = outDec(raw('levelincome'));
    const SUMBINARYLEVELINCOME = outDec(raw('binarylevelincome'));
    const SUMROLLUP = outDec(raw('rollup'));
    const SUMDIRECTINCOMES = outDec(raw('directincomes'));
    ViewBag.SUMROI = SUMROI;
    ViewBag.SUMBINARY = SUMBINARY;
    ViewBag.SUMROILEVEL = SUMROILEVEL;
    ViewBag.SUMLEVELINCOME = SUMLEVELINCOME;
    ViewBag.SUMBINARYLEVELINCOME = SUMBINARYLEVELINCOME;
    ViewBag.SUMROLLUP = SUMROLLUP;
    ViewBag.SUMDIRECTINCOMES = SUMDIRECTINCOMES;
    ViewBag.CurrentPage = Page;
    ViewBag.GridPageSize = MaxRows; ViewBag.orderbydate = orderbydate;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = FromDate;
    ViewBag.toDate = ToDate;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, FromDate, ToDate, SearchField, SearchValue);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/DateWiseLability/Index.cshtml', Model: DateWiseLability, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_Fund_History');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml', ErrorMessage: ExpObj.message });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string FromDate, string ToDate, string SearchField, string SearchValue)
// auth (public method => routable; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.FromDate), B.nStr(req.p.ToDate), B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue));
  if (!r.sent) res.send('');
}));

module.exports = router;
