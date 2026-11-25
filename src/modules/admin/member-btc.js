'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Member_BTC.cs (class Member_BTCController => /Member_BTC/...)
// Database: affiliate (Db_Affiliate). Proc: USP_GET_MEMBERBTC. Config: DynamicPagging.
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, s0, cvtInt, inlinePerms, excelLink, excelHistory, nowStamp, writeXlsExport, tab, cellStr, netDateString, errorView,
} = require('./_shared/batch09-common');

const router = express.Router();
const C = 'Member_BTC';

/** class MemberBTC */
const PROPS = ['Name', 'USERNAME', 'MOBILE', 'DOC', 'BtcAddress', 'UpdatedDate', 'Active'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

// public void ExportReport(string SearchField, string SearchValue, int? page, string OrderBy, string FROMDATE, string TODATE)
async function ExportReport(req, res, SearchField, SearchValue, page, OrderBy, FROMDATE, TODATE, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Member_BTC_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); void MaxRows;
  if (SearchField === null || SearchValue === null) { SearchField = ''; SearchValue = ''; }
  if (OrderBy === null) OrderBy = '';
  if (page === null) page = 1;
  const list = mapRows(await db.proc(DB, 'USP_GET_MEMBERBTC', {
    STARTROWINDEX: page, MAXROWS: '1000000', SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE, TODATE, USERNAME: '',
  }), PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Member_BTC.xls', downloadName: ' Member_BTC.xls', Filename,
      headers: ['Name', 'Mobile', 'UserName', 'Topup Date', 'Btc Address', 'Updated Date'],
      rows: list, innerProc: 'MemberBTC', outerProc: 'USP_GET_MEMBERBTC',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'Name')) + ' \t');
        w(tab(cellStr(item, 'MOBILE')) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(item.DOC === null || item.DOC === undefined ? '' : netDateString(item.DOC)) + ' \t'); // Nullable<DateTime>.ToString() => "" for null
        w(tab(cellStr(item, 'BtcAddress')) + ' \t');
        w(tab(cellStr(item, 'UpdatedDate')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string SearchField, string SearchValue, int? page, string OrderBy,
//   string FROMDATE, string TODATE, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Member-BTC" -> Member_BTC/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Member-BTC'], (req, res, next) => {
  url1 = legacyUrl(req).slice(1); // (static set before the session check, like legacy)
  url = '~' + url1;
  next();
}, adminAuth, asyncHandler(async (req, res) => {
  let SearchField = s0(req.p.SearchField);
  let SearchValue = s0(req.p.SearchValue);
  const FROMDATE = s0(req.p.FROMDATE);
  let dynamicpagging = nInt(req.p.dynamicpagging);
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging;
    dynamicpagging = cvtInt(value === undefined || value === '' ? null : value); // Convert.ToInt16(string) (null => 0)
  }
  const TODATE = s0(req.p.TODATE);
  const btnexel = s0(req.p.btnexel);
  let OrderBy = nStr(req.p.OrderBy);
  let page = nInt(req.p.page);
  const ViewBag = {};
  ViewBag.excelactive = await excelLink(url);
  const p = await inlinePerms(req.user.emp_id, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  try {
    const MaxRows = dynamicpagging;
    if (SearchField === null || SearchValue === null) { SearchField = ''; SearchValue = ''; }
    if (OrderBy === null) OrderBy = '';
    if (page === null) page = 1;
    // [USP_GET_MEMBERBTC] @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@USERNAME,@TOTALCOUNT out
    const MemberBtc = mapRows(await db.proc(DB, 'USP_GET_MEMBERBTC', {
      STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE, TODATE, USERNAME: '',
    }), PROPS);
    const TotalRecord = 0; // (legacy ignored @TOTALCOUNT)
    Object.assign(ViewBag, {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, dynamicpagging,
      SearchValue, FROMDATE, TODATE, OrderBy,
    });
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, SearchField, SearchValue, page, OrderBy, FROMDATE, TODATE, ViewBag);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Member_BTC/Index.cshtml', Model: MemberBtc, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_GET_MEMBERBTC');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, int? page, string OrderBy, string FROMDATE, string TODATE)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nStr(req.p[k]);
  const r = await ExportReport(req, res, v('SearchField'), v('SearchValue'), nInt(req.p.page), v('OrderBy'), v('FROMDATE'), v('TODATE'), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
