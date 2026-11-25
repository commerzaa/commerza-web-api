'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MemberLogDetails.cs (class MemberLogDetailsController => /MemberLogDetails/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, s0, excelHistory, nowStamp, writeXlsExport, tab, cellStr, outIntOf,
} = require('./_shared/batch10-common');
const { dynPaging, intParseOut } = require('./_shared/batch10-a-common');

const router = express.Router();
const C = 'MemberLogDetails';

/** class MemberLogDetails */
const PROPS = ['CustomerName', 'RowNumber', 'USERNAME', 'LOGINID', 'IPAddress', 'Count', 'Date'];

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

// public void ExportReport(string FromDate, string ToDate, string SearchValue)
async function ExportReport(req, res, FromDate, ToDate, SearchValue, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'MemberLogDetails_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  // [USP_MemberLogDetails] @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@SearchField,@TOTALCOUNT out
  const rows = await db.proc(DB, 'USP_MemberLogDetails', {
    fromDate: FromDate, toDate: ToDate, MAXROWS: 9999999, STARTROWINDEX: 1, SearchField: SearchValue,
  });
  const list = mapRows(rows, PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'MemberLogDetails.xls', Filename,
      headers: ['S.No.', 'Username', 'Customer Name', 'Date', 'IPAddress', 'Count'],
      rows: list, innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        for (const k of ['RowNumber', 'USERNAME', 'CustomerName', 'Date', 'IPAddress', 'Count']) w(tab(cellStr(item, k)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate, string btnexel,
//   string ToDate, string SearchField, string SearchValue)
// auth (PORT-NOTE: legacy Index had no session check (ExportReport read Session["Admin_User"]); member log data => adminAuth)
// route-config: "AdminPanel/MemberLogDetails" -> MemberLogDetails/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/MemberLogDetails'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  // USP_EXCEL_LINK @url,@ISACTIVE out => int.Parse(v == "" ? "0" : v)
  const xr = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  ViewBag.isactive = intParseOut([xr], 'isactive');
  const Plid = 0; // eslint-disable-line no-unused-vars
  let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = dynPaging();
  const orderbydate = s0(req.p.orderbydate);
  const FromDate = s0(req.p.FromDate);
  const ToDate = s0(req.p.ToDate);
  const SearchField = s0(req.p.SearchField);
  const SearchValue = s0(req.p.SearchValue);
  const btnexel = s0(req.p.btnexel);
  try {
    const MaxRows = dynamicpagging;
    let Page = nInt(req.p.Page); if (Page === null) Page = 1;
    // [USP_MemberLogDetails] @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@SearchField,@TOTALCOUNT out,@orderbydate
    const rows = await db.proc(DB, 'USP_MemberLogDetails', {
      fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, SearchField: SearchValue, orderbydate,
    });
    const list = mapRows(rows, PROPS);
    const TotalRecord = outIntOf(rows, 'totalcount');
    Object.assign(ViewBag, {
      CurrentPage: Page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), orderbydate, dynamicpagging,
      SearchField, SearchValue, fromDate: FromDate, toDate: ToDate,
    });
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, FromDate, ToDate, SearchValue, ViewBag);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/MemberLogDetails/Index.cshtml', Model: list, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_Fund_History');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml', ErrorMessage: ExpObj.message });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string FromDate, string ToDate, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nStr(req.p.FromDate), nStr(req.p.ToDate), nStr(req.p.SearchValue), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
