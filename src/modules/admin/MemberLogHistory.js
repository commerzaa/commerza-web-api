'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MemberLogHistory.cs (class MemberLogHistoryController => /MemberLogHistory/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const {
  DB, nInt, nStr, s0, excelLink, inlinePerms, excelHistory, nowStamp, writeXlsExport, tab, cellStr, outIntOf,
} = require('./_shared/batch10_common');
const { dynPaging } = require('./_shared/batch10A_common');

const router = express.Router();
const C = 'MemberLogHistory';

/** class MemberLogHistory */
const PROPS = ['RowNumber', 'Count', 'Date'];

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

// public void ExportReport(string FromDate, string ToDate)
async function ExportReport(req, res, FromDate, ToDate, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'MemberLogHistory_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  // DBO.USP_MemberLogDetails_Member @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out
  const rows = await db.proc(DB, 'USP_MemberLogDetails_Member', { fromDate: FromDate, toDate: ToDate, MAXROWS: 999999, STARTROWINDEX: 1 });
  const list = mapRows(rows, PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'MemberLogHistory.xls', Filename,
      headers: ['S.No.', 'Login Date', 'Member'],
      rows: list, innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'RowNumber')) + ' \t');
        w(tab(cellStr(item, 'Date')) + ' \t');
        w(tab(cellStr(item, 'Count')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate, string btnexel,
//   string ToDate, string SearchField, string SearchValue)
// auth (reads Session["Admin_User"] - legacy threw NullReferenceException without a session)
// route-config: "AdminPanel/MemberLogHistory" -> MemberLogHistory/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/MemberLogHistory'], adminAuth, asyncHandler(async (req, res) => {
  const Plid = 0; // eslint-disable-line no-unused-vars
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  const ip = await inlinePerms(req.user.emp_id, url);
  ViewBag.isactive = ip.isactive;
  ViewBag.isedit = ip.isedit;
  let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = dynPaging();
  const orderbydate = s0(req.p.orderbydate);
  ViewBag.excelactive = await excelLink(url);
  const FromDate = s0(req.p.FromDate);
  const ToDate = s0(req.p.ToDate);
  const SearchField = s0(req.p.SearchField);
  const SearchValue = s0(req.p.SearchValue);
  const btnexel = s0(req.p.btnexel);
  try {
    const MaxRows = dynamicpagging;
    let Page = nInt(req.p.Page); if (Page === null) Page = 1;
    const rows = await db.proc(DB, 'USP_MemberLogDetails_Member', {
      fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, orderbydate,
    });
    const list = mapRows(rows, PROPS);
    const TotalRecord = outIntOf(rows, 'totalcount');
    Object.assign(ViewBag, {
      CurrentPage: Page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue,
      orderbydate, dynamicpagging, fromDate: FromDate, toDate: ToDate,
    });
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, FromDate, ToDate, ViewBag);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/MemberLogHistory/Index.cshtml', Model: list, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_Fund_History');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml', ErrorMessage: ExpObj.message });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string FromDate, string ToDate)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nStr(req.p.FromDate), nStr(req.p.ToDate), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
